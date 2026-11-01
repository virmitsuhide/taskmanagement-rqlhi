/**
 * Draf narasi laporan keuangan — ditulis dari angka, meniru gaya laporan BPH
 * September 2026. Draf hanya titik awal: bendahara/Kepala RQ menyuntingnya di
 * halaman laporan, dan yang tersimpan (finance_report_notes) selalu menang.
 *
 * Alasan di balik angka (gaji ke-13, program ditiadakan, pelunasan piutang)
 * tidak bisa ditebak dari angka; yang bisa, diambil dari keterangan pos yang
 * diisi bendahara.
 */

import type { FinanceData } from './report'
import { buildBudgetRows, buildPiutangBulan, buildTrend, buildTrustFunds, monthlyTotals } from './report'
import { KPI_TARGETS } from './kpi'
import { type PeriodKey, formatAngka, monthName, shiftPeriod } from './period'

/** Kunci bagian narasi (finance_report_notes.section) beserta bentuknya. */
export const BAGIAN_NARASI = {
  sorotan: { judul: 'Sorotan Utama', poin: true },
  catatan_pemasukan: { judul: 'Analisis diagram pemasukan', poin: false },
  catatan_pengeluaran: { judul: 'Analisis diagram pengeluaran', poin: false },
  catatan_titipan: { judul: 'Catatan Dana Titipan', poin: true },
  evaluasi_anggaran: { judul: 'Evaluasi Anggaran', poin: true },
  ringkasan_kpi: { judul: 'Ringkasan KPI', poin: true },
  analisis_tren: { judul: 'Analisis tren bulanan', poin: false },
  analisis_komposisi: { judul: 'Analisis komposisi pemasukan', poin: false },
  analisis_mandiri: { judul: 'Analisis mandiri vs subsidi', poin: false },
  analisis_sumber: { judul: 'Analisis tren per sumber', poin: false },
  analisis_pengeluaran_tren: { judul: 'Analisis komposisi pengeluaran', poin: false },
  analisis_kpi_tren: { judul: 'Analisis tren KPI', poin: false },
} as const

export type BagianNarasi = keyof typeof BAGIAN_NARASI

const rp = (n: number) => `Rp${formatAngka(n)}`
const jt = (n: number) => `Rp${(n / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} jt`
const jt1 = (n: number) => `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
const pc = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const ubah = (kini: number, lalu: number) => (lalu ? Math.round(((kini - lalu) / lalu) * 1000) / 10 : 0)

export function drafNarasi(data: FinanceData, period: PeriodKey): Record<BagianNarasi, string> {
  const nama = (kind: 'pemasukan' | 'pengeluaran', slug: string) =>
    data.accounts.find(a => a.kind === kind && a.slug === slug)?.name ?? slug
  const bulan = monthName(period)
  const prevKey = shiftPeriod(period, -1)
  const namaLalu = monthName(prevKey)
  const m = monthlyTotals(data, period)
  const p = monthlyTotals(data, prevKey)
  const adaLalu = p.terisi
  const trend = buildTrend(data, period).filter(t => t.terisi)
  const piutang = buildPiutangBulan(data, period)
  const bIn = buildBudgetRows(data, period, 'pemasukan')
  const bOut = buildBudgetRows(data, period, 'pengeluaran')

  const urutMasuk = Object.entries(m.pemasukan).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const urutKeluar = Object.entries(m.pengeluaran).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

  // ── 1.1 Sorotan ──
  const sorotan: string[] = []
  if (adaLalu) {
    const d = ubah(m.subsidi, p.subsidi)
    sorotan.push(`Subsidi Yayasan ${d < 0 ? 'turun' : 'naik'} menjadi ${rp(m.subsidi)} (${pc(m.subsidiPercent)} dari pemasukan), ${d < 0 ? 'turun' : 'naik'} ${pc(Math.abs(d))} dari ${namaLalu} (${rp(p.subsidi)}). Rasio subsidi ${m.subsidiPercent < KPI_TARGETS.rasioSubsidi.value ? 'memenuhi' : 'belum memenuhi'} target < ${KPI_TARGETS.rasioSubsidi.value}%.`)
  } else {
    sorotan.push(`Subsidi Yayasan ${rp(m.subsidi)} (${pc(m.subsidiPercent)} dari pemasukan); target < ${KPI_TARGETS.rasioSubsidi.value}%.`)
  }
  let naikBeruntun = 1
  for (let i = trend.length - 1; i > 0 && trend[i].kemandirian > trend[i - 1].kemandirian; i--) naikBeruntun++
  const deret = trend.slice(-Math.min(naikBeruntun, 4)).map(t => `${pc(t.kemandirian)} (${monthName(t.period)})`).join(', ')
  sorotan.push(`Rasio kemandirian ${pc(m.kemandirian)} (target ≥ ${KPI_TARGETS.rasioMandiri.value}%)${naikBeruntun >= 3 ? ` — naik ${naikBeruntun} bulan berturut-turut: ${deret}` : adaLalu ? ` — ${m.kemandirian >= p.kemandirian ? 'naik' : 'turun'} dari ${pc(p.kemandirian)} (${namaLalu})` : ''}.`)
  const adaPiutang = Object.entries(piutang).filter(([, v]) => v.amount > 0)
  sorotan.push(adaPiutang.length
    ? `Piutang belum diterima: ${adaPiutang.map(([s, v]) => `${nama('pemasukan', s)} ${rp(v.amount)}`).join(', ')}.`
    : 'Tidak ada piutang yang belum diterima pada bulan ini.')
  sorotan.push(`Beban Gaji Tetap/Tidak Tetap YYS ${rp(m.gajiYys)} (${pc(m.porsiGaji)} dari pengeluaran) ${m.porsiGaji < KPI_TARGETS.porsiGajiYys.value ? 'memenuhi' : 'masih di atas'} target < ${KPI_TARGETS.porsiGajiYys.value}%.`)

  // ── 1.2.2 Pemasukan ──
  const pemasukan: string[] = []
  if (urutMasuk.length) {
    const [s0, v0] = urutMasuk[0]
    pemasukan.push(`${nama('pemasukan', s0)} menjadi kontributor pemasukan terbesar bulan ${bulan} (${pc(pct(v0, m.income))}, ${rp(v0)})${urutMasuk.length > 1 ? `, disusul ${urutMasuk.slice(1, 3).map(([s, v]) => `${nama('pemasukan', s)} ${pc(pct(v, m.income))}`).join(' dan ')}` : ''}.`)
    if (adaLalu) pemasukan.push(`Subsidi Yayasan ${m.subsidiPercent <= p.subsidiPercent ? 'menyusut' : 'membesar'} menjadi ${pc(m.subsidiPercent)} dari ${pc(p.subsidiPercent)} pada ${namaLalu}.`)
    const besar = Object.keys({ ...m.pemasukan, ...p.pemasukan })
      .map(s => ({ s, d: (m.pemasukan[s] ?? 0) - (p.pemasukan[s] ?? 0) }))
      .filter(x => adaLalu && x.s !== 'subsidi_yayasan' && Math.abs(x.d) >= 1_000_000)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2)
    for (const x of besar) pemasukan.push(`${nama('pemasukan', x.s)} ${x.d > 0 ? 'naik' : 'turun'} ${rp(Math.abs(x.d))} dibanding ${namaLalu}.`)
    const nol = data.accounts.filter(a => a.kind === 'pemasukan' && a.is_active && !(m.pemasukan[a.slug] > 0) && !['proposal_yayasan', 'lain_lain'].includes(a.slug))
    if (nol.length) pemasukan.push(`${nol.map(a => a.name).join(', ')} belum memberikan penerimaan pada bulan ini.`)
  }

  // ── 1.3.2 Pengeluaran ──
  const pengeluaran: string[] = []
  if (urutKeluar.length) {
    const [s0, v0] = urutKeluar[0]
    pengeluaran.push(`${nama('pengeluaran', s0)} menjadi pos terbesar (${pc(pct(v0, m.expense))}, ${rp(v0)})${adaLalu && p.pengeluaran[s0] ? `, ${v0 >= p.pengeluaran[s0] ? 'naik' : 'turun'} ${rp(Math.abs(v0 - p.pengeluaran[s0]))} (${ubah(v0, p.pengeluaran[s0]) >= 0 ? '+' : '−'}${pc(Math.abs(ubah(v0, p.pengeluaran[s0])))}) dibanding ${namaLalu}` : ''}.`)
    if (adaLalu) {
      const lain = urutKeluar.slice(1).map(([s, v]) => ({ s, d: v - (p.pengeluaran[s] ?? 0) })).filter(x => x.d !== 0 && x.s !== 'biaya_operasional')
      if (lain.length) pengeluaran.push(lain.map(x => `${nama('pengeluaran', x.s)} ${x.d > 0 ? 'naik' : 'turun'} ${rp(Math.abs(x.d))}`).join(', ') + '.')
    }
    const op = m.pengeluaran.biaya_operasional ?? 0
    if (op) pengeluaran.push(`Biaya operasional ${rp(op)} (${pct(op, m.expense) < 1 ? 'kurang dari 1%' : pc(pct(op, m.expense))} dari total pengeluaran).`)
    if (!(m.pengeluaran.program > 0)) pengeluaran.push('Pos Program tercatat Rp0 pada bulan ini.')
  }

  // ── 1.4 Catatan dana titipan ──
  const titipan = buildTrustFunds(data, period).map(f => {
    const d = f.closing - f.opening
    return d === 0
      ? `${f.name} tidak bergerak (${rp(f.closing)}) karena tidak ada transaksi pada ${bulan}.`
      : `${f.name} ${d > 0 ? 'naik' : 'turun'} ${rp(Math.abs(d))} menjadi ${rp(f.closing)}.`
  })
  if (titipan.length) titipan.push('Dana titipan dicatat terpisah dan tidak dipakai menutup kebutuhan gaji/operasional.')

  // ── 1.5 Evaluasi anggaran ──
  const evaluasi: string[] = []
  if (bIn.totalBudget) {
    evaluasi.push(`Realisasi pemasukan ${jt(bIn.totalActual)} = ${pc(pct(bIn.totalActual, bIn.totalBudget))} dari anggaran ${jt(bIn.totalBudget)}.`)
    for (const r of bIn.rows.filter(r => r.budget > 0 && r.slug !== 'subsidi_yayasan')) {
      const persen = pct(r.actual, r.budget)
      if (Math.abs(persen - 100) >= 10) evaluasi.push(`${r.name} ${jt(r.actual)} (${pc(persen)} dari ${jt(r.budget)})${persen > 100 ? ' — melampaui anggaran.' : ' — di bawah anggaran.'}`)
    }
    const sub = bIn.rows.find(r => r.slug === 'subsidi_yayasan')
    if (sub?.budget) evaluasi.push(`Subsidi Yayasan ${jt(sub.actual)} (${pc(pct(sub.actual, sub.budget))} dari anggaran ${jt(sub.budget)}) — kebutuhan backup Yayasan ${sub.actual <= sub.budget ? 'lebih rendah' : 'lebih tinggi'} ${jt1(Math.abs(sub.budget - sub.actual))} dari perkiraan.`)
  }
  for (const r of bOut.rows.filter(r => r.budget > 0 && r.actual > r.budget * 1.05)) {
    evaluasi.push(`${r.name} melampaui anggaran (${jt(r.actual)} vs ${jt(r.budget)} = ${pc(pct(r.actual, r.budget))}).`)
  }
  for (const r of bOut.rows.filter(r => r.budget > 0 && r.actual === 0)) evaluasi.push(`${r.name} dianggarkan ${jt(r.budget)} tetapi tidak terealisasi.`)
  if (!bIn.totalBudget && !bOut.totalBudget) evaluasi.push('Anggaran bulan ini belum diisi.')

  // ── 1.6 Ringkasan KPI ──
  const ringkasan: string[] = []
  ringkasan.push(adaLalu
    ? `Rasio kemandirian ${m.kemandirian >= p.kemandirian ? 'naik' : 'turun'} dari ${pc(p.kemandirian)} (${namaLalu}) menjadi ${pc(m.kemandirian)} (${bulan}) dan ${m.kemandirian >= KPI_TARGETS.rasioMandiri.value ? 'memenuhi' : 'belum memenuhi'} target ≥ ${KPI_TARGETS.rasioMandiri.value}%.`
    : `Rasio kemandirian ${pc(m.kemandirian)} (target ≥ ${KPI_TARGETS.rasioMandiri.value}%).`)
  if (trend.length >= 2) {
    const dua = trend.slice(-2)
    const sub2 = (dua[0].subsidi + dua[1].subsidi) / 2, in2 = (dua[0].income + dua[1].income) / 2
    ringkasan.push(`Rata-rata dua bulan terakhir (${monthName(dua[0].period)}–${monthName(dua[1].period)}): subsidi Yayasan ${jt1(sub2)}/bulan (${pc(pct(sub2, in2))}), kemandirian ${pc(100 - pct(sub2, in2))}.`)
  }
  ringkasan.push(`Porsi Gaji YYS ${pc(m.porsiGaji)} ${m.porsiGaji < KPI_TARGETS.porsiGajiYys.value ? 'sudah di bawah' : 'masih di atas'} target < ${KPI_TARGETS.porsiGajiYys.value}%.${m.porsiGaji >= KPI_TARGETS.porsiGajiYys.value ? ' Karena gaji YYS bersifat tetap, rasio ini hanya membaik jika total aktivitas dan pemasukan unit bertumbuh.' : ''}`)

  // ── 1.7 & 1.8 Tren ──
  const awal = trend[0], akhir = trend.at(-1)
  const tren: string[] = []
  const komposisi: string[] = []
  const mandiriVs: string[] = []
  const sumber: string[] = []
  const keluarTren: string[] = []
  const kpiTren: string[] = []
  if (awal && akhir && trend.length >= 2) {
    const r = `${monthName(awal.period)} ke ${monthName(akhir.period)}`
    tren.push(`Total pemasukan ${akhir.income >= awal.income ? 'naik' : 'turun'} ${jt1(Math.abs(akhir.income - awal.income))} (${ubah(akhir.income, awal.income) >= 0 ? '+' : '−'}${pc(Math.abs(ubah(akhir.income, awal.income)))}) dari ${r}, pendapatan mandiri ${akhir.mandiri >= awal.mandiri ? 'naik' : 'turun'} dari ${jt1(awal.mandiri)} menjadi ${jt1(akhir.mandiri)}, dan subsidi Yayasan ${akhir.subsidi <= awal.subsidi ? 'turun' : 'naik'} ${jt1(Math.abs(akhir.subsidi - awal.subsidi))}.`)
    const totSub = trend.reduce((n, t) => n + t.subsidi, 0), totIn = trend.reduce((n, t) => n + t.income, 0)
    tren.push(`Rata-rata kebutuhan subsidi ${trend.length} bulan terakhir ${rp(Math.round(totSub / trend.length))}/bulan (${pc(pct(totSub, totIn))}).`)

    komposisi.push(`Porsi subsidi dalam pemasukan bergerak ${trend.map(t => pc(t.subsidiPercent)).join(' → ')} (${trend.map(t => monthName(t.period)).join('–')}).`)
    const unit = Object.keys(akhir.pemasukan).filter(s => s !== 'subsidi_yayasan' && s !== 'proposal_yayasan')
    const tumbuh = unit.map(s => ({ s, a: awal.pemasukan[s] ?? 0, z: akhir.pemasukan[s] ?? 0 }))// Sumber kecil (di bawah 5 jt) tidak dibandingkan: Rp166 rb → Rp2 jt terbaca '+1.118%'.
      .filter(x => x.a >= 5_000_000).sort((x, y) => (y.z / y.a) - (x.z / x.a))
    if (tumbuh[0]) komposisi.push(`${nama('pemasukan', tumbuh[0].s)} ${tumbuh[0].z >= tumbuh[0].a ? 'tumbuh' : 'turun'} ${pc(Math.abs(ubah(tumbuh[0].z, tumbuh[0].a)))} dari ${jt1(tumbuh[0].a)} (${monthName(awal.period)}) ke ${jt1(tumbuh[0].z)} (${monthName(akhir.period)}).`)

    mandiriVs.push(`Porsi subsidi ${trend.map(t => pc(t.subsidiPercent)).join(' → ')}. Dalam rupiah, subsidi ${akhir.subsidi <= awal.subsidi ? 'turun' : 'naik'} dari ${jt1(awal.subsidi)} ke ${jt1(akhir.subsidi)}, sementara pendapatan mandiri ${akhir.mandiri >= awal.mandiri ? 'naik' : 'turun'} dari ${jt1(awal.mandiri)} ke ${jt1(akhir.mandiri)}.`)
    if (akhir.income === akhir.expense) mandiriVs.push('Karena total pemasukan RQ selalu sama dengan pengeluaran, setiap Rp1 jt tambahan pendapatan mandiri langsung mengurangi Rp1 jt kebutuhan subsidi.')

    const dua = urutMasuk.filter(([s]) => s !== 'subsidi_yayasan').slice(0, 2)
    if (dua.length === 2) sumber.push(`${dua.map(([s]) => nama('pemasukan', s)).join(' dan ')} adalah tulang punggung pemasukan mandiri (keduanya ${jt1(dua[0][1] + dua[1][1])}, atau ${pc(pct(dua[0][1] + dua[1][1], m.mandiri))} dari pendapatan mandiri ${bulan}).`)
    const fluktuatif = unit.filter(s => trend.reduce((n, t) => n + (t.pemasukan[s] ?? 0), 0) / trend.length >= 5_000_000).map(s => {
      const xs = trend.map(t => t.pemasukan[s] ?? 0)
      const rata = xs.reduce((a, b) => a + b, 0) / xs.length
      return { s, cv: rata ? Math.sqrt(xs.reduce((a, b) => a + (b - rata) ** 2, 0) / xs.length) / rata : 0 }
    }).sort((a, b) => b.cv - a.cv)[0]
    if (fluktuatif) sumber.push(`${nama('pemasukan', fluktuatif.s)} paling fluktuatif antar bulan.`)

    const rataKeluar = trend.reduce((n, t) => n + t.expense, 0) / trend.length
    keluarTren.push(`Pengeluaran ${trend.map(t => `${monthName(t.period)} ${jt1(t.expense)}`).join(', ')}; rata-rata ${jt1(rataKeluar)}/bulan. Gaji YYS ${trend.map(t => pc(t.porsiGaji)).join(' → ')} dari total pengeluaran.`)
    keluarTren.push(`Basis biaya riil RQ ±${jt1(rataKeluar)}/bulan — titik impas tanpa subsidi membutuhkan pemasukan mandiri sebesar itu.`)

    kpiTren.push(`Rasio kemandirian ${trend.map(t => pc(t.kemandirian)).join(' → ')} (target ≥ ${KPI_TARGETS.rasioMandiri.value}%); porsi Gaji YYS ${trend.map(t => pc(t.porsiGaji)).join(' → ')} (target < ${KPI_TARGETS.porsiGajiYys.value}%).`)
    if (m.porsiGaji >= KPI_TARGETS.porsiGajiYys.value && m.gajiYys) {
      const perlu = m.gajiYys / (KPI_TARGETS.porsiGajiYys.value / 100)
      kpiTren.push(`Untuk menembus target dengan gaji YYS tetap ${jt1(m.gajiYys)}, total pengeluaran/pemasukan RQ harus ≥ ${jt1(perlu)} (tumbuh ±${jt1(perlu - m.expense)}) — pertumbuhan aktivitas unit, bukan pemangkasan gaji, yang menjadi solusinya.`)
    }
  } else {
    const kosong = 'Tren baru bisa dianalisis setelah ada isian minimal dua bulan.'
    tren.push(kosong); komposisi.push(kosong); mandiriVs.push(kosong); sumber.push(kosong); keluarTren.push(kosong); kpiTren.push(kosong)
  }

  return {
    sorotan: sorotan.join('\n'),
    catatan_pemasukan: pemasukan.join(' '),
    catatan_pengeluaran: pengeluaran.join(' '),
    catatan_titipan: titipan.join('\n'),
    evaluasi_anggaran: evaluasi.join('\n'),
    ringkasan_kpi: ringkasan.join('\n'),
    analisis_tren: tren.join(' '),
    analisis_komposisi: komposisi.join(' '),
    analisis_mandiri: mandiriVs.join(' '),
    analisis_sumber: sumber.join(' '),
    analisis_pengeluaran_tren: keluarTren.join(' '),
    analisis_kpi_tren: kpiTren.join(' '),
  }
}
