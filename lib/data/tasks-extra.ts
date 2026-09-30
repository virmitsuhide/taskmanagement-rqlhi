import { createServerClient } from '@/lib/supabase/server'

/** Selisih WIB terhadap UTC (tanpa DST). */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export interface CompletedWeek {
  /** Senin awal pekan (YYYY-MM-DD, WIB). */
  weekStart: string
  count: number
  isCurrent: boolean
}

/** Awal pekan (Senin 00:00 WIB) yang memuat `t`, dalam epoch ms (UTC). */
function wibWeekStartMs(t: number): number {
  const wib = new Date(t + WIB_OFFSET_MS)
  const dow = (wib.getUTCDay() + 6) % 7 // 0 = Senin
  const midnightWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate())
  return midnightWib - dow * DAY_MS - WIB_OFFSET_MS
}

/**
 * Jumlah tugas milik `userId` (assigned_to) yang selesai per pekan, 8 pekan
 * terakhir termasuk pekan ini. Cakupan sama dengan tab "Selesai" di /tasks:
 * assigned_to = user, status = 'done', deleted_at null.
 *
 * Waktu selesai = `verified_at` (diisi updateTaskStatusAction saat status
 * menjadi 'done'); bila kosong (data lama) jatuh ke `updated_at`.
 */
export async function getCompletedTasksByWeek(userId: string, weeks = 8): Promise<CompletedWeek[]> {
  const supabase = createServerClient()
  const currentStart = wibWeekStartMs(Date.now())
  const firstStart = currentStart - (weeks - 1) * WEEK_MS
  const fromIso = new Date(firstStart).toISOString()

  const { data, error } = await supabase
    .from('tasks')
    .select('verified_at, updated_at')
    .eq('assigned_to', userId)
    .eq('status', 'done')
    .is('deleted_at', null)
    .or(`verified_at.gte.${fromIso},and(verified_at.is.null,updated_at.gte.${fromIso})`)
    .limit(2000)

  const counts = new Array<number>(weeks).fill(0)
  if (!error) {
    for (const row of (data ?? []) as { verified_at: string | null; updated_at: string }[]) {
      const t = Date.parse(row.verified_at ?? row.updated_at)
      if (Number.isNaN(t)) continue
      const idx = Math.floor((wibWeekStartMs(t) - firstStart) / WEEK_MS)
      if (idx >= 0 && idx < weeks) counts[idx]++
    }
  }

  return counts.map((count, i) => {
    const start = firstStart + i * WEEK_MS
    return {
      weekStart: new Date(start + WIB_OFFSET_MS).toISOString().slice(0, 10),
      count,
      isCurrent: i === weeks - 1,
    }
  })
}
