/**
 * Pembaruan Sistem (changelog, 0121) — bagian murni, dipakai server & klien.
 *
 * Kepala RQ mengabarkan perubahan fitur. Pembacanya dipisah per portal karena
 * kebutuhannya berbeda: pengurus perlu tahu perubahan dashboard & analitik,
 * guru perlu tahu perubahan setoran & laporan, karyawan hanya portal profil.
 */

export type JenisChangelog = 'baru' | 'perubahan' | 'perbaikan'
export type PembacaChangelog = 'pengurus' | 'guru' | 'karyawan'

export const URUTAN_JENIS: JenisChangelog[] = ['baru', 'perubahan', 'perbaikan']
export const URUTAN_PEMBACA: PembacaChangelog[] = ['pengurus', 'guru', 'karyawan']

export const LABEL_JENIS: Record<JenisChangelog, string> = {
  baru: 'Fitur baru',
  perubahan: 'Perubahan',
  perbaikan: 'Perbaikan',
}

export const LABEL_PEMBACA: Record<PembacaChangelog, string> = {
  pengurus: 'Pengurus',
  guru: 'Guru',
  karyawan: 'Karyawan',
}

export interface EntriChangelog {
  id: string
  judul: string
  /** Markdown ringan (lib/markdown.ts). */
  isi: string
  jenis: JenisChangelog
  untuk: PembacaChangelog[]
  /** ISO timestamptz. */
  terbit_at: string
}

/** Kunci localStorage penanda "sudah dibaca" per portal. */
export const kunciDibaca = (p: PembacaChangelog) => `changelog:dibaca:${p}`

/** "17 Oktober 2026" (WIB). */
export function tanggalTerbit(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}
