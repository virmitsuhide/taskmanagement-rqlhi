import type { Jenjang } from '@/types'

/**
 * Parameter perhitungan KPI — salinan tab "Panduan" pada kedua berkas rubrik:
 *   • KPI_Bulanan_Guru_SD_RQ_LHI_TA20262027.xlsx
 *   • KPI_Bulanan_Guru_SMP_RQ_LHI_TA20262027.xlsx
 *
 * Angka-angka ini sengaja dikumpulkan di satu berkas, bukan ditebar sebagai
 * bilangan telanjang di dalam rumus. Di Excel semuanya menunjuk ke sel Panduan
 * ($B$14, $B$15, …) supaya bisa diubah di satu tempat; sifat itu ikut dibawa ke
 * sini. Kalau unit mengubah target hafalan, yang disunting cuma berkas ini.
 *
 * Nama tiap tetapan diberi keterangan sel asalnya supaya bisa ditelusuri balik
 * ke spreadsheet saat ada yang meragukan angkanya.
 */
export interface KpiParam {
  targetJuz: number
  halamanPerJuz: number
  basisHafalan: number
  poinPerJuz: number
  poinPerHalaman: number
  poinBaitPertama: number
  poinBaitBerikutnya: number
  totalBait: number
  mingguEfektif: number
  hariPerMinggu: number
  hariPenilaian: number
  poinSeragamPerHari: number
  poinLaporOrtuPerHari: number
  basisLaporOrtu: number
  pertemuanHalaqoh: number
  poinHadirHalaqoh: number
  poinAkhiriHalaqoh: number
  basisHalaqoh: number
  basisBukuPegangan: number
  poinPerPertemuanBuku: number
  pertemuanBukuPegangan: number
  penguranganIzin: number
  jumlahIndikator: number
}

/** Jenjang SD — dipakai SDIT LHI dan SD LHI Juara (satu berkas rubrik). */
export const KPI_PARAM_SD: KpiParam = {
  /** B12 — target hafalan Al-Qur'an setahun, dalam juz. */
  targetJuz: 3,
  /** B13 — standar mushaf. */
  halamanPerJuz: 20,
  /** B14 — nilai dasar hafalan Al-Qur'an sebelum tambahan juz/halaman. */
  basisHafalan: 40,
  /** B15 — 60 poin dibagi target juz. */
  poinPerJuz: 20,
  /** B16 — poin per juz dibagi jumlah halaman. */
  poinPerHalaman: 1,
  /** B17 — bait pertama Tuhfatul Athfal dihargai lebih besar. */
  poinBaitPertama: 5,
  /** B18 — bait ke-2 sampai ke-61. */
  poinBaitBerikutnya: 1.6,
  /** B19 — total bait Tuhfatul Athfal. */
  totalBait: 61,
  /** B20 */
  mingguEfektif: 4,
  /** B21 — Senin sampai Jum'at. */
  hariPerMinggu: 5,
  /** B22 — 4 minggu × 5 hari. */
  hariPenilaian: 20,
  /** B23 — 5 item: peci, id card, peci/jilbab standar, gamis/kaos, sepatu. */
  poinSeragamPerHari: 5,
  /** B24 — 20 hari × 4 = 80, ditambah bonus 20 menjadi 100. */
  poinLaporOrtuPerHari: 4,
  /** B25 — nilai dasar Laporan Grup Orang Tua. */
  basisLaporOrtu: 20,
  /** B26 */
  pertemuanHalaqoh: 16,
  /** B27 — 3 = hadir sebelum sesi, 2 = telat ≤5 mnt, 1 = telat 5–10 mnt, 0 = telat >10 mnt. */
  poinHadirHalaqoh: 3,
  /** B28 — 3 = tepat waktu mengakhiri. */
  poinAkhiriHalaqoh: 3,
  /** B29 — 4 + 48 + 48 = 100. */
  basisHalaqoh: 4,
  /** B30 */
  basisBukuPegangan: 4,
  /** B31 — 16 pertemuan × 6 + basis 4 = 100. */
  poinPerPertemuanBuku: 6,
  /** B32 */
  pertemuanBukuPegangan: 16,
  /** B33 — pengurang tiap kasus izin lewat WA tanpa menulis buku. */
  penguranganIzin: 10,
  /** B34 — pembagi Nilai Rapot KPI. */
  jumlahIndikator: 11,
}

/**
 * Jenjang SMP — rumusnya identik dengan SD, hanya tuntutan hafalannya lebih
 * berat. Tiga angka inilah satu-satunya yang berbeda di seluruh rubrik:
 *
 *   target hafalan   3 juz  →  5 juz
 *   poin per juz     20     →  12      (60 poin dibagi target yang lebih besar)
 *   poin per halaman 1      →  0,6     (poin per juz dibagi 20 halaman)
 *
 * Ditulis sebagai turunan KPI_PARAM_SD, bukan salinan utuh, supaya perbedaan
 * itu terbaca sekali lihat — dan supaya parameter yang memang sama tidak bisa
 * diam-diam menyimpang saat salah satunya disunting.
 */
export const KPI_PARAM_SMP: KpiParam = {
  ...KPI_PARAM_SD,
  targetJuz: 5,
  poinPerJuz: 12,
  poinPerHalaman: 0.6,
}

/**
 * Rubrik yang berlaku untuk sebuah unit.
 *
 * SD LHI Juara memakai rubrik SD karena keduanya berbagi satu berkas Panduan.
 * Unit yang belum punya rubrik sendiri (PAUD) jatuh ke SD, bukan melempar galat
 * — halaman KPI tetap bisa dibuka, dan angkanya jelas keliru daripada halaman
 * yang rusak sama sekali. PAUD memang belum masuk KPI_UNITS.
 */
export function paramFor(unit: Jenjang | null | undefined): KpiParam {
  return unit === 'smp' ? KPI_PARAM_SMP : KPI_PARAM_SD
}

/** Skala level CAR (Capaian & Rencana Perbaikan) — sama untuk semua unit. */
export const KPI_LEVELS = [
  { level: 6, min: 91, max: 100, predikat: 'Sangat Baik',         tindakLanjut: 'Pertahankan, jadikan teladan / mentor rekan.' },
  { level: 5, min: 81, max: 90,  predikat: 'Baik',                tindakLanjut: 'Pertahankan, perbaiki detail kecil.' },
  { level: 4, min: 71, max: 80,  predikat: 'Cukup',               tindakLanjut: 'Perlu pendampingan koordinator.' },
  { level: 3, min: 61, max: 70,  predikat: 'Kurang',              tindakLanjut: 'Perlu perbaikan terjadwal & evaluasi mingguan.' },
  { level: 2, min: 51, max: 60,  predikat: 'Sangat Kurang',       tindakLanjut: 'Pembinaan terjadwal oleh koordinator & SDM.' },
  { level: 1, min: 0,  max: 50,  predikat: 'Sangat Kurang Sekali', tindakLanjut: 'Pembinaan khusus oleh Kepala RQ.' },
] as const

export type KpiLevel = (typeof KPI_LEVELS)[number]

/**
 * Warna lencana tiap level.
 *
 * Tinggal di sini bersama rubriknya, bukan disalin ulang di tiap halaman.
 * Sebelumnya peta yang sama hidup di empat berkas; begitu ambangnya berubah,
 * yang terlupakan tidak akan gagal — ia hanya akan mewarnai level yang tidak
 * ada lagi dengan warna kosong, dan lencananya berubah jadi polos tanpa ada
 * yang menyadarinya.
 *
 * Tiga level terbawah sama-sama merah dengan sengaja: "Kurang", "Sangat
 * Kurang", dan "Sangat Kurang Sekali" menuntut tindakan yang sama seriusnya,
 * dan membedakan warnanya akan menyiratkan bahwa salah satunya bisa ditunda.
 */
export const KPI_LEVEL_TONE: Record<number, string> = {
  6: 'bg-success-wash text-success',
  5: 'bg-primary-wash text-primary',
  4: 'bg-warning-wash text-warning',
  3: 'bg-destructive-wash text-destructive',
  2: 'bg-destructive-wash text-destructive',
  1: 'bg-destructive-wash text-destructive',
}
