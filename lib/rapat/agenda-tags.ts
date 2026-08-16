import type { AgendaTag } from '@/types'

/**
 * Warna per tag agenda — dipakai bersama oleh form notulen dan halaman detail
 * rapat, supaya satu tag terlihat sama di mana pun ia muncul.
 *
 * `bar`   : garis aksen vertikal di sisi kiri kartu poin.
 * `badge` : latar + teks untuk lencana tag.
 */
export const AGENDA_TAG_STYLES: Record<AgendaTag, { badge: string; bar: string }> = {
  keputusan: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    bar: 'bg-blue-500',
  },
  informasi: {
    badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    bar: 'bg-green-500',
  },
  perlu_diskusi: {
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    bar: 'bg-purple-500',
  },
  tindak_lanjut: {
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
    bar: 'bg-orange-500',
  },
  approval: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
    bar: 'bg-amber-500',
  },
}

/** Dipakai bila ada baris lama dengan tag di luar daftar (mis. data pra-migrasi). */
export const AGENDA_TAG_STYLE_FALLBACK = {
  badge: 'bg-muted text-muted-foreground border-border',
  bar: 'bg-muted-foreground',
}

export function agendaTagStyle(tag: AgendaTag | string) {
  return AGENDA_TAG_STYLES[tag as AgendaTag] ?? AGENDA_TAG_STYLE_FALLBACK
}
