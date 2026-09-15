import { batasJuz, juzSurah } from '@/lib/rq/batas-juz'

/**
 * Cakupan ziyadah dalam satu juz: berapa ayat BERBEDA yang sudah tersetor.
 *
 * KENAPA TIDAK MEMAKAI juz_progress.ayat_hafal
 *
 * Kolom itu menjumlah panjang tiap setoran. Anak yang menyetor An-Naba 1–10
 * dua kali tercatat 20 ayat, sehingga juz bisa terbaca penuh padahal
 * separuhnya belum pernah disentuh. Di sini tiap ayat dihitung sekali, dan
 * batas juznya diambil dari mushaf (lib/rq/batas-juz.ts) — surat yang
 * membentang dua juz dipotong di tempat yang benar.
 *
 * Arah menghafal tidak berpengaruh: juz 30 yang dihafal dari An-Nas naik ke
 * An-Naba tuntas di hari yang sama dengan yang dihafal dari An-Naba turun,
 * yaitu hari ayat terakhir yang BELUM tersetor akhirnya disetor.
 */

export interface SetoranAyat {
  surat_id: number
  ayat_dari: number
  ayat_ke: number
}

export interface CakupanJuz {
  juz: number
  tersetor: number
  total: number
  tuntas: boolean
}

/**
 * @param panjangSurat nomor surat → jumlah ayatnya (dari surat_master).
 *   Surat yang tidak ada di peta dianggap tidak diketahui panjangnya, dan juz
 *   yang memuatnya tidak pernah dinyatakan tuntas — lebih aman tertunda
 *   daripada tuntas atas angka tebakan.
 */
export function cakupanJuz(juz: number, setoran: SetoranAyat[], panjangSurat: Map<number, number>): CakupanJuz {
  const batas = batasJuz(juz)
  if (!batas) return { juz, tersetor: 0, total: 0, tuntas: false }

  let total = 0
  let tersetor = 0
  let panjangLengkap = true

  for (let surat = batas.mulai.surat; surat <= batas.selesai.surat; surat++) {
    const panjang = panjangSurat.get(surat)
    if (!panjang) { panjangLengkap = false; continue }
    const awal = surat === batas.mulai.surat ? batas.mulai.ayat : 1
    const akhir = surat === batas.selesai.surat ? batas.selesai.ayat : panjang
    total += akhir - awal + 1

    const sudah = new Set<number>()
    for (const s of setoran) {
      if (s.surat_id !== surat) continue
      const dari = Math.max(awal, s.ayat_dari)
      const ke = Math.min(akhir, s.ayat_ke)
      for (let a = dari; a <= ke; a++) sudah.add(a)
    }
    tersetor += sudah.size
  }

  return { juz, tersetor, total, tuntas: panjangLengkap && total > 0 && tersetor >= total }
}

/** Juz yang tersentuh satu setoran — surat panjang bisa menyentuh lebih dari satu. */
export function juzTersentuh(s: SetoranAyat): number[] {
  return juzSurah(s.surat_id).filter(j => {
    const b = batasJuz(j)!
    const awal = s.surat_id === b.mulai.surat ? b.mulai.ayat : 1
    const akhir = s.surat_id === b.selesai.surat ? b.selesai.ayat : Number.POSITIVE_INFINITY
    return s.ayat_ke >= awal && s.ayat_dari <= akhir
  })
}
