/**
 * Jalur mengaji di luar halaqoh sekolah — tempat anak mendapat waktu tambahan.
 *
 * Keanggotaan tiap jalur tercatat di tabelnya sendiri (ekstra_booking,
 * tr_peserta, asrama_anggota, riyadhoh_peserta), dan setiap setoran membawa
 * penanda jalurnya (ekstra_slot_id, tahsin_rekomendasi, asrama, riyadhoh).
 * Setoran tanpa penanda apa pun = setoran sekolah.
 *
 * Murni, tanpa basis data — pemuatnya di lib/data/jalur-siswa.ts.
 */

export type JalurTambahan = 'ekstra' | 'tr' | 'asrama' | 'riyadhoh'
export type JalurSetoran = 'sekolah' | JalurTambahan

/** Urutan tampil — sekolah selalu pertama. */
export const URUTAN_JALUR: readonly JalurSetoran[] = ['sekolah', 'ekstra', 'tr', 'riyadhoh', 'asrama']

export const LABEL_JALUR: Record<JalurSetoran, string> = {
  sekolah: 'Sekolah',
  ekstra: 'Ekstra',
  tr: 'TR',
  riyadhoh: 'Riyadhoh',
  asrama: 'Boarding',
}

export const KETERANGAN_JALUR: Record<JalurTambahan, string> = {
  ekstra: 'Ikut halaqoh ekstra',
  tr: 'Ikut Tahsin Rekomendasi (Jum’at sore)',
  riyadhoh: 'Ikut Riyadhoh (Sabtu)',
  asrama: 'Anak boarding — setoran asrama',
}

/**
 * Jalur sebuah setoran. Satu setoran hanya punya satu penanda; bila (karena
 * data lama) lebih dari satu menyala, urutan di sini yang menang.
 */
export function jalurSetoran(l: {
  ekstra_slot_id?: string | null
  tahsin_rekomendasi?: boolean | null
  riyadhoh?: boolean | null
  asrama?: boolean | null
}): JalurSetoran {
  if (l.tahsin_rekomendasi) return 'tr'
  if (l.ekstra_slot_id) return 'ekstra'
  if (l.riyadhoh) return 'riyadhoh'
  if (l.asrama) return 'asrama'
  return 'sekolah'
}

/** Capaian satu anak sebulan, per jalur. Tahsin = halaman buku/mushaf lulus; tahfidz = halaman mushaf ziyadah. */
export type CapaianJalur = Partial<Record<JalurSetoran, number>>
