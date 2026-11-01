'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageFinance } from '@/lib/auth/permissions'
import { isValidPeriod, lastDayOf, toPeriodDate } from '@/lib/finance/period'

type Result = { error?: string; success?: boolean }

/** Semua rute modul keuangan menampilkan angka yang sama — segarkan sekaligus. */
function revalidateFinance() {
  revalidatePath('/keuangan')
  revalidatePath('/keuangan/isian')
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

// ── Isian bulanan ────────────────────────────────────────────────────────────

/**
 * Simpan isian satu bulan: TOTAL per pos pemasukan & pengeluaran, keterangan
 * tiap pos, dan sisa piutang tiap pos pemasukan.
 *
 * Penyimpanan memakai tabel yang sudah ada supaya mesin laporan tidak berubah:
 *   • jumlah   → satu baris finance_transactions 'lunas' per pos, paid_at =
 *                hari terakhir bulan (basis kas: diterima/dibayar bulan itu);
 *   • piutang  → satu baris 'piutang' per pos pemasukan, period = bulan itu;
 *   • keterangan → finance_report_notes, section 'ket_<kind>_<slug>' (pos
 *                bernilai 0 pun tetap berketerangan, mis. "Tidak ada proposal").
 * Isian lama bulan itu diganti utuh — menyimpan ulang tidak menggandakan.
 */
export async function saveIsianBulananAction(_: unknown, formData: FormData): Promise<Result> {
  const auth = await guard()
  if ('error' in auth) return auth

  const periodKey = String(formData.get('period') ?? '')
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  const periodDate = toPeriodDate(periodKey)
  const paidAt = lastDayOf(periodKey)

  const supabase = createServerClient()
  const { data: akun, error: eAkun } = await supabase.from('finance_accounts').select('id, kind, slug').eq('is_active', true)
  if (eAkun || !akun) return { error: 'Gagal membaca daftar pos.' }

  const lunas: { account_id: string; period: string; amount: number; description: string; status: 'lunas'; paid_at: string; created_by: string }[] = []
  const piutang: { account_id: string; period: string; amount: number; description: string; status: 'piutang'; paid_at: null; created_by: string }[] = []
  const catatan: { period: string; section: string; content: string; updated_by: string; updated_at: string }[] = []
  const kini = new Date().toISOString()

  for (const a of akun as { id: string; kind: 'pemasukan' | 'pengeluaran'; slug: string }[]) {
    const kunci = `${a.kind}_${a.slug}`
    const jumlah = parseRupiah(formData.get(`jumlah_${kunci}`))
    const sisa = parseRupiah(formData.get(`piutang_${kunci}`))
    const ket = String(formData.get(`ket_${kunci}`) ?? '').trim()
    if (jumlah < 0 || sisa < 0) return { error: 'Jumlah tidak boleh negatif.' }
    if (jumlah > 0) lunas.push({ account_id: a.id, period: periodDate, amount: jumlah, description: ket, status: 'lunas', paid_at: paidAt, created_by: auth.userId })
    if (sisa > 0 && a.kind === 'pemasukan') piutang.push({ account_id: a.id, period: periodDate, amount: sisa, description: ket, status: 'piutang', paid_at: null, created_by: auth.userId })
    catatan.push({ period: periodDate, section: `ket_${kunci}`, content: ket, updated_by: auth.userId, updated_at: kini })
  }

  const ids = (akun as { id: string }[]).map(a => a.id)
  const [hapusLunas, hapusPiutang] = await Promise.all([
    supabase.from('finance_transactions').delete().in('account_id', ids).eq('status', 'lunas').gte('paid_at', periodDate).lte('paid_at', paidAt),
    supabase.from('finance_transactions').delete().in('account_id', ids).eq('status', 'piutang').eq('period', periodDate),
  ])
  if (hapusLunas.error || hapusPiutang.error) return { error: 'Gagal mengganti isian lama.' }

  const baris = [...lunas, ...piutang]
  if (baris.length) {
    const { error } = await supabase.from('finance_transactions').insert(baris)
    if (error) return { error: error.message || 'Gagal menyimpan isian.' }
  }
  const { error: eCat } = await supabase.from('finance_report_notes').upsert(catatan, { onConflict: 'period,section' })
  if (eCat) return { error: eCat.message || 'Gagal menyimpan keterangan.' }

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
