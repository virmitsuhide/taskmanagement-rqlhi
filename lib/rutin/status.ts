import type { RoutineOutcome } from '@/types'

/**
 * Kosakata status pelaksanaan tugas rutin.
 *
 * Dipisah dari periode.ts karena menjawab pertanyaan yang berbeda: periode.ts
 * soal "kapan", berkas ini soal "bagaimana hasilnya". Keduanya dipakai
 * bersamaan hampir di mana-mana, tapi menggabungkannya membuat satu berkas
 * yang berubah karena dua alasan yang tidak berkaitan.
 *
 * Semua label di sini dibaca pengurus dan kepala RQ, jadi bunyinya dijaga
 * konsisten: tiga keadaan, tiga sebutan tetap — Belum dilaporkan, Terlaksana,
 * Tidak terlaksana.
 */

/** Panjang maksimal alasan tidak terlaksana. */
export const MAX_ALASAN = 500

export const OUTCOME_LABELS: Record<RoutineOutcome, string> = {
  terlaksana: 'Terlaksana',
  tidak_terlaksana: 'Tidak terlaksana',
}

/** Sebutan untuk baris yang belum dilaporkan sama sekali pada periode ini. */
export const BELUM_LABEL = 'Belum dilaporkan'

/**
 * Warna lencana tiap keadaan.
 *
 * "Belum" sengaja abu-abu, bukan merah. Periode yang sedang berjalan belum
 * berakhir — tugas pekanan yang belum disentuh hari Selasa bukan kelalaian,
 * dan mewarnainya merah membuat papan kepala RQ menyala setiap awal pekan
 * sampai tidak ada yang memperhatikannya lagi. Merah disimpan untuk satu hal
 * yang memang butuh perhatian: laporan tidak terlaksana.
 */
export const OUTCOME_BADGE: Record<RoutineOutcome, string> = {
  terlaksana: 'border-success/25 bg-success-wash text-success',
  tidak_terlaksana: 'border-destructive/25 bg-destructive-wash text-destructive',
}

export const BELUM_BADGE = 'border-border bg-muted text-muted-foreground'

export function isOutcome(v: unknown): v is RoutineOutcome {
  return v === 'terlaksana' || v === 'tidak_terlaksana'
}

/** Lencana untuk keadaan apa pun, termasuk null (belum dilaporkan). */
export function badgeKelas(outcome: RoutineOutcome | null): string {
  return outcome ? OUTCOME_BADGE[outcome] : BELUM_BADGE
}

export function labelStatus(outcome: RoutineOutcome | null): string {
  return outcome ? OUTCOME_LABELS[outcome] : BELUM_LABEL
}
