import type { TahsinStatus } from '@/types'

/**
 * Tiga status setoran tahsin (0109).
 *
 *  • lulus  — halaman tuntas & lancar; posisi maju satu halaman.
 *  • lanjut — halaman BELUM tuntas: anak baru sanggup beberapa baris. Posisi
 *             tetap, pertemuan berikutnya melanjutkan dari baris sesudahnya.
 *  • ulang  — halaman sudah dibaca utuh tapi belum lancar; posisi tetap.
 *
 * 'lanjut' dan 'ulang' sama-sama menahan posisi, tapi artinya berlawanan:
 * yang satu sedang maju pelan, yang lain belum berhasil. Karena itu 'lanjut'
 * tidak pernah dihitung sebagai ulang di analitik.
 *
 * Label tampil diatur di sini saja — mengganti sebutan cukup satu baris.
 */
export const LABEL_STATUS_TAHSIN: Record<TahsinStatus, string> = {
  lulus: 'Lulus',
  lanjut: 'Lanjut',
  ulang: 'Ulang',
}

/** Urutan tombol di formulir. */
export const URUTAN_STATUS_TAHSIN: TahsinStatus[] = ['lulus', 'lanjut', 'ulang']

/** Baca status dari isian bebas; selain dua nilai lain dianggap lulus. */
export function statusTahsinSah(v: unknown): TahsinStatus {
  return v === 'ulang' || v === 'lanjut' ? v : 'lulus'
}

/** Baris terbanyak satu halaman buku — batas isian "sampai baris ke-". */
export const BARIS_MAKS = 30

/** Teks pendek posisi baris, mis. "baris 1–5" / "sampai baris 5" / "dari baris 6". */
export function teksBaris(dari: number | null, ke: number | null): string | null {
  if (dari !== null && ke !== null) return `baris ${dari}–${ke}`
  if (ke !== null) return `sampai baris ${ke}`
  if (dari !== null) return `dari baris ${dari}`
  return null
}
