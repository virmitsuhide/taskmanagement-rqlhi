/**
 * Level anak boarding (0110) — dari pembagian halaqoh asrama: High, Middle,
 * Low, dan Spesial (anak yang perlu pendampingan khusus).
 *
 * Berkas ini murni (tanpa server), supaya lencananya bisa dipakai komponen
 * klien maupun server.
 */

export type LevelAsrama = 'high' | 'middle' | 'low' | 'spesial'

export const URUTAN_LEVEL: LevelAsrama[] = ['high', 'middle', 'low', 'spesial']

export const LABEL_LEVEL: Record<LevelAsrama, string> = {
  high: 'High',
  middle: 'Middle',
  low: 'Low',
  spesial: 'Spesial',
}

/**
 * Warna lencana. Level BUKAN status baik/buruk, jadi tidak memakai
 * success/warning/destructive — "Low" berwarna merah akan terbaca sebagai
 * vonis untuk anak, padahal artinya hanya kelompok belajarnya.
 */
export const WARNA_LEVEL: Record<LevelAsrama, string> = {
  high: 'border-primary/40 bg-primary-wash text-primary',
  middle: 'border-info/40 bg-info-wash text-info',
  low: 'border-border bg-muted text-foreground',
  spesial: 'border-accent-foreground/30 bg-accent text-accent-foreground',
}

export function levelSah(v: unknown): LevelAsrama | null {
  return URUTAN_LEVEL.includes(v as LevelAsrama) ? (v as LevelAsrama) : null
}

export const LABEL_GENDER_ASRAMA: Record<'L' | 'P', string> = {
  L: 'Asrama Putra',
  P: 'Asrama Putri',
}

/**
 * Setoran TAHSIN lewat jalur asrama — DITUTUP sementara (keputusan RQ
 * 2026-10-01). Posisi tahsin anak boarding ditetapkan dulu oleh capaian yang
 * diinput pengampu sekolah; pengampu asrama untuk sementara hanya melihatnya
 * di Tahsin Asrama dan mencatat tahfidz. Ubah ke true untuk membukanya —
 * formulir dan server action sama-sama membaca konstanta ini.
 */
export const TAHSIN_ASRAMA_DIBUKA = false
