import { AYAT_PER_JUZ } from '@/types'
import { AKHIR_MUSHAF, bandingPosisi, type PosisiMushaf } from '@/lib/rq/batas-juz'
import { TOTAL_HALAMAN, awalHalaman, halamanDariAyat } from '@/lib/rq/batas-halaman'

/**
 * Capaian hafalan dalam satuan "sekian juz sekian halaman" — Mushaf Madinah.
 *
 * ATURAN RQ LHI: PEMBULATAN SELALU KE BAWAH
 *
 * Hafalan 2 juz 2 halaman 3 baris dihitung 2 juz 2 halaman. Baris yang belum
 * genap satu halaman tidak pernah dinaikkan menjadi halaman, dan halaman yang
 * belum genap satu juz tidak pernah dinaikkan menjadi juz. Yang dilaporkan
 * adalah yang sudah pasti dikuasai, bukan yang hampir.
 *
 * BENTUK HITUNGANNYA: JUZ UTUH + HALAMAN DI JUZ BERJALAN
 *
 * "2 juz 2 halaman" berarti dua juz selesai seluruhnya, lalu dua halaman ke
 * dalam juz ketiga — mengikuti urutan hafalan RQ (30, 29, 28, …), bukan
 * urutan mushaf. Angka halamannya TIDAK pernah melebihi panjang juz yang
 * sedang berjalan; begitu genap, ia berubah menjadi satu juz utuh dan
 * halamannya kembali nol.
 *
 * Cara itu sengaja dipilih daripada menjumlahkan semuanya menjadi total
 * halaman lalu dibagi 20. Lihat HALAMAN_JUZ di bawah: juz 30 tidak
 * panjangnya 20 halaman, dan juz 30 justru juz PERTAMA yang dihafal setiap
 * anak di sini — pembagian rata 20 akan meleset pada semua orang, sejak
 * halaman pertama mereka.
 */

/** Mushaf Madinah (cetakan King Fahd) — 604 halaman. */
export const TOTAL_HALAMAN_MUSHAF = TOTAL_HALAMAN

/**
 * Awal tiap juz SEBAGAIMANA DITANDAI DI MUSHAF RQ LHI.
 *
 * DUA TABEL BATAS JUZ, DAN KENAPA KEDUANYA HARUS ADA
 *
 * lib/rq/batas-juz.ts menyimpan batas KLASIK — pembagian menurut hitungan
 * ayat, yang disepakati Tanzil, quran.com, dan AYAT_PER_JUZ di types. Itu
 * yang dipakai untuk apa pun yang berhitung ayat: persentase juz di peta
 * belajar, dan juz mana yang tercatat pada sebuah pengajuan ujian.
 *
 * Tabel di bawah ini menyimpan batas yang TERCETAK di mushaf yang dipakai
 * RQ LHI, dan hanya dipakai untuk menghitung halaman. Keduanya berbeda di
 * tiga tempat saja:
 *
 *   juz  7 : mushaf RQ Al-Maidah 83   · klasik Al-Maidah 82
 *   juz 11 : mushaf RQ At-Taubah 94   · klasik At-Taubah 93
 *   juz 27 : mushaf RQ Az-Zariyat 1   · klasik Az-Zariyat 31
 *
 * Dua yang pertama bergeser tepat satu ayat, dan pergeseran itu ada
 * gunanya: batas klasik jatuh pada ayat TERAKHIR sebuah halaman, sehingga
 * halaman 121 dan 201 terbelah dua juz. Batas mushaf jatuh di ayat TERATAS
 * halaman berikutnya, sehingga juz 7 dan juz 11 menjadi genap 20 halaman.
 *
 * Yang ketiga ditetapkan RQ LHI setelah memeriksa mushafnya, dan berbeda
 * jauh dari ketiga sumber data. Akibatnya terlihat pada hitungan: juz 26
 * menjadi 18 halaman dan juz 27 menjadi 21. Dicatat di sini apa adanya
 * supaya perbedaannya kelihatan, bukan tersembunyi di dalam rumus — kalau
 * suatu saat diralat, satu baris ini saja yang berubah.
 */
export const AWAL_JUZ_MUSHAF: readonly (readonly [surat: number, ayat: number])[] = [
  [ 1,   1], [ 2, 142], [ 2, 253], [ 3,  92], [ 4,  24], [ 4, 148],
  [ 5,  83], [ 6, 111], [ 7,  88], [ 8,  41], [ 9,  94], [11,   6],
  [12,  53], [15,   1], [17,   1], [18,  75], [21,   1], [23,   1],
  [25,  21], [27,  56], [29,  46], [33,  31], [36,  28], [39,  32],
  [41,  47], [46,   1], [51,   1], [58,   1], [67,   1], [78,   1],
]

/** Juz mushaf yang memuat sebuah posisi — juz terakhir yang awalnya tidak melewatinya. */
export function juzMushafDariAyat(surat: number, ayat: number): number {
  const posisi: PosisiMushaf = { surat, ayat }
  for (let i = AWAL_JUZ_MUSHAF.length - 1; i >= 0; i--) {
    const [s, a] = AWAL_JUZ_MUSHAF[i]
    if (bandingPosisi({ surat: s, ayat: a }, posisi) <= 0) return i + 1
  }
  return 1
}

/**
 * Halaman milik tiap juz.
 *
 * SEBUAH HALAMAN MILIK JUZ YANG MEMILIKI AYAT TERATASNYA
 *
 * Aturan sesederhana mungkin, dan yang penting: ia membagi 604 halaman
 * tepat habis, tanpa satu pun halaman terhitung dua kali atau terlewat.
 * Halaman yang isinya terbelah dua juz — 502 misalnya, yang memuat ujung
 * Al-Jasiyah lalu awal Al-Ahqaf — jatuh utuh ke juz yang membuka halaman
 * itu. Untuk menghitung capaian hafalan itu justru yang dikehendaki: halaman
 * yang baru separuh dihafal belum layak disebut selesai, sejalan dengan
 * aturan pembulatan ke bawah.
 *
 * Penyimpangan yang tersisa setelah pembagian ini — dan semuanya nyata,
 * bukan kekeliruan data: juz 1 = 21 halaman (memuat Al-Fatihah), juz 25 = 21,
 * juz 26 = 18, juz 27 = 21, juz 30 = 23. Sisanya genap 20.
 */
export const HALAMAN_JUZ: Record<number, { mulai: number; selesai: number }> =
  (() => {
    const peta: Record<number, { mulai: number; selesai: number }> = {}
    for (let h = 1; h <= TOTAL_HALAMAN; h++) {
      const atas = awalHalaman(h)
      if (!atas) continue
      const juz = juzMushafDariAyat(atas.surat, atas.ayat)
      const b = peta[juz]
      if (!b) peta[juz] = { mulai: h, selesai: h }
      else b.selesai = h
    }
    return peta
  })()

/** Berapa halaman yang dimiliki sebuah juz. Jumlah seluruhnya tepat 604. */
export function halamanPerJuz(juz: number): number {
  const b = HALAMAN_JUZ[juz]
  return b ? b.selesai - b.mulai + 1 : 0
}

/** Capaian hafalan seorang anak dalam satuan juz & halaman. */
export interface CapaianHafalan {
  /** Juz yang sudah selesai seluruhnya. */
  juz: number
  /** Halaman ke dalam juz yang sedang berjalan; 0 bila belum mulai juz baru. */
  halaman: number
}

/**
 * Rangkai capaian, sekaligus menegakkan aturan pembulatan ke bawah.
 *
 * `baris` diterima sebagai argumen lalu DIBUANG — bukan karena tidak ada
 * gunanya, melainkan supaya pemanggil yang memang punya hitungan baris tidak
 * perlu memutuskan sendiri apa yang harus dilakukan dengannya. Keputusan itu
 * milik aturan RQ, dan tempatnya di sini.
 *
 * Bila halamannya kebetulan sudah menggenapi juz yang sedang berjalan,
 * capaiannya dinaikkan menjadi juz utuh — "1 juz 20 halaman" bukan cara RQ
 * menyebut dua juz.
 */
export function capaian(
  juzUtuh: number,
  halamanDiJuzBerjalan = 0,
  // Sengaja diterima lalu diabaikan — itulah aturannya, dan parameter yang
  // ada tapi tidak dipakai justru yang membuat aturan itu terbaca di tanda
  // tangan fungsinya.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _baris = 0,
): CapaianHafalan {
  const juz = Math.max(0, Math.floor(juzUtuh))
  const halaman = Math.max(0, Math.floor(halamanDiJuzBerjalan))

  // Juz berikutnya dalam urutan hafalan RQ menentukan berapa halaman yang
  // dibutuhkan untuk naik — dan panjangnya belum tentu 20 (lihat juz 30).
  const berikutnya = juzBerikutnya(juz)
  const panjang = berikutnya ? halamanPerJuz(berikutnya) : 0

  if (panjang > 0 && halaman >= panjang) return { juz: juz + 1, halaman: 0 }
  return { juz, halaman }
}

/**
 * Juz yang sedang dijalani setelah `juzUtuh` juz selesai, menurut urutan
 * hafalan RQ LHI (30, 29, 28, 27, 26, lalu 1…25).
 *
 * Diimpor dari lib/rq/hafalan.ts lewat pemanggil, bukan di sini, supaya modul
 * ini tidak memaksakan urutan apa pun — ia hanya tahu soal halaman.
 */
let urutanHafalan: number[] = [
  30, 29, 28, 27, 26,
  ...Array.from({ length: 25 }, (_, i) => i + 1),
]

function juzBerikutnya(juzUtuh: number): number | null {
  return urutanHafalan[juzUtuh] ?? null
}

/**
 * Pakai urutan hafalan lain — disediakan untuk pengujian, dan untuk jika
 * suatu saat RQ mengubah urutannya tanpa harus menyentuh berkas ini.
 */
export function setUrutanHafalan(urutan: number[]): void {
  urutanHafalan = urutan
}

/**
 * "2 juz 2 halaman" / "3 juz" / "5 halaman" / "Belum ada hafalan".
 *
 * Bagian yang bernilai nol tidak ditulis. "2 juz 0 halaman" memaksa pembaca
 * memproses angka yang tidak membawa kabar apa pun, dan di layar yang berisi
 * ratusan nama, kata yang tidak perlu itu terbaca ratusan kali.
 */
export function formatCapaian(c: CapaianHafalan): string {
  const bagian: string[] = []
  if (c.juz > 0) bagian.push(`${c.juz} juz`)
  if (c.halaman > 0) bagian.push(`${c.halaman} halaman`)
  return bagian.length > 0 ? bagian.join(' ') : 'Belum ada hafalan'
}

/**
 * Berapa halaman UTUH sebuah juz yang sudah dikuasai, bila hafalan anak
 * sampai di (surat, ayat).
 *
 * Inilah hitungan yang sungguh-sungguh — memakai indeks halaman Mushaf
 * Madinah, bukan perkiraan dari jumlah ayat.
 *
 * Halaman tempat ayat itu berada TIDAK dihitung, sebab baru sebagian dibaca
 * — kecuali bila ayat itu memang ayat terakhir pada halaman tersebut, yang
 * berarti halamannya tuntas. Persis aturan "2 juz 2 halaman 3 baris dihitung
 * 2 juz 2 halaman": tiga baris yang menggantung tidak menjadi halaman, tapi
 * halaman yang genap tidak boleh hilang.
 */
export function halamanSelesaiDalamJuz(juz: number, surat: number, ayat: number): number {
  const b = HALAMAN_JUZ[juz]
  if (!b) return 0

  const hlm = halamanDariAyat(surat, ayat)
  if (hlm === null || hlm < b.mulai) return 0
  if (hlm > b.selesai) return halamanPerJuz(juz)

  // Ayat terakhir sebuah halaman = satu ayat sebelum awal halaman berikutnya.
  //
  // Halaman 604 tidak punya halaman sesudahnya, jadi ia perlu patokannya
  // sendiri: ia tuntas bila hafalannya sampai An-Nas 6. Tanpa cabang ini,
  // anak yang hafal seluruh juz 30 terhitung 22 halaman dan bukan 23 —
  // kekeliruan yang hanya muncul pada satu halaman dari 604, tepat pada anak
  // yang paling layak dihitung benar.
  const awalBerikutnya = hlm < TOTAL_HALAMAN ? awalHalaman(hlm + 1) : null
  const halamanIniTuntas =
    awalBerikutnya === null
      ? bandingPosisi({ surat, ayat }, AKHIR_MUSHAF) >= 0
      : sePosisiTepatSebelum({ surat, ayat }, awalBerikutnya)

  const selesai = hlm - b.mulai + (halamanIniTuntas ? 1 : 0)
  return Math.max(0, Math.min(halamanPerJuz(juz), selesai))
}

/**
 * Apakah `a` tepat satu ayat sebelum `b`?
 *
 * Dijawab tanpa memuat panjang surah: bila keduanya di surah yang sama,
 * cukup selisih nomor ayat; bila berpindah surah, `b` harus ayat pertama
 * surah berikutnya — dan berapa pun panjang surah `a`, ayat terakhirnya
 * adalah yang tepat sebelum itu. Yang tidak bisa dipastikan di sini hanyalah
 * apakah `a` memang ayat TERAKHIR surahnya; itu diserahkan ke pemanggil yang
 * punya surat_master.
 */
function sePosisiTepatSebelum(a: PosisiMushaf, b: PosisiMushaf): boolean {
  if (a.surat === b.surat) return a.ayat + 1 === b.ayat
  return b.surat === a.surat + 1 && b.ayat === 1
}

/**
 * Perkiraan halaman dari jumlah ayat yang tercatat pada satu juz.
 *
 * PERKIRAAN, dan namanya sengaja mengatakan begitu. Ayat tidak tersebar rata
 * di halaman — satu halaman juz 30 bisa memuat belasan ayat pendek sementara
 * satu halaman juz 2 memuat dua-tiga ayat panjang.
 *
 * Dipakai HANYA untuk data lama yang cuma menyimpan hitungan ayat
 * (juz_progress.ayat_hafal) tanpa posisi surat & ayat. Begitu setoran
 * mencatat posisinya, pakai halamanSelesaiDalamJuz() yang eksak. Jangan
 * pakai yang ini untuk angka yang dicetak di rapor.
 */
export function perkiraanHalamanDariAyat(juz: number, ayatHafal: number): number {
  const totalAyat = AYAT_PER_JUZ[juz]
  const panjang = halamanPerJuz(juz)
  if (!totalAyat || !panjang || ayatHafal <= 0) return 0
  return Math.min(panjang, Math.floor((ayatHafal / totalAyat) * panjang))
}
