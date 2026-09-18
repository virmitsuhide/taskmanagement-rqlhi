/**
 * Rentang setoran tahfidz yang boleh melewati beberapa surat (muroja'ah, 0076).
 *
 * surat_ke_id NULL = satu surat: ayat_dari..ayat_ke di surat_id.
 * surat_ke_id terisi = surat_id dari ayat_dari sampai habis, surat-surat di
 * antaranya utuh, lalu surat_ke_id ayat 1..ayat_ke. Arahnya boleh maju atau
 * mundur menurut nomor surat — tiap surat tetap dibaca dari awal ke akhir,
 * jadi rumus jumlah ayatnya sama untuk kedua arah.
 *
 * Murni (tanpa akses DB) supaya dipakai bersama formulir dan server.
 */

/** Jenis setoran yang boleh lintas surat. */
export const JENIS_LINTAS_SURAT = ['murojaah_baru', 'murojaah_lama', 'murojaah'] as const

export function bolehLintasSurat(kind: string): boolean {
  return (JENIS_LINTAS_SURAT as readonly string[]).includes(kind)
}

export interface RentangSurat {
  surat_id: number
  ayat_dari: number
  /** NULL atau sama dengan surat_id = satu surat. */
  surat_ke_id: number | null
  ayat_ke: number
}

export function lintasSurat(r: Pick<RentangSurat, 'surat_id' | 'surat_ke_id'>): boolean {
  return r.surat_ke_id !== null && r.surat_ke_id !== r.surat_id
}

/** Nomor surat yang dilewati, berurutan menurut arah bacaannya. */
export function suratDilewati(dari: number, ke: number): number[] {
  const langkah = ke >= dari ? 1 : -1
  const hasil: number[] = []
  for (let s = dari; s !== ke + langkah; s += langkah) hasil.push(s)
  return hasil
}

/** Jumlah ayat dalam rentang. `totalAyat` = jumlah ayat sebuah surat. */
export function jumlahAyatRentang(r: RentangSurat, totalAyat: (surat: number) => number): number {
  if (!lintasSurat(r)) return Math.max(0, r.ayat_ke - r.ayat_dari + 1)
  const urut = suratDilewati(r.surat_id, r.surat_ke_id!)
  let n = Math.max(0, totalAyat(r.surat_id) - r.ayat_dari + 1)
  for (const s of urut.slice(1, -1)) n += totalAyat(s)
  return n + r.ayat_ke
}

/**
 * "An-Naba 1–40" atau "An-Naba 30 – An-Nazi'at 20".
 * Spasi di sekitar tanda pisah lintas surat supaya tidak terbaca sebagai
 * "30–An-Nazi'at".
 */
export function teksRentang(namaAwal: string, dari: number | null, namaAkhir: string | null, ke: number | null): string {
  if (namaAkhir && namaAkhir !== namaAwal) return `${namaAwal} ${dari ?? ''} – ${namaAkhir} ${ke ?? ''}`.trim()
  if (dari === null) return namaAwal
  return `${namaAwal} ${dari}${ke !== null && ke !== dari ? `–${ke}` : ''}`
}

/** Pesan galat rentang, atau null bila sah. Dipakai formulir dan server. */
export function periksaRentang(
  r: RentangSurat,
  info: (surat: number) => { name_latin: string; total_ayat: number } | undefined,
): string | null {
  const awal = info(r.surat_id)
  if (!awal) return 'Surat tidak ditemukan.'
  if (r.ayat_dari < 1 || r.ayat_ke < 1) return 'Nomor ayat mulai dari 1.'
  if (!lintasSurat(r)) {
    if (r.ayat_ke < r.ayat_dari) return 'Ayat akhir tidak boleh lebih kecil dari ayat awal.'
    if (r.ayat_ke > awal.total_ayat) return `Surat ${awal.name_latin} hanya punya ${awal.total_ayat} ayat.`
    return null
  }
  const akhir = info(r.surat_ke_id!)
  if (!akhir) return 'Surat akhir tidak ditemukan.'
  if (r.ayat_dari > awal.total_ayat) return `Surat ${awal.name_latin} hanya punya ${awal.total_ayat} ayat.`
  if (r.ayat_ke > akhir.total_ayat) return `Surat ${akhir.name_latin} hanya punya ${akhir.total_ayat} ayat.`
  return null
}
