'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageFinance } from '@/lib/auth/permissions'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'

type Result = { error?: string; success?: boolean }

/** Semua rute modul keuangan menampilkan angka yang sama — segarkan sekaligus. */
function revalidateFinance() {
  revalidatePath('/keuangan')
  revalidatePath('/keuangan/transaksi')
  revalidatePath('/keuangan/anggaran')
  revalidatePath('/keuangan/titipan')
  revalidatePath('/keuangan/laporan')
}

/** Pintu masuk tiap action: sesi valid + role bendahara. */
async function guard(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageFinance(session.role)) return { error: 'Tidak memiliki izin.' }
  return { userId: session.userId }
}

/**
 * Rupiah dari input. Bendahara terbiasa mengetik "36.199.033" atau
 * "36,199,033" — keduanya harus diterima, jadi semua pemisah dibuang lebih
 * dulu daripada memaksa mereka mengetik angka polos.
 */
function parseRupiah(raw: FormDataEntryValue | null): number {
  const digits = String(raw ?? '').replace(/[^\d-]/g, '')
  const value = Number(digits)
  return Number.isFinite(value) ? value : 0
}

/**
 * Baca alokasi dana sumber dari form.
 *
 * Field-nya bernama `funding_<slug>` supaya jumlah kolom matriks bisa
 * berubah mengikuti pos pemasukan yang aktif, tanpa mengubah action ini.
 */
function readFunding(formData: FormData): { source_slug: string; amount: number }[] {
  const rows: { source_slug: string; amount: number }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('funding_')) continue
    const amount = parseRupiah(value)
    if (amount > 0) rows.push({ source_slug: key.slice('funding_'.length), amount })
  }
  return rows
}

// ── Transaksi ────────────────────────────────────────────────────────────────

/**
 * Simpan satu penerimaan / pengeluaran.
 *
 * Dua aturan dijaga di sini, bukan cuma di database:
 *   • Transaksi lunas wajib bertanggal bayar. Kalau bendahara lupa mengisinya
 *     kita pakai tanggal terakhir bulan periode — bukan hari ini — supaya
 *     input susulan awal Mei untuk bulan April tidak diam-diam terhitung
 *     sebagai pemasukan Mei.
 *   • Alokasi dana sumber, kalau diisi, harus persis sama dengan nominalnya.
 *     Selisih sekecil apa pun membuat baris TOTAL tabel 1.5 tidak seimbang,
 *     dan kesalahan seperti itu sangat sulit dilacak setelah laporan tercetak.
 */
export async function saveTransactionAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const id = (formData.get('id') as string) || null
  const accountId = formData.get('account_id') as string
  const periodKey = formData.get('period') as string
  const amount = parseRupiah(formData.get('amount'))
  const description = ((formData.get('description') as string) ?? '').trim()
  const status = formData.get('status') === 'piutang' ? 'piutang' : 'lunas'
  const rawPaidAt = ((formData.get('paid_at') as string) ?? '').trim()

  if (!accountId) return { error: 'Pos keuangan wajib dipilih.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (amount <= 0) return { error: 'Nominal harus lebih dari nol.' }

  const paidAt = status === 'lunas' ? rawPaidAt || endOfMonth(periodKey) : null

  const funding = readFunding(formData)
  if (funding.length) {
    const allocated = funding.reduce((total, f) => total + f.amount, 0)
    if (allocated !== amount) {
      return {
        error: `Alokasi dana sumber ${allocated.toLocaleString('id-ID')} tidak sama dengan nominal ${amount.toLocaleString('id-ID')}.`,
      }
    }
  }

  const supabase = createServerClient()
  const payload = {
    account_id: accountId,
    period: toPeriodDate(periodKey),
    amount,
    description,
    status,
    paid_at: paidAt,
    updated_at: new Date().toISOString(),
  }

  let transactionId = id
  if (id) {
    const { error } = await supabase.from('finance_transactions').update(payload).eq('id', id)
    if (error) return { error: error.message || 'Gagal menyimpan transaksi.' }
  } else {
    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({ ...payload, created_by: auth.userId })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message || 'Gagal menyimpan transaksi.' }
    transactionId = data.id as string
  }

  // Alokasi ditulis ulang seluruhnya, bukan ditambal per baris: menghapus
  // satu sumber dana sama saja dengan tidak mengirimkannya lagi dari form.
  if (transactionId) {
    await supabase.from('finance_funding').delete().eq('transaction_id', transactionId)
    if (funding.length) {
      await supabase
        .from('finance_funding')
        .insert(funding.map(f => ({ ...f, transaction_id: transactionId })))
    }
  }

  revalidateFinance()
  return { success: true }
}

/** Tanggal terakhir bulan periode, mis. '2026-04' → '2026-04-30'. */
function endOfMonth(periodKey: string): string {
  const [year, month] = periodKey.split('-').map(Number)
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini; Date.UTC dipakai
  // supaya hasilnya tidak bergeser oleh zona waktu server.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${periodKey}-${String(last).padStart(2, '0')}`
}

export async function deleteTransactionAction(id: string): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const supabase = createServerClient()
  const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
  if (error) return { error: error.message || 'Gagal menghapus transaksi.' }

  revalidateFinance()
  return { success: true }
}

/**
 * Tandai piutang sebagai tertunaikan.
 *
 * `period` transaksi sengaja tidak diubah: tagihannya tetap milik bulan asal,
 * sementara pemasukannya diakui di bulan pembayaran. Perbedaan itulah yang
 * membuat catatan "MoU Maret baru diterima April" bisa dibaca dari data.
 */
export async function settleReceivableAction(id: string, paidAt: string): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return { error: 'Tanggal pembayaran tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('finance_transactions')
    .update({ status: 'lunas', paid_at: paidAt, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'piutang')

  if (error) return { error: error.message || 'Gagal menandai lunas.' }

  revalidateFinance()
  return { success: true }
}

// ── Anggaran ─────────────────────────────────────────────────────────────────

/**
 * Simpan anggaran satu periode sekaligus.
 *
 * Diterima sebagai satu form berisi seluruh pos (`budget_<accountId>`) karena
 * penyusunan anggaran memang dikerjakan sekali duduk untuk semua pos, dan
 * menyimpannya sebagai satu transaksi menghindari periode yang setengah terisi.
 */
export async function saveBudgetsAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const periodKey = formData.get('period') as string
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const rows: { account_id: string; period: string; amount: number; updated_by: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('budget_')) continue
    rows.push({
      account_id: key.slice('budget_'.length),
      period: toPeriodDate(periodKey),
      amount: Math.max(parseRupiah(value), 0),
      updated_by: auth.userId,
    })
  }
  if (!rows.length) return { error: 'Tidak ada anggaran untuk disimpan.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('finance_budgets')
    .upsert(rows, { onConflict: 'account_id,period' })

  if (error) return { error: error.message || 'Gagal menyimpan anggaran.' }

  revalidateFinance()
  return { success: true }
}

/**
 * Salin anggaran bulan lain ke periode ini.
 *
 * Anggaran RQ sebagian besar berulang tiap bulan; menyalin lalu menyunting
 * beberapa pos jauh lebih cepat — dan lebih kecil peluang salah ketiknya —
 * daripada mengisi empat belas pos dari nol setiap bulan.
 */
export async function copyBudgetsAction(fromPeriod: string, toPeriod: string): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth
  if (!isValidPeriod(fromPeriod) || !isValidPeriod(toPeriod)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('finance_budgets')
    .select('account_id, amount')
    .eq('period', toPeriodDate(fromPeriod))

  const source = (data ?? []) as { account_id: string; amount: number }[]
  if (!source.length) return { error: 'Bulan sumber belum punya anggaran.' }

  const { error } = await supabase.from('finance_budgets').upsert(
    source.map(row => ({
      account_id: row.account_id,
      period: toPeriodDate(toPeriod),
      amount: row.amount,
      updated_by: auth.userId,
    })),
    { onConflict: 'account_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyalin anggaran.' }

  revalidateFinance()
  return { success: true }
}

// ── Dana titipan ─────────────────────────────────────────────────────────────

export async function saveTrustEntryAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const fundId = formData.get('fund_id') as string
  const entryDate = ((formData.get('entry_date') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim()
  const magnitude = Math.abs(parseRupiah(formData.get('amount')))
  // Arah disimpan sebagai tanda pada nominal, bukan kolom terpisah — saldo
  // jadi bisa dijumlah langsung tanpa percabangan di setiap perhitungan.
  const amount = formData.get('direction') === 'keluar' ? -magnitude : magnitude

  if (!fundId) return { error: 'Buku dana titipan wajib dipilih.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { error: 'Tanggal tidak valid.' }
  if (!description) return { error: 'Keterangan wajib diisi.' }
  if (magnitude <= 0) return { error: 'Nominal harus lebih dari nol.' }

  const supabase = createServerClient()
  const id = (formData.get('id') as string) || null
  const payload = { fund_id: fundId, entry_date: entryDate, description, amount }

  const { error } = id
    ? await supabase.from('finance_trust_entries').update(payload).eq('id', id)
    : await supabase.from('finance_trust_entries').insert({ ...payload, created_by: auth.userId })

  if (error) return { error: error.message || 'Gagal menyimpan mutasi.' }

  revalidateFinance()
  return { success: true }
}

export async function deleteTrustEntryAction(id: string): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const supabase = createServerClient()
  const { error } = await supabase.from('finance_trust_entries').delete().eq('id', id)
  if (error) return { error: error.message || 'Gagal menghapus mutasi.' }

  revalidateFinance()
  return { success: true }
}

/**
 * Setel saldo pembuka buku titipan. Dipakai sekali saat modul mulai dipakai,
 * untuk memindahkan saldo berjalan dari pembukuan lama.
 */
export async function saveTrustOpeningAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const fundId = formData.get('fund_id') as string
  const openingDate = ((formData.get('opening_date') as string) ?? '').trim()
  if (!fundId) return { error: 'Buku dana titipan wajib dipilih.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) return { error: 'Tanggal saldo awal tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('finance_trust_funds')
    .update({
      opening_balance: parseRupiah(formData.get('opening_balance')),
      opening_date: openingDate,
    })
    .eq('id', fundId)

  if (error) return { error: error.message || 'Gagal menyimpan saldo awal.' }

  revalidateFinance()
  return { success: true }
}

// ── Rencana program & narasi laporan ─────────────────────────────────────────

export async function saveProgramPlanAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const periodKey = formData.get('period') as string
  const name = ((formData.get('name') as string) ?? '').trim()
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (!name) return { error: 'Nama program wajib diisi.' }

  const payload = {
    period: toPeriodDate(periodKey),
    name,
    funding_source: ((formData.get('funding_source') as string) ?? '').trim(),
    amount: Math.max(parseRupiah(formData.get('amount')), 0),
  }

  const supabase = createServerClient()
  const id = (formData.get('id') as string) || null
  const { error } = id
    ? await supabase.from('finance_program_plans').update(payload).eq('id', id)
    : await supabase.from('finance_program_plans').insert({ ...payload, created_by: auth.userId })

  if (error) return { error: error.message || 'Gagal menyimpan rencana program.' }

  revalidateFinance()
  return { success: true }
}

export async function deleteProgramPlanAction(id: string): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const supabase = createServerClient()
  const { error } = await supabase.from('finance_program_plans').delete().eq('id', id)
  if (error) return { error: error.message || 'Gagal menghapus rencana program.' }

  revalidateFinance()
  return { success: true }
}

/** Simpan satu bagian naratif laporan (evaluasi anggaran, analisis, dst). */
export async function saveReportNoteAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const periodKey = formData.get('period') as string
  const section = ((formData.get('section') as string) ?? '').trim()
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (!section) return { error: 'Bagian laporan tidak dikenali.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('finance_report_notes').upsert(
    {
      period: toPeriodDate(periodKey),
      section,
      content: ((formData.get('content') as string) ?? '').trim(),
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'period,section' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan catatan laporan.' }

  revalidateFinance()
  return { success: true }
}
