import { QULS_SD_PROGRAMS } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'

/**
 * Kalender aktif pembelajaran Al-Qur'an — bagian murni (tanpa akses data).
 *
 * Menjawab satu pertanyaan: berapa kali sesi Qur'an DIJADWALKAN bagi seorang
 * anak dalam suatu rentang, setelah dikurangi hari yang sesinya ditiadakan.
 * Angka itulah Tatap Muka (TM), dan ia yang menjadi penyebut kehadiran di
 * rapor — bukan banyaknya tanggal yang kebetulan sempat diabsen.
 *
 * Lihat drizzle/0084_kalender_quran_PASTE_TO_SUPABASE.sql.
 */

/** 1 = Senin … 7 = Ahad, mengikuti ISO-8601 seperti halaqoh_sessions. */
export const HARI_LABEL: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: "Jum'at", 6: 'Sabtu', 7: 'Ahad',
}

export const HARI_SINGKAT: Record<number, string> = {
  1: 'Sn', 2: 'Sl', 3: 'Rb', 4: 'Km', 5: 'Jm', 6: 'Sb', 7: 'Ah',
}

/** Hari sekolah — yang ditawarkan di layar pengaturan jadwal. */
export const HARI_PILIHAN = [1, 2, 3, 4, 5, 6] as const

const REGULER = [1, 2, 3, 4]
const DENGAN_JUMAT = [1, 2, 3, 4, 5]

/**
 * Jadwal bawaan sebuah program, dipakai selama koordinator belum mengaturnya.
 *
 * Anak di RQ LHI mengaji Senin–Kamis. QULS dan Takhassus punya sesi tahfidz
 * Jum'at, jadi TM mereka lebih banyak — dan kehadirannya dibandingkan dengan
 * TM programnya sendiri. Nama programnya berbeda antar unit ('quls' di SD,
 * 'fullday_quls'/'boarding_quls' di SMP), jadi yang diperiksa kata QULS-nya.
 */
export function jadwalBawaan(jenjang: Jenjang, program: string | null): number[] {
  const p = (program ?? '').toLowerCase()
  if (!p) return REGULER
  if (p.includes('quls') || p.includes('takhassus')) return DENGAN_JUMAT
  if (jenjang === 'sd' && (QULS_SD_PROGRAMS as readonly string[]).includes(p)) return DENGAN_JUMAT
  return REGULER
}

export interface JadwalProgram {
  jenjang: Jenjang
  /** '' = tanpa program / reguler. */
  program: string
  hari: number[]
}

/** Tanggal yang sesinya ditiadakan. `kelas` null = seluruh angkatan. */
export interface HariKosong {
  id?: string
  tanggal: string
  jenjang: Jenjang
  tingkat: number
  kelas: string | null
  alasan: string
}

// ─── Tanggal ─────────────────────────────────────────────────────────────────

/** ISO-8601: 1 = Senin … 7 = Ahad. Dibaca sebagai tanggal WIB. */
export function hariKe(iso: string): number {
  const d = new Date(`${iso}T00:00:00+07:00`).getUTCDay()
  return d === 0 ? 7 : d
}

/** Semua tanggal 'YYYY-MM-DD' dalam satu bulan (bulan 1-12). */
export function tanggalSebulan(tahun: number, bulan: number): string[] {
  const akhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const bl = String(bulan).padStart(2, '0')
  return Array.from({ length: akhir }, (_, i) => `${tahun}-${bl}-${String(i + 1).padStart(2, '0')}`)
}

/** Semua tanggal dalam rentang inklusif. Dipakai menghitung TM satu semester. */
export function tanggalRentang(dari: string, sampai: string): string[] {
  const hasil: string[] = []
  const akhir = new Date(`${sampai}T00:00:00Z`).getTime()
  for (let d = new Date(`${dari}T00:00:00Z`); d.getTime() <= akhir; d.setUTCDate(d.getUTCDate() + 1)) {
    hasil.push(d.toISOString().slice(0, 10))
  }
  return hasil
}

// ─── Tatap muka ──────────────────────────────────────────────────────────────

export interface SasaranTM {
  jenjang: Jenjang
  tingkat: number
  /** Rombel anak ini, mis. '2B'. */
  kelas: string | null
  program: string | null
}

/**
 * Apakah tanggal ini ditiadakan bagi sasaran tersebut?
 *
 * Penandaan seluruh angkatan (kelas = null) mengenai semua rombel; penandaan
 * satu rombel hanya mengenai rombel itu. Perbandingan kelas dibuat tidak
 * peka huruf besar-kecil karena '2b' dan '2B' adalah rombel yang sama.
 */
export function ditiadakan(kosong: HariKosong[], tanggal: string, s: SasaranTM): HariKosong | null {
  return kosong.find(k =>
    k.tanggal === tanggal
    && k.jenjang === s.jenjang
    && k.tingkat === s.tingkat
    && (k.kelas === null || k.kelas.toLowerCase() === (s.kelas ?? '').toLowerCase()),
  ) ?? null
}

/** Hari aktif program ini — dari pengaturan koordinator, atau bawaannya. */
export function hariProgram(jadwal: JadwalProgram[], s: Pick<SasaranTM, 'jenjang' | 'program'>): number[] {
  const p = s.program ?? ''
  const diatur = jadwal.find(j => j.jenjang === s.jenjang && j.program === p)
  return diatur?.hari ?? jadwalBawaan(s.jenjang, p)
}

/**
 * Tatap muka seorang anak dalam suatu rentang: hari yang dijadwalkan bagi
 * programnya, dikurangi hari yang sesinya ditiadakan bagi angkatannya.
 */
export function hitungTM(
  dari: string,
  sampai: string,
  jadwal: JadwalProgram[],
  kosong: HariKosong[],
  s: SasaranTM,
): number {
  const hari = hariProgram(jadwal, s)
  let n = 0
  for (const t of tanggalRentang(dari, sampai)) {
    if (!hari.includes(hariKe(t))) continue
    if (ditiadakan(kosong, t, s)) continue
    n += 1
  }
  return n
}

/** "17 dari 21 TM · 81%" — ringkasan kehadiran terhadap tatap muka. */
export function persenTM(hadir: number, tm: number): number | null {
  if (tm <= 0) return null
  return Math.round((hadir / tm) * 100)
}
