import type { KodeRencana } from '@/lib/rq/target-tahfidz'
import type { Jenjang } from '@/types'

/**
 * Target bulanan tahsin & tahfidz (0103) — bagian murni, dipakai server,
 * peramban (formulir Kumik), dan skrip isian awal.
 *
 * Kumik menetapkan satu RENTANG per kelas per bulan: posisi yang dianggap
 * SESUAI target. Empat kategori lain dihitung dari jarak ke rentang itu,
 * dengan lebar per unit (target_bulanan_ambang), dalam halaman:
 *
 *   jauh di bawah │ di bawah │   SESUAI   │ melampaui │ sangat melampaui
 *                 awal−bawah awal       akhir   akhir+atas
 */

export type JenisTarget = 'tahsin' | 'tahfidz'

export type KategoriTarget = 'jauh_di_bawah' | 'di_bawah' | 'sesuai' | 'melampaui' | 'sangat_melampaui'

export const URUTAN_KATEGORI: KategoriTarget[] = ['jauh_di_bawah', 'di_bawah', 'sesuai', 'melampaui', 'sangat_melampaui']

export const LABEL_KATEGORI: Record<KategoriTarget, string> = {
  jauh_di_bawah: 'Jauh di bawah target',
  di_bawah: 'Di bawah target',
  sesuai: 'Sesuai target',
  melampaui: 'Melampaui target',
  sangat_melampaui: 'Sangat melampaui target',
}

export interface Ambang {
  /** Lebar "di bawah" di belakang awal rentang, dalam halaman. */
  bawah: number
  /** Lebar "melampaui" di depan akhir rentang, dalam halaman. */
  atas: number
}

/** Dipakai bila baris ambang unit belum ada — sama dengan bawaan migrasi 0103. */
export const AMBANG_BAWAAN: Record<JenisTarget, Ambang> = {
  tahsin: { bawah: 5, atas: 5 },
  tahfidz: { bawah: 2, atas: 20 },
}

/**
 * Kategori sebuah posisi terhadap rentang target. Ketiga posisi dalam
 * satuan yang sama — halaman kumulatif (lihat kumulatifTahsin, dan untuk
 * tahfidz halaman rencana di lib/rq/target-tahfidz.ts).
 */
export function kategoriTarget(posisi: number, awal: number, akhir: number, ambang: Ambang): KategoriTarget {
  if (posisi < awal - ambang.bawah) return 'jauh_di_bawah'
  if (posisi < awal) return 'di_bawah'
  if (posisi <= akhir) return 'sesuai'
  if (posisi <= akhir + ambang.atas) return 'melampaui'
  return 'sangat_melampaui'
}

// ─── Kelompok target per unit ─────────────────────────────────────────────────

export interface KelompokTarget {
  kode: string
  label: string
  tingkat: number[]
  /** Tahsin: metode tiap tingkat — nama di tahsin_methods. */
  metode?: (tingkat: number) => string
  /** Tahfidz: rencana hafalan yang dipakai sebagai isian awal. */
  rencana?: KodeRencana
}

const SD = [1, 2, 3, 4, 5, 6]

/**
 * Pembagian yang ditetapkan RQ (2026-09-28):
 *   SD       : CLIL (UMMI) & QULS (KIBAR)
 *   SD Juara : satu kelompok; tahsin kelas 1 KIBAR, kelas 2–6 IQRO;
 *              tahfidz memakai rencana QuLS SD
 *   SMP      : tahsin satu (Syajaroh); tahfidz lulusan SD LHI (internal)
 *              & dari luar (eksternal)
 *   TPAIT, SMA : satu kelompok
 */
export function kelompokTarget(jenjang: Jenjang, jenis: JenisTarget): KelompokTarget[] {
  if (jenis === 'tahsin') {
    switch (jenjang) {
      case 'paud': return [{ kode: 'semua', label: 'TPAIT', tingkat: [1, 2], metode: () => 'UMMI' }]
      case 'sd': return [
        { kode: 'clil', label: 'CLIL', tingkat: SD, metode: () => 'UMMI' },
        { kode: 'quls', label: 'QULS', tingkat: SD, metode: () => 'KIBAR' },
      ]
      case 'sd_juara': return [{ kode: 'semua', label: 'SD Juara', tingkat: SD, metode: t => (t === 1 ? 'KIBAR' : 'IQRO') }]
      case 'smp': return [{ kode: 'semua', label: 'SMP', tingkat: [7, 8, 9], metode: () => 'Syajaroh' }]
      case 'sma': return [{ kode: 'semua', label: 'SMA', tingkat: [10, 11, 12], metode: () => 'Syajaroh' }]
    }
  }
  switch (jenjang) {
    case 'paud': return [{ kode: 'semua', label: 'TPAIT', tingkat: [1, 2] }]
    case 'sd': return [
      { kode: 'clil', label: 'CLIL', tingkat: SD, rencana: 'sd_clil' },
      { kode: 'quls', label: 'QULS', tingkat: SD, rencana: 'sd_quls' },
    ]
    case 'sd_juara': return [{ kode: 'semua', label: 'SD Juara', tingkat: SD, rencana: 'sd_quls' }]
    case 'smp': return [
      { kode: 'internal', label: 'Lulusan SD LHI', tingkat: [7, 8, 9], rencana: 'smp_internal' },
      { kode: 'eksternal', label: 'Dari luar LHI', tingkat: [7, 8, 9], rencana: 'smp_eksternal' },
    ]
    case 'sma': return [{ kode: 'semua', label: 'SMA', tingkat: [10, 11, 12] }]
  }
}

export function labelTingkat(jenjang: Jenjang, tingkat: number): string {
  if (jenjang === 'paud') return tingkat === 1 ? 'TK A' : tingkat === 2 ? 'TK B' : `Tingkat ${tingkat}`
  return `Kelas ${tingkat}`
}

// ─── Tangga tahsin & halaman kumulatif ────────────────────────────────────────

export interface TahapTangga {
  label: string
  total_pages: number | null
  is_quran: boolean
  is_terminal: boolean
}

/**
 * Lebar tahap tanpa jumlah halaman (Al-Qur'an T1, Talaqqi, …) saat dihitung
 * dalam halaman kumulatif. Tahap itu tidak berhalaman, tapi tetap perlu
 * jarak supaya "satu tahap Al-Qur'an di belakang" tidak terbaca nol.
 */
export const LEBAR_TAHAP_TANPA_HALAMAN = 20

const lebar = (t: TahapTangga) => (t.is_terminal ? 1 : t.total_pages ?? LEBAR_TAHAP_TANPA_HALAMAN)

const rapikan = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim()

/** Halaman kumulatif sebuah posisi tahsin (0 = Jilid 1 hal 1). null bila tahapnya tak dikenal. */
export function kumulatifTahsin(tangga: TahapTangga[], tahap: string, halaman: number | null): number | null {
  let kum = 0
  for (const t of tangga) {
    if (rapikan(t.label) === rapikan(tahap)) {
      const h = t.total_pages && halaman ? Math.min(Math.max(1, halaman), t.total_pages) : 1
      return kum + h - 1
    }
    kum += lebar(t)
  }
  return null
}

/** Kebalikan kumulatifTahsin: halaman kumulatif → tahap & halaman. */
export function posisiTahsin(tangga: TahapTangga[], kum: number): { tahap: string; halaman: number | null } {
  let mulai = 0
  for (const t of tangga) {
    const w = lebar(t)
    if (t.is_terminal || kum < mulai + w) {
      return { tahap: t.label, halaman: t.total_pages ? Math.floor(Math.max(0, kum - mulai)) + 1 : null }
    }
    mulai += w
  }
  const akhir = tangga[tangga.length - 1]
  return { tahap: akhir?.label ?? '', halaman: null }
}

/**
 * Target kurikulum yang bahasanya umum ("Jilid 5", "Al-Qur'an", "Tahfidz" =
 * lulus tahsin) → halaman kumulatif AWAL tahap itu pada metode tertentu.
 * Jilid yang melebihi metodenya (Jilid 6 pada Syajaroh) jatuh ke tahap
 * Al-Qur'an pertama.
 */
export function kumulatifTargetKurikulum(tangga: TahapTangga[], target: string): number | null {
  const t = rapikan(target)
  const cari = (pred: (x: TahapTangga) => boolean) => {
    const i = tangga.findIndex(pred)
    return i === -1 ? null : tangga.slice(0, i).reduce((n, x) => n + lebar(x), 0)
  }
  if (t === 'tahfidz' || t.startsWith('lulus')) return cari(x => x.is_terminal)
  const jilid = /jilid\s*(\d+)/.exec(t)
  if (jilid) return cari(x => rapikan(x.label) === `jilid ${jilid[1]}`) ?? cari(x => x.is_quran)
  if (t.includes('gharib')) return cari(x => rapikan(x.label).includes('gharib')) ?? cari(x => x.is_terminal)
  if (t.includes('tajwid')) return cari(x => rapikan(x.label).includes('tajwid')) ?? cari(x => x.is_terminal)
  if (t.includes('quran')) return cari(x => x.is_quran)
  return null
}

// ─── Pembagian rata per bulan ─────────────────────────────────────────────────

export interface BulanPekan {
  bulan: string
  semester: 1 | 2
  pekan: number
}

/**
 * Rentang bulanan dari titik awal tahun ke target akhir semester, dibagi
 * menurut pekan efektif (kalender yang sama dengan target tahfidz).
 *
 * `akhirGanjil` null = tidak ada target tengah tahun; seluruh tahun dibagi
 * rata ke `akhirTahun`. Angka dalam halaman kumulatif; hasilnya [awal, akhir]
 * per bulan — awal bulan berikutnya tepat sesudah akhir bulan ini.
 */
export function bagiRataBulanan(
  kalender: BulanPekan[],
  awalTahun: number,
  akhirGanjil: number | null,
  akhirTahun: number,
): { bulan: string; awal: number; akhir: number }[] {
  const urut = [...kalender].sort((a, b) => a.bulan.localeCompare(b.bulan))
  const tengah = akhirGanjil ?? null
  const potong = (smt: 1 | 2 | null, dari: number, ke: number) => {
    const bulan = urut.filter(b => smt === null || b.semester === smt)
    const total = bulan.reduce((n, b) => n + b.pekan, 0)
    let jalan = 0
    return bulan.map(b => {
      const sebelum = dari + (total > 0 ? (ke - dari) * (jalan / total) : 0)
      jalan += b.pekan
      const sesudah = dari + (total > 0 ? (ke - dari) * (jalan / total) : ke - dari)
      return { bulan: b.bulan, a: sebelum, b: sesudah }
    })
  }
  const mentah = tengah === null
    ? potong(null, awalTahun, akhirTahun)
    : [...potong(1, awalTahun, tengah), ...potong(2, tengah, akhirTahun)]

  // Batas dibulatkan ke halaman utuh. Akhir bulan = halaman terakhir yang
  // semestinya dikerjakan; bulan tanpa kemajuan memegang posisinya.
  return mentah.map(m => {
    const awal = Math.round(m.a)
    const akhir = Math.max(awal, Math.round(m.b) - 1)
    return { bulan: m.bulan, awal, akhir }
  })
}

// ─── Teks ─────────────────────────────────────────────────────────────────────

export function teksPosisiTahsin(tahap: string | null, halaman: number | null): string {
  if (!tahap) return '—'
  return halaman ? `${tahap} hal. ${halaman}` : tahap
}

export const NAMA_BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** '2026-07' → 'Jul 2026'. */
export function labelBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  return `${NAMA_BULAN_PENDEK[m - 1]} ${y}`
}

/** Dua belas bulan tahun ajaran, Juli–Juni: '2026/2027' → ['2026-07', …, '2027-06']. */
export function bulanTahunAjaran(tahunAjaran: string): string[] {
  const y = Number(tahunAjaran.slice(0, 4))
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((6 + i) % 12) + 1
    return `${m >= 7 ? y : y + 1}-${String(m).padStart(2, '0')}`
  })
}
