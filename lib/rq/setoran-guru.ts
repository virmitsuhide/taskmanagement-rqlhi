import { juzDariAyat } from '@/lib/rq/batas-juz'
import { halamanPerJuz, halamanSelesaiDalamJuz } from '@/lib/rq/halaman'

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
 * Juz berjalan dibaca dari posisi ayat terakhir; halaman dihitung dengan
 * indeks Mushaf Madinah (pembulatan ke bawah, aturan RQ). Bila halamannya
 * menggenapi juz itu, ia naik menjadi satu juz utuh. `juz_selesai` diisi SDM —
 * urutan hafalan guru dewasa tidak selalu 30, 29, 28 seperti anak.
 */
export function posisiHafalan(s: Pick<SetoranGuru, 'surat_id' | 'ayat_ke' | 'juz_selesai'>): PosisiHafalanGuru {
  const juzAwal = Math.max(0, s.juz_selesai ?? 0)
  if (!s.surat_id || !s.ayat_ke) return { juz: juzAwal, halaman: 0, juzBerjalan: null }
  const juzBerjalan = juzDariAyat(s.surat_id, s.ayat_ke)
  if (!juzBerjalan) return { juz: juzAwal, halaman: 0, juzBerjalan: null }
  const halaman = halamanSelesaiDalamJuz(juzBerjalan, s.surat_id, s.ayat_ke)
  if (halaman >= halamanPerJuz(juzBerjalan)) return { juz: juzAwal + 1, halaman: 0, juzBerjalan }
  return { juz: juzAwal, halaman, juzBerjalan }
}

export function labelPosisi(p: PosisiHafalanGuru): string {
  const bagian = [p.juz ? `${p.juz} juz` : '', p.halaman ? `${p.halaman} hlm` : ''].filter(Boolean)
  return bagian.join(' ') || '0 hlm'
}
