/**
 * Periode keuangan = satu bulan kalender.
 *
 * Di database periode selalu disimpan sebagai tanggal 1 ('2026-04-01') supaya
 * pengelompokan cukup dengan kesamaan nilai. Di URL dan di kode kita pakai
 * bentuk pendek 'YYYY-MM' karena lebih enak dibaca dan tidak bisa keliru
 * dianggap "tanggal kejadian". Dua helper di bawah menjembatani keduanya.
 *
 * Semua perhitungan sengaja memakai aritmetika string/angka, bukan objek Date.
 * `new Date('2026-04-01')` diurai sebagai UTC lalu digeser ke zona waktu lokal
 * — di WIB itu masih 1 April, tapi di zona barat GMT ia mundur jadi 31 Maret
 * dan seluruh laporan bergeser sebulan. Menghindari Date menutup celah itu.
 */

/** Bentuk pendek periode, mis. '2026-04'. */
export type PeriodKey = string

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

/** '2026-04' → '2026-04-01' (bentuk yang disimpan di kolom period). */
export function toPeriodDate(key: PeriodKey): string {
  return `${key}-01`
}

/** '2026-04-01' → '2026-04'. Aman juga untuk masukan yang sudah pendek. */
export function toPeriodKey(date: string): PeriodKey {
  return date.slice(0, 7)
}

/** '2026-04' → 'April 2026'. */
export function formatPeriod(key: PeriodKey): string {
  const [year, month] = key.split('-')
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`
}

/** Nama bulan saja, mis. 'April' — untuk header kolom tabel rekap. */
export function monthName(key: PeriodKey): string {
  return MONTH_NAMES[Number(key.split('-')[1]) - 1] ?? key
}

export function periodYear(key: PeriodKey): number {
  return Number(key.split('-')[0])
}

/** Geser periode n bulan (n boleh negatif). */
export function shiftPeriod(key: PeriodKey, months: number): PeriodKey {
  const [year, month] = key.split('-').map(Number)
  // Hitung dalam "indeks bulan absolut" supaya tidak perlu urusan carry manual.
  const abs = year * 12 + (month - 1) + months
  const y = Math.floor(abs / 12)
  const m = abs - y * 12 + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Periode berjalan menurut jam server. */
export function currentPeriod(): PeriodKey {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Validasi bentuk 'YYYY-MM' dengan bulan 01–12. */
export function isValidPeriod(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) return false
  const month = Number(key.slice(5))
  return month >= 1 && month <= 12
}

/**
 * Deret periode dari Januari tahun yang sama sampai periode terpilih —
 * kolom-kolom tabel Rekapitulasi (1.6) dan Tren Bulanan (1.8).
 */
export function periodsYearToDate(key: PeriodKey): PeriodKey[] {
  const year = periodYear(key)
  const last = Number(key.split('-')[1])
  return Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

/** Rp 36.199.033 — format yang dipakai di seluruh tabel laporan. */
export function formatRupiah(amount: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(amount))}`
}

/** 36.199.033 tanpa prefiks — untuk sel tabel yang kolomnya sudah bertajuk (Rp). */
export function formatAngka(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount))
}

/** 'Rp 85,87 Jt' — ringkasan kartu, mengikuti gaya penulisan laporan. */
export function formatJuta(amount: number): string {
  return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Jt`
}

/**
 * Persentase bagian terhadap total, dibulatkan ke bilangan bulat seperti di
 * laporan. Total nol menghasilkan 0, bukan NaN — kolom % pada bulan yang belum
 * ada datanya harus tetap tampil sebagai angka.
 */
export function percentOf(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** Versi satu angka di belakang koma — dipakai tabel yang menulis '46,7%'. */
export function percentOf1(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
