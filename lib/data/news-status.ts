/**
 * Status tayang berita — logika murni (aman dipakai server maupun client).
 *
 * Kolom `status`, `publish_at`, dan `view_count` baru ada setelah migrasi
 * drizzle/0107_berita_status_dan_dibaca. Sebelum itu barisnya tidak memuat
 * kunci tersebut, sehingga semuanya dibaca opsional: tanpa kolom `status`
 * sebuah berita dianggap 'terbit', tanpa `publish_at` dianggap sudah tayang.
 */
import type { NewsArticle } from '@/types'

export type NewsRow = NewsArticle & {
  status?: string | null
  publish_at?: string | null
  view_count?: number | null
}

export type NewsDisplayStatus = 'draf' | 'terjadwal' | 'terbit' | 'nonaktif'

export const NEWS_STATUS_LABEL: Record<NewsDisplayStatus, string> = {
  draf: 'Draf',
  terjadwal: 'Terjadwal',
  terbit: 'Terbit',
  nonaktif: 'Nonaktif',
}

function isFuture(ts: string | null | undefined, now: Date) {
  if (!ts) return false
  const t = new Date(ts).getTime()
  return Number.isFinite(t) && t > now.getTime()
}

/** Draf > Nonaktif > Terjadwal > Terbit. */
export function newsDisplayStatus(row: NewsRow, now: Date = new Date()): NewsDisplayStatus {
  if ((row.status ?? 'terbit') === 'draf') return 'draf'
  if (!row.is_active) return 'nonaktif'
  if (isFuture(row.publish_at, now)) return 'terjadwal'
  return 'terbit'
}

/** Boleh tampil di halaman publik (beranda, /news, /news/[id]). */
export function isNewsPublic(row: NewsRow, now: Date = new Date()): boolean {
  return newsDisplayStatus(row, now) === 'terbit'
}

/** Tanggal tayang efektif: jadwal/waktu terbit bila ada, selain itu tanggal dibuat. */
export function newsPublishedAt(row: NewsRow): string {
  return row.publish_at || row.created_at
}

/**
 * Untuk halaman publik: saring yang boleh tampil, ganti `created_at` dengan
 * tanggal tayang efektif (semua tampilan publik memakai `created_at` sebagai
 * tanggal berita), lalu urutkan terbaru dulu.
 */
export function publicNews<T extends NewsRow>(rows: T[], now: Date = new Date()): T[] {
  return rows
    .filter(r => isNewsPublic(r, now))
    .map(r => ({ ...r, created_at: newsPublishedAt(r) }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

/** Kolom status sudah ada di baris ini (migrasi 0107 sudah dijalankan). */
export function hasStatusColumns(row: object | null | undefined): boolean {
  return !!row && 'status' in row && 'publish_at' in row
}

/** ISO → nilai <input type="datetime-local"> dalam WIB (UTC+7). */
export function toWibInputValue(ts: string | null | undefined): string {
  if (!ts) return ''
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return ''
  return new Date(t + 7 * 3600_000).toISOString().slice(0, 16)
}

/** Nilai datetime-local (dibaca sebagai WIB) → ISO; null bila tidak valid. */
export function fromWibInputValue(value: string | null | undefined): string | null {
  if (!value) return null
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim())
  if (!m) return null
  const d = new Date(`${m[1]}T${m[2]}:00+07:00`)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}
