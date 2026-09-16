import { TOTAL_HALAMAN, awalHalaman, halamanDariAyat } from '@/lib/rq/batas-halaman'

/**
 * Bacaan mushaf pada satu setoran tahsin.
 *
 * KENAPA HALAMAN DAN SURAT/AYAT HIDUP BERDAMPINGAN
 *
 * Keduanya menunjuk tempat yang sama, tapi menjawab pertanyaan yang berbeda.
 * Halaman menjawab "sudah sampai mana" — guru dan koordinator memakainya untuk
 * mengukur laju, karena 604 halaman adalah satuan yang bisa dibagi dan
 * dipersentasekan. Surat & ayat menjawab "sedang membaca apa" — itu yang
 * ditulis di rapor dan yang dikenali wali murid; tidak ada orang tua yang
 * bertanya anaknya sudah halaman berapa.
 *
 * Tabel AWAL_HALAMAN hanya tahu ayat PERTAMA tiap halaman, jadi arah
 * turunannya tidak setara: dari surat+ayat halamannya pasti, tapi dari halaman
 * hanya titik AWALnya yang bisa dipulihkan — sampai ayat berapa anak berhenti
 * tidak. Itulah sebabnya keduanya disimpan, bukan salah satu.
 *
 * ⚠️ Semua di sini mengikuti MUSHAF MADINAH (604 halaman). Lihat peringatan di
 *    lib/rq/batas-halaman.ts.
 */
export interface BacaanQuran {
  halaman: number | null
  surat_id: number | null
  ayat_dari: number | null
  ayat_ke: number | null
}

export const HALAMAN_MIN = 1
export const HALAMAN_MAKS = TOTAL_HALAMAN

/** Kosong sama sekali — belum ada yang diisi guru. */
export function bacaanKosong(b: BacaanQuran): boolean {
  return b.halaman === null && b.surat_id === null && b.ayat_dari === null && b.ayat_ke === null
}

/**
 * Isian awal saat guru baru mengetik nomor halaman: surat & ayat pembukanya.
 * Guru tinggal membetulkan ayat akhirnya kalau bacaan hari itu berhenti di
 * tengah halaman.
 */
export function usulanDariHalaman(halaman: number): { surat_id: number; ayat_dari: number } | null {
  const p = awalHalaman(halaman)
  return p ? { surat_id: p.surat, ayat_dari: p.ayat } : null
}

/** Halaman tempat sebuah ayat berada — untuk mengisi balik kolom halaman. */
export function halamanDariBacaan(surat_id: number, ayat: number): number | null {
  return halamanDariAyat(surat_id, ayat)
}

interface OpsiPeriksa {
  /** Panjang surah dari surat_master; null bila suratnya tidak dikenal. */
  totalAyat?: number | null
  /** Tahap ini memang mencatat bacaan mushaf, jadi kosong tidak boleh. */
  wajib: boolean
}

/**
 * Periksa satu bacaan. Mengembalikan pesan galat, atau null bila sah.
 *
 * Pemeriksaan silang halaman ↔ ayat sengaja LONGGAR: sebuah bacaan boleh
 * melewati pergantian halaman, jadi yang dituntut hanyalah nomor halaman
 * berada di antara halaman ayat pertama dan halaman ayat terakhir. Menuntut
 * kecocokan persis akan menolak "halaman 3, Al-Baqarah 17–25" yang justru
 * benar — halaman 3 memang berakhir di ayat 16.
 */
export function periksaBacaanQuran(b: BacaanQuran, opsi: OpsiPeriksa): string | null {
  if (bacaanKosong(b)) {
    return opsi.wajib ? 'Progres Al-Qur’an belum diisi.' : null
  }

  if (b.halaman !== null && (!Number.isInteger(b.halaman) || b.halaman < HALAMAN_MIN || b.halaman > HALAMAN_MAKS)) {
    return `Halaman mushaf harus ${HALAMAN_MIN}–${HALAMAN_MAKS}.`
  }
  if (b.surat_id !== null && (!Number.isInteger(b.surat_id) || b.surat_id < 1 || b.surat_id > 114)) {
    return 'Surat tidak dikenal.'
  }
  if (b.ayat_ke !== null && b.ayat_dari === null) {
    return 'Ayat akhir terisi tapi ayat awalnya kosong.'
  }
  if (b.ayat_dari !== null && (!Number.isInteger(b.ayat_dari) || b.ayat_dari < 1)) {
    return 'Ayat awal minimal 1.'
  }
  if (b.ayat_dari !== null && b.ayat_ke !== null && b.ayat_ke < b.ayat_dari) {
    return 'Ayat akhir tidak boleh sebelum ayat awal.'
  }
  if (b.ayat_dari !== null && b.surat_id === null) {
    return 'Ayat terisi tapi suratnya belum dipilih.'
  }
  if (opsi.totalAyat && b.ayat_ke !== null && b.ayat_ke > opsi.totalAyat) {
    return `Surat ini hanya ${opsi.totalAyat} ayat.`
  }
  if (opsi.totalAyat && b.ayat_dari !== null && b.ayat_dari > opsi.totalAyat) {
    return `Surat ini hanya ${opsi.totalAyat} ayat.`
  }

  // Halaman harus memuat bacaannya — lihat catatan "longgar" di atas.
  if (b.halaman !== null && b.surat_id !== null && b.ayat_dari !== null) {
    const awal = halamanDariAyat(b.surat_id, b.ayat_dari)
    const akhir = halamanDariAyat(b.surat_id, b.ayat_ke ?? b.ayat_dari)
    if (awal !== null && akhir !== null && (b.halaman < awal || b.halaman > akhir)) {
      return awal === akhir
        ? `Bacaan itu ada di halaman ${awal}, bukan ${b.halaman}.`
        : `Bacaan itu ada di halaman ${awal}–${akhir}, bukan ${b.halaman}.`
    }
  }

  return null
}

/**
 * Posisi berikutnya setelah bacaan yang LULUS — titik berangkat setoran
 * selanjutnya. Anak melanjutkan dari ayat sesudah yang terakhir dibaca, bukan
 * dari halaman berikutnya: bacaan sering berhenti di tengah halaman, dan
 * melompat ke halaman baru akan melewatkan sisanya tanpa pernah tercatat.
 */
export function posisiLanjut(
  b: BacaanQuran,
  /** Panjang surah yang baru dibaca; tanpa ini akhir surah tidak bisa dikenali. */
  totalAyat?: number | null,
): { halaman: number | null; surat_id: number | null; ayat: number | null } {
  if (b.surat_id === null || b.ayat_ke === null) {
    return { halaman: b.halaman, surat_id: b.surat_id, ayat: b.ayat_dari }
  }
  // Habis satu surah, lanjut ke surah berikutnya — bukan ke ayat yang tidak
  // ada. An-Nas (114) tidak punya penerus, jadi posisinya berhenti di situ.
  const habis = Boolean(totalAyat) && b.ayat_ke >= totalAyat!
  const surat = habis ? (b.surat_id < 114 ? b.surat_id + 1 : b.surat_id) : b.surat_id
  const ayat = habis ? (b.surat_id < 114 ? 1 : b.ayat_ke) : b.ayat_ke + 1
  const halaman = halamanDariAyat(surat, ayat)
  return { halaman: halaman ?? b.halaman, surat_id: surat, ayat }
}
