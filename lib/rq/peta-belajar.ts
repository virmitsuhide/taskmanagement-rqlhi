/**
 * Urutan hafalan juz yang dipakai RQ LHI.
 *
 * Bukan 1→30, melainkan mulai dari juz-juz pendek di belakang mushaf lalu
 * melompat ke depan: 30, 29, 28, 27, 26, baru 1, 2, … sampai 25. Surat-surat
 * juz 30 pendek dan sudah akrab di telinga anak, jadi ia titik berangkat yang
 * paling ringan; juz 25 ditaruh terakhir karena itulah sisa yang tertinggal
 * setelah lima juz belakang diambil lebih dulu.
 *
 * Urutan ini yang menentukan tampilan peta belajar — menampilkannya 1→30
 * membuat anak terlihat "melompat-lompat" padahal ia berjalan lurus.
 */
export const URUTAN_JUZ_TAHFIDZ: number[] = [
  30, 29, 28, 27, 26,
  ...Array.from({ length: 25 }, (_, i) => i + 1),
]

/** Posisi sebuah juz dalam urutan belajar (0 = paling awal). */
export function urutanKe(juz: number): number {
  const i = URUTAN_JUZ_TAHFIDZ.indexOf(juz)
  return i === -1 ? URUTAN_JUZ_TAHFIDZ.length : i
}

export type StatusLevel = 'selesai' | 'proses' | 'terkunci'

export interface NodeLevel {
  key: string
  /** Teks di dalam lingkaran — sependek mungkin, mis. "30" atau "J1". */
  label: string
  /** Keterangan di bawah lingkaran. */
  caption?: string
  status: StatusLevel
  /** 0–100. Dipakai menggambar cincin kemajuan pada node yang sedang berjalan. */
  progressPct?: number
  /** Penanda kecil di pojok, mis. "✓" untuk sudah diuji atau "🎤" untuk tasmi'. */
  badge?: string
  /** Keterangan lengkap saat kursor diarahkan. */
  title: string
}

/**
 * Memotong daftar node menjadi baris berkelok.
 *
 * Baris ganjil dibalik supaya jalurnya menyambung seperti ular — ujung kanan
 * baris pertama bersambung ke ujung kanan baris kedua. Kalau semua baris
 * searah, mata harus melompat balik ke kiri tiap ganti baris, dan urutannya
 * jadi tidak terbaca sebagai satu jalur.
 */
export function berkelok<T>(items: T[], perBaris: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += perBaris) {
    const row = items.slice(i, i + perBaris)
    rows.push(rows.length % 2 === 1 ? [...row].reverse() : row)
  }
  return rows
}
