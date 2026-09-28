import type { SasaranPanduan } from '@/lib/auth/permissions'

/** Panduan Guru (0104) — bagian murni, dipakai server maupun peramban. */

export const BUCKET_PANDUAN = 'panduan-guru'
export const MAKS_UKURAN_PANDUAN = 25 * 1024 * 1024

export type KategoriPanduan = 'sop_kepegawaian' | 'sop_pembelajaran' | 'sop_keuangan' | 'dokumen'

export const URUTAN_KATEGORI_PANDUAN: KategoriPanduan[] = ['sop_kepegawaian', 'sop_pembelajaran', 'sop_keuangan', 'dokumen']

export const LABEL_KATEGORI_PANDUAN: Record<KategoriPanduan, string> = {
  sop_kepegawaian: 'SOP Kepegawaian',
  sop_pembelajaran: 'SOP Pembelajaran',
  sop_keuangan: 'SOP Keuangan',
  dokumen: 'Dokumen Penting',
}

export const LABEL_SASARAN_PANDUAN: Record<SasaranPanduan, string> = {
  semua: 'Semua guru',
  paud: 'Guru TPAIT',
  sd: 'Guru SD',
  sd_juara: 'Guru SD Juara',
  smp: 'Guru SMP',
  sma: 'Guru SMA',
  quls_sd: 'Guru QULS SD',
}

export function ukuranTeks(byte: number | null): string {
  if (!byte) return ''
  return byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`
}
