import type { PublicPost, PublicPostType } from '@/types'

/**
 * Arti kolom `due_date` pada post beranda bergantung pada jenisnya.
 *
 * Satu kolom melayani dua hal: bagi TUGAS GURU ia batas waktu pengumpulan,
 * bagi PENGUMUMAN ia hari kegiatannya berlangsung. Menyebut keduanya
 * "deadline" membuat wali murid membaca undangan acara sebagai tagihan —
 * dan menandai acara yang sudah lewat sebagai "terlambat", padahal acara
 * itu sudah terlaksana dengan baik.
 */
export function adalahTugas(post: Pick<PublicPost, 'type'>): boolean {
  return post.type === 'tugas_guru'
}

/** Label kolom tanggal, untuk form maupun tampilan. */
export function labelTanggalPost(type: PublicPostType): string {
  return type === 'tugas_guru' ? 'Tenggat' : 'Waktu pelaksanaan'
}

/**
 * "Lewat tenggat" hanya bermakna bagi tugas. Pengumuman yang tanggal
 * kegiatannya sudah lewat tidak diberi tanda apa pun.
 */
export function lewatTenggatPost(post: Pick<PublicPost, 'type' | 'due_date'>, sekarang = new Date()): boolean {
  if (!adalahTugas(post) || !post.due_date) return false
  // Kolomnya bertipe tanggal saja. new Date('2026-10-12') = 00:00 UTC = 07:00
  // WIB, sehingga tugas bertenggat hari ini sudah "lewat" sejak pagi. Tenggat
  // berlaku sampai akhir hari itu, waktu Yogyakarta.
  const batas = /^\d{4}-\d{2}-\d{2}$/.test(post.due_date)
    ? new Date(`${post.due_date}T23:59:59+07:00`)
    : new Date(post.due_date)
  return batas < sekarang
}
