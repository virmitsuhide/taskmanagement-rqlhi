import { HALAMAN_JUZ, AYAT_PER_SURAT } from '@/lib/rq/halaman'
import { awalHalaman, TOTAL_HALAMAN } from '@/lib/rq/batas-halaman'
import type { Jenjang } from '@/types'

/**
 * Hafalan Juz 30 untuk unit yang menghafal MUNDUR per surat — PAUD/TPAIT:
 * An-Nas dulu, lalu Al-Falaq, Al-Ikhlas, … sampai An-Naba'.
 *
 * Satuan juz tidak berguna di sana: hampir semua anak berada di juz 30
 * selama bertahun-tahun, jadi papan "10 besar" berisi deretan "0 juz" dan
 * tabel per juz menumpuk semua anak di satu kolom. Yang membedakan mereka
 * adalah SURAT mana yang sedang dihafal dan berapa HALAMAN yang sudah utuh.
 *
 * Posisi diambil dari setoran ziyadah yang tercatat: surat terjauh dalam
 * urutan mundur (nomor surat terkecil) beserta ayat tertingginya. Semua surat
 * sesudahnya dianggap sudah dihafal — sama dengan cara tabel juz menganggap
 * juz sebelum juz berjalan sudah tuntas.
 */

/** Unit yang capaian tahfidznya diukur per surat & halaman Juz 30. */
export const UNIT_PER_SURAT: ReadonlySet<Jenjang> = new Set<Jenjang>(['paud'])

export const SURAT_AWAL_JUZ30 = 78

/** Urutan hafalan Juz 30 di PAUD: An-Nas (114) → An-Naba' (78). */
export const URUTAN_SURAT_JUZ30: readonly number[] =
  Array.from({ length: 114 - SURAT_AWAL_JUZ30 + 1 }, (_, i) => 114 - i)

export interface PosisiJuz30 {
  surat: number
  /** Ayat tertinggi yang sudah disetor di surat itu. */
  ayat: number
}

export interface SetoranZiyadah {
  surat_id: number
  ayat_dari: number | null
  ayat_ke: number | null
}

/** Surat terjauh (urutan mundur) beserta ayat tertingginya; null = belum ada setoran Juz 30. */
export function posisiJuz30(setoran: SetoranZiyadah[]): PosisiJuz30 | null {
  let pos: PosisiJuz30 | null = null
  for (const s of setoran) {
    if (s.surat_id < SURAT_AWAL_JUZ30 || s.surat_id > 114) continue
    // Tanpa nomor ayat = satu surat penuh disetor.
    const ayat = s.ayat_ke ?? s.ayat_dari ?? AYAT_PER_SURAT[s.surat_id - 1]
    if (!pos || s.surat_id < pos.surat) pos = { surat: s.surat_id, ayat }
    else if (s.surat_id === pos.surat && ayat > pos.ayat) pos.ayat = ayat
  }
  return pos
}

function sudahHafal(p: PosisiJuz30, surat: number, ayat: number): boolean {
  return surat > p.surat || (surat === p.surat && ayat <= p.ayat)
}

/** Jumlah ayat Juz 30 yang terhafal sampai posisi itu — pemisah bila halamannya sama. */
export function ayatJuz30(p: PosisiJuz30 | null): number {
  if (!p) return 0
  let n = Math.min(p.ayat, AYAT_PER_SURAT[p.surat - 1])
  for (let s = p.surat + 1; s <= 114; s++) n += AYAT_PER_SURAT[s - 1]
  return n
}

/**
 * Halaman Juz 30 yang sudah UTUH terhafal, dihitung mundur dari halaman 604.
 * Halaman yang baru sebagian dihafal tidak dihitung — aturan pembulatan ke
 * bawah yang sama dengan lib/rq/halaman.ts.
 */
export function halamanJuz30(p: PosisiJuz30 | null): number {
  if (!p) return 0
  const { mulai, selesai } = HALAMAN_JUZ[30]
  let n = 0
  for (let h = selesai; h >= mulai; h--) {
    const atas = awalHalaman(h)
    if (!atas) break
    // Ayat terakhir halaman = satu ayat sebelum awal halaman berikutnya.
    const berikut = h < TOTAL_HALAMAN ? awalHalaman(h + 1) : null
    const akhir = !berikut ? { surat: 114, ayat: AYAT_PER_SURAT[113] }
      : berikut.ayat > 1 ? { surat: berikut.surat, ayat: berikut.ayat - 1 }
        : { surat: berikut.surat - 1, ayat: AYAT_PER_SURAT[berikut.surat - 2] }
    // Surat paling awal di halaman ini yang menentukan: bagian lainnya
    // (surat bernomor lebih besar) pasti sudah lebih dulu dihafal.
    const ayatTerakhirDiSuratAwal = akhir.surat > atas.surat ? AYAT_PER_SURAT[atas.surat - 1] : akhir.ayat
    if (!sudahHafal(p, atas.surat, ayatTerakhirDiSuratAwal)) break
    n++
  }
  return n
}
