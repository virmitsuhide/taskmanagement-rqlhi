/**
 * Batas tiap juz dalam mushaf: dari surat & ayat berapa sampai surat & ayat
 * berapa.
 *
 * Pembagian yang dipakai adalah mushaf standar Madani/Kufi — yang dicetak
 * Kemenag dan dipakai seluruh unit RQ LHI.
 *
 * KENAPA INI PERLU, PADAHAL SUDAH ADA lib/rq/quran.ts
 *
 * Berkas itu menyimpan surah → juz AWALNYA, dan itu cukup untuk menebak
 * kasar. Tapi banyak surah membentang lebih dari satu juz: Al-Baqarah sendiri
 * menempati juz 1, 2, dan 3. Menjawab "setoran Al-Baqarah ayat 200 itu juz
 * berapa" tidak bisa dari sana — jawabannya juz 2, sementara quran.ts hanya
 * tahu Al-Baqarah mulai di juz 1.
 *
 * KENAPA AWAL DAN AKHIR DITULIS KEDUANYA
 *
 * Akhir sebuah juz selalu satu ayat sebelum awal juz berikutnya, jadi separuh
 * tabel ini secara teori bisa dihitung. Tapi menghitungnya butuh panjang tiap
 * surah — saat juz berikutnya mulai di ayat 1, ayat sebelumnya adalah ayat
 * TERAKHIR surah sebelumnya, dan angka itu tidak ada di berkas ini. Menuliskan
 * keduanya membuat modul ini berdiri sendiri tanpa perlu memuat 114 panjang
 * surah, dan redundansinya dijaga oleh uji silang, bukan oleh kehati-hatian:
 *
 *     npm run uji:batas-juz
 *
 * Uji itu mencocokkan tabel ini dengan DUA sumber yang ditulis terpisah —
 * `AYAT_PER_JUZ` di types/index.ts dan `surat_master` di database — sehingga
 * satu angka yang meleset akan ketahuan, bukan diam-diam dipakai bertahun.
 * Itu bukan kekhawatiran yang mengada-ada: saat tabel ini pertama disusun,
 * awal juz 4 tertulis Ali Imran 93 dan uji silangnya yang menemukan bahwa
 * seharusnya Ali Imran 92.
 */

export interface PosisiMushaf {
  /** Nomor surah, 1–114. */
  surat: number
  /** Nomor ayat di dalam surah itu. */
  ayat: number
}

export interface BatasJuz {
  juz: number
  mulai: PosisiMushaf
  selesai: PosisiMushaf
}

const p = (surat: number, ayat: number): PosisiMushaf => ({ surat, ayat })

/**
 * Ketiga puluh juz, berurut 1→30 — urutan MUSHAF, bukan urutan hafalan RQ.
 * Untuk urutan menghafal (30, 29, 28, 27, 26, lalu 1…25) lihat
 * lib/rq/hafalan.ts.
 */
export const BATAS_JUZ: BatasJuz[] = [
  { juz:  1, mulai: p(  1,   1), selesai: p(  2, 141) }, // Al-Fatihah    → Al-Baqarah
  { juz:  2, mulai: p(  2, 142), selesai: p(  2, 252) }, // Al-Baqarah    → Al-Baqarah
  { juz:  3, mulai: p(  2, 253), selesai: p(  3,  91) }, // Al-Baqarah    → Ali Imran
  { juz:  4, mulai: p(  3,  92), selesai: p(  4,  23) }, // Ali Imran     → An-Nisa
  { juz:  5, mulai: p(  4,  24), selesai: p(  4, 147) }, // An-Nisa       → An-Nisa
  { juz:  6, mulai: p(  4, 148), selesai: p(  5,  81) }, // An-Nisa       → Al-Maidah
  { juz:  7, mulai: p(  5,  82), selesai: p(  6, 110) }, // Al-Maidah     → Al-An'am
  { juz:  8, mulai: p(  6, 111), selesai: p(  7,  87) }, // Al-An'am      → Al-A'raf
  { juz:  9, mulai: p(  7,  88), selesai: p(  8,  40) }, // Al-A'raf      → Al-Anfal
  { juz: 10, mulai: p(  8,  41), selesai: p(  9,  92) }, // Al-Anfal      → At-Taubah
  { juz: 11, mulai: p(  9,  93), selesai: p( 11,   5) }, // At-Taubah     → Hud
  { juz: 12, mulai: p( 11,   6), selesai: p( 12,  52) }, // Hud           → Yusuf
  { juz: 13, mulai: p( 12,  53), selesai: p( 14,  52) }, // Yusuf         → Ibrahim
  { juz: 14, mulai: p( 15,   1), selesai: p( 16, 128) }, // Al-Hijr       → An-Nahl
  { juz: 15, mulai: p( 17,   1), selesai: p( 18,  74) }, // Al-Isra       → Al-Kahf
  { juz: 16, mulai: p( 18,  75), selesai: p( 20, 135) }, // Al-Kahf       → Taha
  { juz: 17, mulai: p( 21,   1), selesai: p( 22,  78) }, // Al-Anbiya     → Al-Hajj
  { juz: 18, mulai: p( 23,   1), selesai: p( 25,  20) }, // Al-Mu'minun   → Al-Furqan
  { juz: 19, mulai: p( 25,  21), selesai: p( 27,  55) }, // Al-Furqan     → An-Naml
  { juz: 20, mulai: p( 27,  56), selesai: p( 29,  45) }, // An-Naml       → Al-Ankabut
  { juz: 21, mulai: p( 29,  46), selesai: p( 33,  30) }, // Al-Ankabut    → Al-Ahzab
  { juz: 22, mulai: p( 33,  31), selesai: p( 36,  27) }, // Al-Ahzab      → Yasin
  { juz: 23, mulai: p( 36,  28), selesai: p( 39,  31) }, // Yasin         → Az-Zumar
  { juz: 24, mulai: p( 39,  32), selesai: p( 41,  46) }, // Az-Zumar      → Fussilat
  { juz: 25, mulai: p( 41,  47), selesai: p( 45,  37) }, // Fussilat      → Al-Jasiyah
  { juz: 26, mulai: p( 46,   1), selesai: p( 51,  30) }, // Al-Ahqaf      → Az-Zariyat
  { juz: 27, mulai: p( 51,  31), selesai: p( 57,  29) }, // Az-Zariyat    → Al-Hadid
  { juz: 28, mulai: p( 58,   1), selesai: p( 66,  12) }, // Al-Mujadalah  → At-Tahrim
  { juz: 29, mulai: p( 67,   1), selesai: p( 77,  50) }, // Al-Mulk       → Al-Mursalat
  { juz: 30, mulai: p( 78,   1), selesai: p(114,   6) }, // An-Naba       → An-Nas
]

/** Ayat terakhir mushaf — An-Nas 6. */
export const AKHIR_MUSHAF: PosisiMushaf = { surat: 114, ayat: 6 }

/**
 * Urutan dua posisi dalam mushaf: negatif bila `a` lebih dulu, 0 bila sama.
 *
 * Perbandingan leksikografis surah lalu ayat — tidak perlu tahu panjang surah
 * mana pun, sebab nomor surah yang lebih kecil selalu mendahului.
 */
export function bandingPosisi(a: PosisiMushaf, b: PosisiMushaf): number {
  return a.surat - b.surat || a.ayat - b.ayat
}

/**
 * Juz yang memuat sebuah ayat — inilah alasan utama tabel ini ada.
 *
 * "Al-Baqarah ayat 200" → juz 2, bukan juz 1 sebagaimana ditebak
 * lib/rq/quran.ts yang hanya tahu juz awal tiap surah.
 *
 * Mengembalikan null untuk posisi yang tidak masuk akal (surah di luar
 * 1–114, atau ayat < 1). Ayat yang melebihi panjang surahnya TIDAK ditolak:
 * berkas ini tidak memuat panjang surah, dan menebak-nebak batas atas lebih
 * berbahaya daripada membiarkan pemanggilnya memvalidasi dengan surat_master.
 */
export function juzDariAyat(surat: number, ayat: number): number | null {
  if (!Number.isInteger(surat) || !Number.isInteger(ayat)) return null
  if (surat < 1 || surat > 114 || ayat < 1) return null

  const posisi = { surat, ayat }
  // Dicari dari belakang: juz pertama (dari ujung) yang awalnya tidak
  // melewati posisi ini. Tiga puluh baris, jadi pemindaian lurus sudah lebih
  // cepat daripada ongkos menyiapkan struktur pencarian apa pun.
  for (let i = BATAS_JUZ.length - 1; i >= 0; i--) {
    if (bandingPosisi(BATAS_JUZ[i].mulai, posisi) <= 0) return BATAS_JUZ[i].juz
  }
  return null
}

/** Batas satu juz, atau null bila nomornya di luar 1–30. */
export function batasJuz(juz: number): BatasJuz | null {
  return BATAS_JUZ.find(b => b.juz === juz) ?? null
}

/**
 * Semua juz yang tersentuh sebuah surah — kebalikan arah dari juzDariAyat().
 *
 * Al-Baqarah → [1, 2, 3]. Dipakai saat yang diketahui hanya nama surahnya,
 * misalnya pada rekap hafalan gukar yang ditulis bebas pengampu.
 */
export function juzSurah(surat: number): number[] {
  return BATAS_JUZ
    .filter(b => b.mulai.surat <= surat && surat <= b.selesai.surat)
    .map(b => b.juz)
}
