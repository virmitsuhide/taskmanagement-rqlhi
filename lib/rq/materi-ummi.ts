/**
 * Daftar materi hafalan Gharib & Tajwid (UMMI) — data acuan RQ LHI.
 *
 * Disalin dari dua dokumen RQ LHI: "Materi Gharib_1.docx" dan
 * "Materi Tajwid.docx". Ditaruh di lib/, bukan di dalam skrip seed, supaya bisa
 * diperiksa tanpa menyalakan koneksi basis data — skrip seed menjalankan
 * penulisannya begitu ia di-import, jadi apa pun yang ingin membaca daftar ini
 * tidak boleh mengambilnya dari sana.
 */

export type Materi = { nomor: number; halaman: number; nama: string; keterangan?: string }

/**
 * Gharib — 40 materi di halaman 1–23.
 *
 * Nomor mengikuti angka dalam kurung di dokumen, BUKAN urutan baca. Di halaman
 * 3 dokumen menuliskan (6) lebih dulu karena arah tulisan Arab, padahal materi
 * ke-5 adalah أَنَاسِيَّ — angka dalam kurunglah yang mengikat, bukan posisinya
 * di baris.
 */
export const GHARIB: Materi[] = [
  { nomor: 1,  halaman: 1,  nama: 'أَنَا' },
  { nomor: 2,  halaman: 1,  nama: 'فَأَنَا' },
  { nomor: 3,  halaman: 2,  nama: 'أَنَابَ' },
  { nomor: 4,  halaman: 2,  nama: 'اَلْأَنَامِلَ' },
  { nomor: 5,  halaman: 3,  nama: 'أَنَاسِيَّ' },
  { nomor: 6,  halaman: 3,  nama: 'أَنَابُوْ' },
  { nomor: 7,  halaman: 4,  nama: 'أَفَائِنْ' },
  { nomor: 8,  halaman: 4,  nama: 'مِنْ نَبَإِىْ' },
  { nomor: 9,  halaman: 5,  nama: 'مَلَائِهِمْ' },
  { nomor: 10, halaman: 5,  nama: 'مَلَائِهِ' },
  { nomor: 11, halaman: 6,  nama: 'مِائَتَيْنِ' },
  { nomor: 12, halaman: 6,  nama: 'مِائَةٌ' },
  { nomor: 13, halaman: 6,  nama: 'لِتَتْلُوَا' },
  { nomor: 14, halaman: 7,  nama: 'لَنْ نَّدْعُوَا' },
  { nomor: 15, halaman: 7,  nama: 'وَنَبْلُوَا' },
  { nomor: 16, halaman: 8,  nama: 'لِيَرْبُوَا' },
  { nomor: 17, halaman: 8,  nama: 'لِيَبْلُوَا' },
  { nomor: 18, halaman: 9,  nama: 'لَـٰكِنَّا' },
  { nomor: 19, halaman: 9,  nama: 'وَلَـٰكِنَّا' },
  { nomor: 20, halaman: 10, nama: 'الظُّنُونَا … هُنَالِكَ' },
  { nomor: 21, halaman: 11, nama: 'الرَّسُولَا … وَقَالُوا' },
  { nomor: 22, halaman: 11, nama: 'السَّبِيلَا … رَبَّنَا' },
  { nomor: 23, halaman: 12, nama: 'ثَمُودَا' },
  { nomor: 24, halaman: 13, nama: 'سَلَاسِلَا' },
  { nomor: 25, halaman: 13, nama: 'قَوَارِيرَا … قَوَارِيرَا مِنْ فِضَّةٍ' },
  { nomor: 26, halaman: 15, nama: 'وَيَبْصُۜطُ' },
  { nomor: 27, halaman: 15, nama: 'بَصْۜطَةً' },
  { nomor: 28, halaman: 16, nama: 'الْمُصَۣيْطِرُونَ' },
  { nomor: 29, halaman: 16, nama: 'بِمُصَيْطِرٍ' },
  { nomor: 30, halaman: 17, nama: 'بَرَاءَةٌ' },
  { nomor: 31, halaman: 18, nama: 'مَجْر۪ىٰهَا' },
  { nomor: 32, halaman: 18, nama: 'لَا تَأْمَ۫نَّا' },
  { nomor: 33, halaman: 19, nama: 'عِوَجًا ۜ قَيِّمًا' },
  { nomor: 34, halaman: 20, nama: 'مِنْ مَّرْقَدِنَا ۜ هَـٰذَا' },
  { nomor: 35, halaman: 20, nama: 'وَقِيلَ مَنْ ۜ رَاقٍ' },
  { nomor: 36, halaman: 20, nama: 'كَلَّا ۖ بَلْ ۜ رَانَ' },
  { nomor: 37, halaman: 21, nama: 'ضَعْفٍ … ضَعْفًا' },
  { nomor: 38, halaman: 21, nama: 'ءَا۬عْجَمِيٌّ' },
  { nomor: 39, halaman: 22, nama: 'فِي السَّمَاوَاتِ ۖ ائْتُونِي' },
  { nomor: 40, halaman: 23, nama: 'بِئْسَ الِاسْمُ' },
]

/**
 * Tajwid — 33 materi di halaman 1–19.
 *
 * Halaman 4 (latihan) dan 20 (latihan membaca Al-Qur'an) sengaja kosong:
 * keduanya tidak memperkenalkan kaidah baru. Kolom keterangan memuat kelompok
 * bahasan di dokumen, supaya "Idzhar syafawi" tidak tertukar dengan "Idzhar
 * halqi" hanya karena namanya mirip.
 */
export const TAJWID: Materi[] = [
  { nomor: 1,  halaman: 1,  nama: 'Idzhar halqi',       keterangan: 'Hukum nun sukun / tanwin' },
  { nomor: 2,  halaman: 2,  nama: 'Idghom bighunnah',   keterangan: 'Hukum nun sukun / tanwin' },
  { nomor: 3,  halaman: 2,  nama: 'Idghom bilaghunnah', keterangan: 'Hukum nun sukun / tanwin' },
  { nomor: 4,  halaman: 3,  nama: 'Iqlab',              keterangan: 'Hukum nun sukun / tanwin' },
  { nomor: 5,  halaman: 3,  nama: 'Ikhfa hakiki',       keterangan: 'Hukum nun sukun / tanwin' },
  { nomor: 6,  halaman: 5,  nama: 'Gunnah',             keterangan: 'Nun & mim bertasydid' },
  { nomor: 7,  halaman: 5,  nama: 'Idzhar syafawi',     keterangan: 'Hukum mim sukun' },
  { nomor: 8,  halaman: 5,  nama: 'Idghom mitsli',      keterangan: 'Hukum mim sukun' },
  { nomor: 9,  halaman: 6,  nama: 'Ikhfa syafawi',      keterangan: 'Hukum mim sukun' },
  { nomor: 10, halaman: 6,  nama: 'Idgham mutamatsilain', keterangan: 'Macam-macam idgham' },
  { nomor: 11, halaman: 6,  nama: 'Idgham mutajanisain',  keterangan: 'Macam-macam idgham' },
  { nomor: 12, halaman: 7,  nama: 'Idgham mutaqoribain',  keterangan: 'Macam-macam idgham' },
  { nomor: 13, halaman: 7,  nama: 'Hukum lafadz Allah' },
  { nomor: 14, halaman: 8,  nama: 'Qalqalah' },
  { nomor: 15, halaman: 8,  nama: 'Izhhar wajib' },
  { nomor: 16, halaman: 9,  nama: 'Ro tafkhim',         keterangan: 'Hukum ra’' },
  { nomor: 17, halaman: 10, nama: 'Ro tarqiq',          keterangan: 'Hukum ra’' },
  { nomor: 18, halaman: 11, nama: 'Hukum lam ta’rif' },
  { nomor: 19, halaman: 12, nama: 'Mad Thobi’i',   keterangan: 'Hukum bacaan mad' },
  { nomor: 20, halaman: 12, nama: 'Mad Far’i',     keterangan: 'Hukum bacaan mad' },
  { nomor: 21, halaman: 12, nama: 'Mad Wajib Muttashil', keterangan: 'Hukum bacaan mad' },
  { nomor: 22, halaman: 13, nama: 'Mad Jaiz Munfashil',  keterangan: 'Hukum bacaan mad' },
  { nomor: 23, halaman: 14, nama: 'Mad Aridh lissukun',  keterangan: 'Hukum bacaan mad' },
  { nomor: 24, halaman: 15, nama: 'Mad Iwadh',           keterangan: 'Hukum bacaan mad' },
  { nomor: 25, halaman: 15, nama: 'Mad Shilah',          keterangan: 'Hukum bacaan mad · halaman 15–16' },
  { nomor: 26, halaman: 16, nama: 'Mad Badal',           keterangan: 'Hukum bacaan mad' },
  { nomor: 27, halaman: 17, nama: 'Mad Tamkin',          keterangan: 'Hukum bacaan mad' },
  { nomor: 28, halaman: 17, nama: 'Mad Lin',             keterangan: 'Hukum bacaan mad' },
  { nomor: 29, halaman: 17, nama: 'Mad Lazim Mutsaqqol Kalimi', keterangan: 'Hukum bacaan mad' },
  { nomor: 30, halaman: 17, nama: 'Mad Lazim Mukhoffaf Kalimi', keterangan: 'Hukum bacaan mad' },
  { nomor: 31, halaman: 18, nama: 'Mad Lazim Mutsaqqol Harfi',  keterangan: 'Hukum bacaan mad' },
  { nomor: 32, halaman: 18, nama: 'Mad Lazim Mukhoffaf Harfi',  keterangan: 'Hukum bacaan mad' },
  { nomor: 33, halaman: 19, nama: 'Mad Farq',            keterangan: 'Hukum bacaan mad' },
]

/**
 * Periksa daftar sebelum menyentuh basis data.
 *
 * Daftar ini disalin tangan dari dokumen Word, dan salah ketik di sini tidak
 * akan pernah menyatakan dirinya: materi bernomor ganda diam-diam ditimpa oleh
 * upsert, dan nomor yang lompat membuat progres "x dari 40" menghitung materi
 * yang tidak ada. Lebih baik seed-nya berhenti daripada datanya menyimpang.
 */
export function periksaMateri(label: string, daftar: Materi[]): string[] {
  const galat: string[] = []
  const nomor = daftar.map(m => m.nomor)

  for (let i = 0; i < nomor.length; i++) {
    if (nomor[i] !== i + 1) {
      galat.push(`nomor tidak berurut di posisi ${i + 1}: ditemukan ${nomor[i]}`)
      break
    }
  }
  // Halaman harus maju (boleh sama — beberapa materi memang sehalaman).
  for (let i = 1; i < daftar.length; i++) {
    if (daftar[i].halaman < daftar[i - 1].halaman) {
      galat.push(`halaman mundur di materi ${daftar[i].nomor}: ${daftar[i - 1].halaman} → ${daftar[i].halaman}`)
    }
  }
  const nama = new Set<string>()
  for (const m of daftar) {
    if (nama.has(m.nama)) galat.push(`nama ganda: "${m.nama}" (materi ${m.nomor})`)
    nama.add(m.nama)
    if (!m.nama.trim()) galat.push(`materi ${m.nomor} tidak bernama`)
  }
  if (galat.length > 0) console.error(`  ✗ ${label}:\n      ${galat.join('\n      ')}`)
  return galat
}
