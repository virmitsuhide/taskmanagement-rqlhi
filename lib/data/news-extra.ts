/**
 * Data tambahan berita: hitungan dibaca & kesiapan kolom status.
 * Semua fungsi aman dipanggil sebelum migrasi 0107 dijalankan — gagal
 * diam-diam dan mengembalikan nilai "belum tersedia".
 */
import { createServerClient } from '@/lib/supabase/server'

/** true bila kolom status/publish_at/view_count sudah ada di news_articles. */
export async function newsStatusColumnsReady(): Promise<boolean> {
  try {
    const supabase = createServerClient()
    const { error } = await supabase
      .from('news_articles')
      .select('status, publish_at, view_count')
      .limit(1)
    return !error
  } catch {
    return false
  }
}

/** +1 dibaca (total & harian) lewat RPC increment_news_view. No-op sebelum migrasi. */
export async function incrementNewsView(id: string): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.rpc('increment_news_view', { p_id: id })
  } catch {
    // fungsi belum ada / jaringan gagal — hitungan dibaca bukan hal kritis
  }
}

export interface NewsReadStats {
  /** Dibaca 30 hari terakhir (hari ini termasuk, tanggal WIB). */
  last30: number
  /** 30 hari sebelumnya, untuk perbandingan. */
  prev30: number
}

/** Jumlah dibaca 30 hari terakhir vs 30 hari sebelumnya; null sebelum migrasi. */
export async function getNewsReadStats(): Promise<NewsReadStats | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.rpc('news_views_summary')
    if (error) return null
    const row = (Array.isArray(data) ? data[0] : data) as { last30?: number | string; prev30?: number | string } | null
    if (!row) return { last30: 0, prev30: 0 }
    return { last30: Number(row.last30 ?? 0), prev30: Number(row.prev30 ?? 0) }
  } catch {
    return null
  }
}
