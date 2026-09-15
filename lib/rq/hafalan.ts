/**
 * Urutan hafalan RQ LHI, dan hitungan juz yang diturunkan darinya.
 *
 * Anak menghafal dari belakang mushaf lalu melompat ke depan: juz 30 dulu,
 * mundur ke 26, baru mulai lagi dari juz 1 ke atas. Jadi nomor juz BUKAN
 * ukuran capaian — anak yang sudah juz 2 hafal lebih banyak (7 juz) daripada
 * anak yang baru juz 26 (5 juz), meski angkanya jauh lebih kecil.
 *
 * Seluruh berkas ini berdiri di atas satu kesepakatan: urutannya tetap, dan
 * anak tidak melompati juz. Karena itu satu catatan ujian sudah cukup untuk
 * menyimpulkan seluruh riwayat sebelumnya — juz 26 berarti 30, 29, 28, 27
 * sudah lewat, walau tidak satu pun tercatat di sistem.
 */

/** 30, 29, 28, 27, 26, lalu 1, 2, 3, … 25. Tepat 30 entri. */
export const URUTAN_JUZ: number[] = [
  30, 29, 28, 27, 26,
  ...Array.from({ length: 25 }, (_, i) => i + 1),
]

/**
 * Posisi juz dalam urutan hafalan, mulai dari 1. `null` bila bukan juz sah.
 *
 * Posisi ini SEKALIGUS jumlah juz hafalan, sebab urutannya tidak dilompati:
 * berada di posisi ke-7 berarti tujuh juz sudah dilewati, termasuk juz itu.
 */
export function posisiJuz(juz: number | string): number | null {
  const n = typeof juz === 'number' ? juz : Number(String(juz).trim())
  if (!Number.isInteger(n)) return null
  const i = URUTAN_JUZ.indexOf(n)
  return i === -1 ? null : i + 1
}

/**
 * Juz yang sudah TUNTAS menurut setoran harian, dari juz yang sedang dihafal.
 *
 * Sengaja berbeda satu angka dari posisiJuz(), dan bedanya bukan kekeliruan:
 * juz yang sedang disetor belum selesai, sedangkan juz yang sudah diujikan
 * sudah. Anak yang setorannya berada di juz 26 baru tuntas 4 juz (30, 29, 28,
 * 27); anak yang LULUS UJIAN juz 26 tuntas 5 juz.
 *
 * Keduanya tinggal di berkas ini supaya perbedaan itu terbaca berdampingan.
 * Sebelumnya aturan setoran hidup sebagai juzHafalCount() di
 * lib/data/analytics.ts — dua salinan urutan juz yang sama, di dua berkas
 * yang tidak saling menyebut.
 */
export function juzSelesaiSetoran(juzBerjalan: number | null | undefined): number {
  if (juzBerjalan === null || juzBerjalan === undefined) return 0
  const p = posisiJuz(juzBerjalan)
  return p === null ? 0 : p - 1
}

/**
 * Juz terjauh dalam URUTAN hafalan dari sekumpulan nomor juz — bukan yang
 * angkanya terbesar. Dari [30, 29, 2] yang terjauh adalah 2, bukan 30.
 */
export function juzTerjauh(daftar: number[]): number | null {
  let terjauh: number | null = null
  let posisiTerjauh = 0
  for (const j of daftar) {
    const p = posisiJuz(j)
    if (p !== null && p > posisiTerjauh) { posisiTerjauh = p; terjauh = j }
  }
  return terjauh
}

/**
 * Posisi tertinggi yang tersentuh sebuah catatan ujian.
 *
 * Tasmi' menyimpan rentang ("26-30", "1-5"), bukan satu angka, jadi yang
 * dipakai adalah ujung yang paling jauh dalam urutan hafalan — bukan angka
 * terbesar. Untuk "26-30" keduanya kebetulan sama; untuk "1-5" tidak: juz 5
 * jauh lebih jauh daripada juz 1.
 */
export function posisiTertinggiDari(juzTeks: string): number | null {
  const angka = String(juzTeks)
    .split(/[^0-9]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)

  let tertinggi: number | null = null
  for (const n of angka) {
    const p = posisiJuz(n)
    if (p !== null && (tertinggi === null || p > tertinggi)) tertinggi = p
  }
  return tertinggi
}

/**
 * Total juz hafalan dari seluruh catatan ujian seorang anak.
 *
 * Yang dihitung adalah catatan TERJAUH, bukan jumlah catatannya. Seorang anak
 * bisa punya tiga catatan juz 30 (mengulang, lalu lulus) — itu tetap satu juz.
 * Dan anak yang catatannya hanya juz 2 tetap terhitung 7 juz, sebab enam juz
 * sebelumnya pasti sudah dilewati walau tidak pernah tercatat di sistem.
 */
export function totalJuzHafalan(juzTeksList: string[]): number {
  let tertinggi = 0
  for (const teks of juzTeksList) {
    const p = posisiTertinggiDari(teks)
    if (p !== null && p > tertinggi) tertinggi = p
  }
  return tertinggi
}

/**
 * Nomor juz yang tercakup oleh sebuah capaian sejumlah `total` juz.
 *
 * Kebalikan dari totalJuzHafalan(): yang itu mengubah catatan menjadi angka,
 * yang ini mengubah angka kembali menjadi daftar juz-nya. Dipakai peta
 * belajar untuk menandai lingkaran mana yang harus menyala — 6 juz berarti
 * 30, 29, 28, 27, 26, 1, bukan 1 sampai 6.
 */
export function daftarJuzSelesai(total: number): number[] {
  return URUTAN_JUZ.slice(0, Math.max(0, Math.min(total, URUTAN_JUZ.length)))
}

/**
 * Juz yang masih boleh diajukan, mengingat capaian yang sudah tercatat.
 *
 * Anak yang sudah juz'iyyah juz 26 (posisi 5) tidak lagi ditawari 30-26; yang
 * tersisa 1-25. Bukan sekadar merapikan pilihan: menawarkan juz yang sudah
 * lewat mengundang pengajuan ganda, dan pengajuan ganda merusak hitungan juz
 * di analitik jauh setelah orangnya lupa pernah salah pilih.
 *
 * `sudahSampai` = 0 berarti belum ada catatan; seluruh 30 juz ditawarkan.
 */
export function juzTersedia(sudahSampai: number): number[] {
  return URUTAN_JUZ.slice(Math.max(0, sudahSampai))
}

/**
 * "5 juz (30, 29, 28, 27, 26)" — dipakai di profil siswa & analitik.
 *
 * Menyebut juz-nya satu per satu penting karena angkanya tidak berurutan:
 * "7 juz" saja membuat orang mengira juz 1-7.
 */
export function ringkasHafalan(total: number): string {
  if (total <= 0) return 'Belum ada catatan ujian'
  const daftar = URUTAN_JUZ.slice(0, total)
  return `${total} juz (${daftar.join(', ')})`
}
