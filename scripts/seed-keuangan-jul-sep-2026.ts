/**
 * Isian keuangan Juli–September 2026, disalin dari Laporan Eksekutif BPH
 * (Juli & September .pdf, Agustus .docx) — supaya Laporan BPH dari aplikasi bisa
 * dibandingkan langsung dengan laporan yang sudah dikirim, dan tren 1.7–1.8
 * punya bulan pembanding. Idempoten: data dua bulan itu diganti utuh.
 *
 * Angkanya ada di scripts/data/keuangan-jul-sep-2026.ts — sengaja tidak di-commit
 * (scripts/data/ di .gitignore; laporan keuangan berklasifikasi TERBATAS).
 *
 * Jalankan: npx tsx --env-file=.env.local scripts/seed-keuangan-jul-sep-2026.ts
 */
import { createClient } from '@supabase/supabase-js'

type Bulan = {
  periode: string
  akhir: string
  pemasukan: Record<string, [number, string]>
  pengeluaran: Record<string, [number, string]>
  piutang: Record<string, number>
  anggaranMasuk: Record<string, number>
  anggaranKeluar: Record<string, number>
  titipan: Record<string, [string, number][]>
}

// Dimuat saat dijalankan, bukan `import` statis: berkasnya tidak ada di git
// (dan di build Vercel), jadi pemeriksaan TypeScript build tidak boleh
// mencarinya. Jalur lewat variabel supaya tsc tidak menelusurinya.
const berkasData = './data/keuangan-jul-sep-2026'
const { AGUSTUS, JULI, SALDO_AWAL_TITIPAN: SA, SEPTEMBER } = (await import(berkasData)) as {
  JULI: Bulan; AGUSTUS: Bulan; SEPTEMBER: Bulan
  SALDO_AWAL_TITIPAN: { tanggal: string; lain_lain: number; program_liburan: number; sd: number }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function cek<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, apa: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${apa}: ${error.message}`)
  return data
}

const { data: akun } = await sb.from('finance_accounts').select('id, kind, slug')
const id = (kind: string, slug: string) => {
  const a = (akun ?? []).find(x => x.kind === kind && x.slug === slug)
  if (!a) throw new Error(`pos ${kind}/${slug} tidak ada`)
  return a.id as string
}

// ── Buku dana titipan: saldo awal per 1 Agustus 2026 ──
await cek(sb.from('finance_trust_funds').update({ opening_balance: SA.lain_lain, opening_date: SA.tanggal }).eq('slug', 'lain_lain'), 'titipan lain-lain')
await cek(sb.from('finance_trust_funds').update({ opening_balance: SA.program_liburan, opening_date: SA.tanggal }).eq('slug', 'program_liburan'), 'titipan liburan')
await cek(sb.from('finance_trust_funds').upsert(
  { slug: 'sd', name: 'Dana Titipan SD', opening_balance: SA.sd, opening_date: SA.tanggal, display_order: 3, is_active: true },
  { onConflict: 'slug' },
), 'titipan SD')
const { data: buku } = await sb.from('finance_trust_funds').select('id, slug')
const bukuId = (slug: string) => buku!.find(b => b.slug === slug)!.id as string

for (const b of [JULI, AGUSTUS, SEPTEMBER]) {
  const periodDate = `${b.periode}-01`
  // Ganti utuh: transaksi, anggaran, keterangan, dan mutasi titipan bulan ini.
  await cek(sb.from('finance_transactions').delete().gte('paid_at', periodDate).lte('paid_at', b.akhir), 'hapus lunas')
  await cek(sb.from('finance_transactions').delete().eq('status', 'piutang').eq('period', periodDate), 'hapus piutang')
  await cek(sb.from('finance_trust_entries').delete().gte('entry_date', periodDate).lte('entry_date', b.akhir), 'hapus titipan')

  const trx = [
    ...Object.entries(b.pemasukan).filter(([, [v]]) => v > 0).map(([s, [v, k]]) => ({ account_id: id('pemasukan', s), period: periodDate, amount: v, description: k, status: 'lunas', paid_at: b.akhir })),
    ...Object.entries(b.pengeluaran).filter(([, [v]]) => v > 0).map(([s, [v, k]]) => ({ account_id: id('pengeluaran', s), period: periodDate, amount: v, description: k, status: 'lunas', paid_at: b.akhir })),
    ...Object.entries(b.piutang).map(([s, v]) => ({ account_id: id('pemasukan', s), period: periodDate, amount: v, description: b.pemasukan[s][1], status: 'piutang', paid_at: null })),
  ]
  await cek(sb.from('finance_transactions').insert(trx), 'isi transaksi')

  const ket = [
    ...Object.entries(b.pemasukan).map(([s, [, k]]) => ({ period: periodDate, section: `ket_pemasukan_${s}`, content: k })),
    ...Object.entries(b.pengeluaran).map(([s, [, k]]) => ({ period: periodDate, section: `ket_pengeluaran_${s}`, content: k })),
  ]
  await cek(sb.from('finance_report_notes').upsert(ket, { onConflict: 'period,section' }), 'keterangan')

  const anggaran = [
    ...Object.keys(b.pemasukan).map(s => ({ account_id: id('pemasukan', s), period: periodDate, amount: b.anggaranMasuk[s] ?? 0 })),
    ...Object.keys(b.pengeluaran).map(s => ({ account_id: id('pengeluaran', s), period: periodDate, amount: b.anggaranKeluar[s] ?? 0 })),
  ]
  await cek(sb.from('finance_budgets').upsert(anggaran, { onConflict: 'account_id,period' }), 'anggaran')

  const mutasi = Object.entries(b.titipan).flatMap(([slug, xs]) => xs.map(([desc, amount]) => ({ fund_id: bukuId(slug), entry_date: b.akhir, description: desc, amount })))
  // Satu per satu supaya urutan masuk (created_at) sama dengan urutan di laporan.
  for (const x of mutasi) await cek(sb.from('finance_trust_entries').insert(x), 'mutasi titipan')
  console.log(`${b.periode}: ${trx.length} baris isian, ${mutasi.length} mutasi titipan`)
}

// Rencana program bulan berikutnya (laporan Juli 2.1 & Agustus 1.9).
await cek(sb.from('finance_program_plans').delete().in('period', ['2026-08-01', '2026-09-01']), 'hapus rencana')
await cek(sb.from('finance_program_plans').insert([
  { period: '2026-08-01', name: 'Podcast konten youtube LHI Official', funding_source: 'RQ (dari iuran SD)', amount: 50000 },
  { period: '2026-08-01', name: 'Pembuatan banner kegiatan', funding_source: 'RQ (dari iuran SD)', amount: 215000 },
  { period: '2026-08-01', name: 'Pemeriksaan kesehatan Pegawai YYS', funding_source: 'Subsidi Yayasan', amount: 400000 },
  { period: '2026-09-01', name: 'Munaqosyah SD', funding_source: 'Proposal SD', amount: 10702000 },
]), 'rencana')
console.log('selesai')
