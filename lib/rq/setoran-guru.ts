import { URUTAN_JUZ } from '@/lib/rq/hafalan'
import { halamanPerJuz, halamanSelesaiDalamJuz, juzMushafDariAyat } from '@/lib/rq/halaman'

/**
 * Bagian murni Setoran Guru (0096) — dipakai server (isian KPI) dan peramban
 * (pratinjau posisi saat SDM mengetik). Tidak boleh mengimpor klien database.
 */

export type JenisSetoranGuru = 'tahfidz' | 'tuhfatul'

export interface SetoranGuru {
  id: string
  teacher_id: string
  tanggal: string
  jenis: JenisSetoranGuru
  surat_id: number | null
  ayat_dari: number | null
  ayat_ke: number | null
  juz_selesai: number | null
  bait_dari: number | null
  bait_ke: number | null
  nilai: number | null
  catatan: string
  created_at: string
}

/** Posisi hafalan Al-Qur'an dari satu setoran tahfidz: juz utuh + halaman utuh di juz berjalan. */
export interface PosisiHafalanGuru {
  juz: number
  halaman: number
  /** Juz tempat ayat terakhir berada. */
  juzBerjalan: number | null
}

/**
 * Posisi hafalan dari ayat terakhir — rumus yang sama dengan setoran anak.
 *
 * Urutan hafalan RQ: 30, 29, 28, 27, 26 (sampai Al-Ahqaf 1), lalu 1…25
 * (berakhir Al-Jasiyah 37). Juz yang mendahului juz berjalan dalam urutan itu
 * dihitung tuntas; juz berjalan dihitung halaman utuhnya (indeks Mushaf
 * Madinah, pembulatan ke bawah), dan naik menjadi satu juz bila genap.
 *
 * Kolom `juz_selesai` tidak lagi dibaca (dulu diisi SDM manual); kini ia
 * sekadar menyimpan hasil hitungan ini saat setoran dicatat.
 */
export function posisiHafalan(s: Pick<SetoranGuru, 'surat_id' | 'ayat_ke'>): PosisiHafalanGuru {
  if (!s.surat_id || !s.ayat_ke) return { juz: 0, halaman: 0, juzBerjalan: null }
  const juzBerjalan = juzMushafDariAyat(s.surat_id, s.ayat_ke)
  const urutanKe = URUTAN_JUZ.indexOf(juzBerjalan)
  if (urutanKe === -1) return { juz: 0, halaman: 0, juzBerjalan: null }
  const halaman = halamanSelesaiDalamJuz(juzBerjalan, s.surat_id, s.ayat_ke)
  if (halaman >= halamanPerJuz(juzBerjalan)) return { juz: urutanKe + 1, halaman: 0, juzBerjalan }
  return { juz: urutanKe, halaman, juzBerjalan }
}

export function labelPosisi(p: PosisiHafalanGuru): string {
  const bagian = [p.juz ? `${p.juz} juz` : '', p.halaman ? `${p.halaman} hlm` : ''].filter(Boolean)
  return bagian.join(' ') || '0 hlm'
}
