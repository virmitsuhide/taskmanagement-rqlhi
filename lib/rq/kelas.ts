import type { Jenjang } from '@/types'

/**
 * Bentuk kelas yang utuh: tingkat di depan, rombel menyusul — '1A', '10B',
 * '4 Ikhwan'.
 *
 * Pola yang sama dipakai kenaikan kelas untuk memutuskan siapa yang bisa
 * dinaikkan ('5C' → '6C'). Keduanya sengaja membaca satu konstanta: kalau
 * halaman pembenahan menyatakan sebuah kelas sudah beres sementara kenaikan
 * masih melewatinya, anak itu tertinggal satu angkatan tanpa ada yang tahu.
 */
export const POLA_KELAS = /^(\d+)([A-Za-z].*)$/

/**
 * PAUD menulis rombel tanpa tingkat — 'A', 'B'. Itu bukan kelas yang rusak;
 * di sana memang tidak ada angka untuk dinaikkan.
 */
const POLA_ROMBEL = /^[A-Za-z]/

/**
 * Apakah kelas anak ini sudah cukup jelas untuk dipakai bekerja?
 *
 * Yang dijawab bukan "apakah tulisannya rapi", melainkan "apakah kelas ini
 * masih menyembunyikan keputusan yang belum pernah diambil siapa pun".
 * '4.0' menyimpan tingkatnya tapi kehilangan rombelnya: mesin tidak boleh
 * menebak anak itu 4A atau 4D, dan selama tak ada yang memutuskan, ia
 * dilewati kenaikan kelas serta menempel pada tab kelas yang tidak nyata.
 *
 * Kelas kosong dihitung belum jelas dengan alasan yang sama, meski saat ini
 * tidak ada barisnya — impor Excel menerima kolom Kelas apa adanya, jadi
 * bentuk itu bisa kembali kapan saja.
 */
export function kelasJelas(jenjang: Jenjang, kelas: string | null | undefined): boolean {
  const k = kelas?.trim()
  if (!k) return false
  return jenjang === 'paud' ? POLA_ROMBEL.test(k) : POLA_KELAS.test(k)
}
