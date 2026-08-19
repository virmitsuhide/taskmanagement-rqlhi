/**
 * Indikator Kinerja Keuangan (bab 1.7) — dihitung dari akumulasi Januari
 * sampai bulan terpilih, bukan dari bulan berjalan saja. Rasio satu bulan
 * terlalu berisik untuk dijadikan dasar keputusan: April 2026 terlihat sangat
 * mandiri (subsidi 9,3%) padahal Februari 46,5%. Akumulasi meratakan lonjakan
 * piutang yang cair belakangan.
 */

import type { FinanceData } from './report'
import { YAYASAN_SLUGS, buildTrend, settledIn } from './report'
import { type PeriodKey, formatRupiah, percentOf1, periodsYearToDate, toPeriodKey } from './period'

/** Target yang disepakati BPH. Diubah di satu tempat ini saja. */
export const KPI_TARGETS = {
  /** Rasio subsidi Yayasan terhadap total pemasukan — makin kecil makin baik. */
  rasioSubsidi: { direction: 'max' as const, value: 15 },
  /** Rasio pendapatan mandiri terhadap total pemasukan. */
  rasioMandiri: { direction: 'min' as const, value: 85 },
  /** Porsi gaji tetap Yayasan terhadap total pengeluaran. */
  porsiGajiYys: { direction: 'max' as const, value: 40 },
}

export type KpiStatus = 'info' | 'aman' | 'pantau' | 'perlu_naik' | 'kritis'

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
}

/**
 * Seberapa jauh sebuah rasio boleh meleset dari target sebelum disebut
 * kritis — diukur dalam poin persen, bukan persentase relatif.
 *
 * Ukuran poin dipilih karena begitulah BPH membaca angkanya: "porsi gaji
 * 46,7% padahal targetnya 40%" dibaca sebagai meleset 6,7 poin, bukan
 * meleset 17% dari target. Ambang relatif akan menghasilkan batas kritis
 * yang berbeda-beda per indikator (pada target 40% baru kritis di 48%,
 * padahal 46,7% sudah dianggap kritis oleh BPH).
 */
export const KPI_TOLERANSI_POIN = 5

/**
 * Menentukan status sebuah rasio terhadap targetnya — tiga band:
 *
 *   memenuhi target                  → AMAN
 *   meleset s.d. 5 poin              → PANTAU (target 'max') / PERLU NAIK ↑ (target 'min')
 *   meleset lebih dari 5 poin        → KRITIS ⚠
 *
 * Band tengah dibedakan menurut arah target supaya labelnya terbaca wajar:
 * rasio yang kebesaran perlu "dipantau", rasio yang kekecilan perlu "dinaikkan".
 *
 * @param value  nilai rasio aktual, dalam persen
 * @param target target beserta arahnya ('max' = tidak boleh lebih dari)
 */
export function evaluateStatus(value: number, target: KpiTarget): KpiStatus {
  const gap = target.direction === 'max' ? value - target.value : target.value - value
  if (gap <= 0) return 'aman'
  if (gap > KPI_TOLERANSI_POIN) return 'kritis'
  return target.direction === 'max' ? 'pantau' : 'perlu_naik'
}

export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  info: 'INFO',
  aman: 'AMAN',
  pantau: 'PANTAU',
  perlu_naik: 'PERLU NAIK ↑',
  kritis: 'KRITIS ⚠',
}

/**
 * Sepuluh indikator tabel 1.7, urut seperti di laporan cetak.
 */
export function buildKpi(data: FinanceData, period: PeriodKey): KpiMetric[] {
  const months = periodsYearToDate(period)
  const trend = buildTrend(data, period)

  const income = trend.reduce((t, m) => t + m.income, 0)
  const expense = trend.reduce((t, m) => t + m.expense, 0)
  const subsidi = trend.reduce((t, m) => t + m.subsidi, 0)
  const mandiri = income - subsidi

  const rasioSubsidi = percentOf1(subsidi, income)
  const rasioMandiri = percentOf1(mandiri, income)

  // Beban gaji tetap Yayasan — fixed cost terbesar dan satu-satunya pos yang
  // tidak bisa ditekan dari sisi RQ, jadi dipantau terpisah dari total gaji.
  const gajiAccount = data.accounts.find(a => a.kind === 'pengeluaran' && a.slug === 'gaji_yys')
  const bebanGaji = gajiAccount
    ? months.reduce(
        (total, p) =>
          total +
          settledIn(data.transactions, p)
            .filter(t => t.account_id === gajiAccount.id)
            .reduce((s, t) => s + t.amount, 0),
        0,
      )
    : 0
  const porsiGaji = percentOf1(bebanGaji, expense)

  const rentang = `Akumulasi ${months.length} bulan (Jan–${monthShort(period)})`

  return [
    {
      id: 'total_pemasukan', label: `Total Pemasukan (${months.length} bulan)`,
      value: income, display: formatRupiah(income), note: rentang, status: 'info',
    },
    {
      id: 'total_pengeluaran', label: `Total Pengeluaran (${months.length} bulan)`,
      value: expense, display: formatRupiah(expense), note: rentang, status: 'info',
    },
    {
      id: 'total_subsidi', label: 'Total Subsidi Yayasan',
      value: subsidi, display: formatRupiah(subsidi),
      note: 'Backup keuangan dari Yayasan', status: 'pantau',
    },
    {
      id: 'rasio_subsidi', label: 'Rasio Subsidi thd Pemasukan',
      value: rasioSubsidi, display: `${rasioSubsidi.toLocaleString('id-ID')}%`,
      note: `Target: < ${KPI_TARGETS.rasioSubsidi.value}%`,
      target: KPI_TARGETS.rasioSubsidi,
      status: evaluateStatus(rasioSubsidi, KPI_TARGETS.rasioSubsidi),
    },
    {
      id: 'pendapatan_mandiri', label: 'Pendapatan Mandiri (non-subsidi)',
      value: mandiri, display: formatRupiah(mandiri),
      note: 'Pemasukan tanpa backup YYS', status: 'info',
    },
    {
      id: 'rasio_mandiri', label: 'Rasio Mandiri',
      value: rasioMandiri, display: `${rasioMandiri.toLocaleString('id-ID')}%`,
      note: `Target: ≥ ${KPI_TARGETS.rasioMandiri.value}%`,
      target: KPI_TARGETS.rasioMandiri,
      status: evaluateStatus(rasioMandiri, KPI_TARGETS.rasioMandiri),
    },
    {
      id: 'beban_gaji', label: 'Beban Gaji Tetap YYS',
      value: bebanGaji, display: formatRupiah(bebanGaji),
      note: 'Fixed cost terbesar', status: 'pantau',
    },
    {
      id: 'porsi_gaji', label: 'Porsi Gaji YYS thd Pengeluaran',
      value: porsiGaji, display: `${porsiGaji.toLocaleString('id-ID')}%`,
      note: `Target: < ${KPI_TARGETS.porsiGajiYys.value}%`,
      target: KPI_TARGETS.porsiGajiYys,
      status: evaluateStatus(porsiGaji, KPI_TARGETS.porsiGajiYys),
    },
    {
      id: 'gap_mandiri', label: 'Gap Mandiri vs Pengeluaran',
      value: Math.max(expense - mandiri, 0), display: formatRupiah(Math.max(expense - mandiri, 0)),
      note: 'Besaran subsidi yang masih dibutuhkan', status: 'pantau',
    },
    {
      id: 'rata_subsidi', label: 'Rata-rata Subsidi per Bulan',
      value: months.length ? subsidi / months.length : 0,
      display: formatRupiah(months.length ? subsidi / months.length : 0),
      note: 'Rata-rata kebutuhan subsidi/bulan', status: 'info',
    },
  ]
}

function monthShort(period: PeriodKey): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return names[Number(toPeriodKey(period).split('-')[1]) - 1] ?? period
}

/** Dipakai UI untuk mewarnai baris & lencana status. */
export const KPI_STATUS_CLASS: Record<KpiStatus, string> = {
  info: 'bg-muted text-muted-foreground',
  aman: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pantau: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  perlu_naik: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  kritis: 'bg-destructive/10 text-destructive',
}

export { YAYASAN_SLUGS }
