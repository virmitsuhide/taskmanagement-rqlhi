/**
 * Indikator Kinerja Keuangan (bab 1.6 laporan BPH) — BULAN BERJALAN, dengan
 * pembanding bulan lalu, mengikuti laporan September 2026. Tren beberapa
 * bulan dibaca di tabel 1.7 dan diagram 1.8.5, jadi tabel KPI tidak perlu
 * lagi berupa akumulasi.
 */

import type { FinanceData } from './report'
import { YAYASAN_SLUGS, buildSumberDana, monthlyTotals } from './report'
import { type PeriodKey, formatAngka, formatJuta1, monthName, shiftPeriod } from './period'
import { SUBSIDI } from './alokasi'

/** Target yang disepakati BPH. Diubah di satu tempat ini saja. */
export const KPI_TARGETS = {
  /** Rasio subsidi Yayasan terhadap total pemasukan — makin kecil makin baik. */
  rasioSubsidi: { direction: 'max' as const, value: 15 },
  /** Rasio pendapatan mandiri terhadap total pemasukan. */
  rasioMandiri: { direction: 'min' as const, value: 85 },
  /** Porsi gaji tetap Yayasan terhadap total pengeluaran. */
  porsiGajiYys: { direction: 'max' as const, value: 40 },
}

export type KpiStatus = 'info' | 'aman' | 'membaik' | 'pantau' | 'perlu_naik' | 'kritis'

export interface KpiTarget {
  direction: 'max' | 'min'
  value: number
}

export interface KpiMetric {
  id: string
  label: string
  /** Sudah diformat siap tampil (rupiah atau persen). */
  display: string
  /** Nilai mentah — persen untuk rasio, rupiah untuk nominal. */
  value: number
  note: string
  target?: KpiTarget
  status: KpiStatus
  /** Baris yang ditebalkan di tabel (beban gaji YYS & porsinya). */
  tebal?: boolean
}

/**
 * Seberapa jauh sebuah rasio boleh meleset dari target sebelum disebut
 * kritis — dalam poin persen, sebagaimana BPH membaca angkanya.
 */
export const KPI_TOLERANSI_POIN = 5

/**
 *   memenuhi target              → TERCAPAI ✓
 *   meleset s.d. 5 poin          → PANTAU ⚠ (target 'max') / PERLU NAIK ↑ (target 'min')
 *   meleset lebih dari 5 poin    → KRITIS ⚠
 */
export function evaluateStatus(value: number, target: KpiTarget): KpiStatus {
  const gap = target.direction === 'max' ? value - target.value : target.value - value
  if (gap <= 0) return 'aman'
  if (gap > KPI_TOLERANSI_POIN) return 'kritis'
  return target.direction === 'max' ? 'pantau' : 'perlu_naik'
}

export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  info: 'INFO',
  aman: 'TERCAPAI ✓',
  membaik: 'MEMBAIK ↓',
  pantau: 'PANTAU ⚠',
  perlu_naik: 'PERLU NAIK ↑',
  kritis: 'KRITIS ⚠',
}

const persen = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`

/** '−64,9% vs Agustus' — kosong bila bulan lalu belum ada isinya. */
function vsLalu(kini: number, lalu: number | null, namaLalu: string): string {
  if (lalu === null || lalu === 0) return ''
  const d = ((kini - lalu) / lalu) * 100
  return `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% vs ${namaLalu}`
}

export function buildKpi(data: FinanceData, period: PeriodKey): KpiMetric[] {
  const m = monthlyTotals(data, period)
  const prevKey = shiftPeriod(period, -1)
  const prev = monthlyTotals(data, prevKey)
  const adaLalu = prev.terisi
  const namaLalu = monthName(prevKey)
  const bulan = monthName(period)

  const rasioSubsidi = m.subsidiPercent
  const alokasi = buildSumberDana(data, period)
  const gajiDariUnit = Object.entries(alokasi.matriks.gaji_yys ?? {})
    .filter(([s]) => s !== SUBSIDI && !(YAYASAN_SLUGS as readonly string[]).includes(s))
    .reduce((n, [, v]) => n + v, 0)
  const unitPenyumbang = Object.entries(alokasi.matriks.gaji_yys ?? {})
    .filter(([s, v]) => v > 0 && s !== SUBSIDI && !(YAYASAN_SLUGS as readonly string[]).includes(s))
    .map(([s]) => data.accounts.find(a => a.kind === 'pemasukan' && a.slug === s)?.name ?? s)

  const gabung = (...xs: string[]) => xs.filter(Boolean).join('; ')

  return [
    { id: 'total_pemasukan', label: `Total Pemasukan (${bulan})`, value: m.income, display: formatAngka(m.income), note: `Kas masuk bulan ${bulan}`, status: 'info' },
    { id: 'total_pengeluaran', label: `Total Pengeluaran (${bulan})`, value: m.expense, display: formatAngka(m.expense), note: `Kas keluar bulan ${bulan}`, status: 'info' },
    {
      id: 'subsidi', label: 'Subsidi Yayasan', value: m.subsidi, display: formatAngka(m.subsidi),
      note: gabung('Backup keuangan dari Yayasan', vsLalu(m.subsidi, adaLalu ? prev.subsidi : null, namaLalu)),
      status: adaLalu && m.subsidi < prev.subsidi ? 'membaik' : 'pantau',
    },
    {
      id: 'rasio_subsidi', label: 'Rasio Subsidi thd Pemasukan', value: rasioSubsidi, display: persen(rasioSubsidi),
      note: `Target < ${KPI_TARGETS.rasioSubsidi.value}%`, target: KPI_TARGETS.rasioSubsidi,
      status: evaluateStatus(rasioSubsidi, KPI_TARGETS.rasioSubsidi),
    },
    { id: 'pendapatan_mandiri', label: 'Pendapatan Mandiri (non-subsidi)', value: m.mandiri, display: formatAngka(m.mandiri), note: 'Pemasukan tanpa backup YYS', status: 'info' },
    {
      id: 'rasio_mandiri', label: 'Rasio Kemandirian', value: m.kemandirian, display: persen(m.kemandirian),
      note: `Target ≥ ${KPI_TARGETS.rasioMandiri.value}%`, target: KPI_TARGETS.rasioMandiri,
      status: evaluateStatus(m.kemandirian, KPI_TARGETS.rasioMandiri),
    },
    {
      id: 'beban_gaji', label: 'Beban Gaji Tetap/Tidak Tetap YYS', value: m.gajiYys, display: formatAngka(m.gajiYys), tebal: true,
      note: gabung('Fixed cost terbesar', vsLalu(m.gajiYys, adaLalu ? prev.gajiYys : null, namaLalu)),
      status: adaLalu && m.gajiYys < prev.gajiYys ? 'membaik' : 'pantau',
    },
    {
      id: 'porsi_gaji', label: 'Porsi Gaji YYS thd Pengeluaran', value: m.porsiGaji, display: persen(m.porsiGaji), tebal: true,
      note: `Target < ${KPI_TARGETS.porsiGajiYys.value}%`, target: KPI_TARGETS.porsiGajiYys,
      status: evaluateStatus(m.porsiGaji, KPI_TARGETS.porsiGajiYys),
    },
    {
      id: 'subsidi_silang', label: 'Gaji YYS dibiayai Subsidi Silang Unit',
      value: m.gajiYys ? (gajiDariUnit / m.gajiYys) * 100 : 0,
      display: persen(m.gajiYys ? Math.round((gajiDariUnit / m.gajiYys) * 1000) / 10 : 0),
      note: gajiDariUnit ? `${formatJuta1(gajiDariUnit).replace('Rp ', 'Rp')} dari surplus ${unitPenyumbang.join(', ')}` : 'Seluruhnya dari subsidi Yayasan',
      status: 'info',
    },
  ]
}

/** Dipakai UI layar untuk mewarnai lencana status. */
export const KPI_STATUS_CLASS: Record<KpiStatus, string> = {
  info: 'bg-muted text-muted-foreground',
  aman: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  membaik: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pantau: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  perlu_naik: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  kritis: 'bg-destructive/10 text-destructive',
}

export { YAYASAN_SLUGS }
