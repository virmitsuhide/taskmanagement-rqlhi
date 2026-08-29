import { createServerClient } from '@/lib/supabase/server'
import { kunciPeriode } from '@/lib/rutin/periode'
import type { RoutineCadence, RoutineTask, RoutineTaskState } from '@/types'

/**
 * Lapisan data Tugas Rutin.
 *
 * Cakupannya selalu satu orang: tugas rutin adalah alat kerja pribadi, dan
 * tidak ada tampilan mana pun yang memperlihatkan milik orang lain. Karena itu
 * di sini tidak ada matriks izin — pemanggilnya cukup memberi userId dari
 * sesinya sendiri.
 */

/** Isi checklist satu irama pada periode yang sedang berjalan. */
export interface RoutineGroup {
  cadence: RoutineCadence
  /** Kunci periode berjalan, mis. '2026-W36'. */
  period: string
  items: RoutineTaskState[]
  done: number
  total: number
}

/**
 * Checklist lengkap seorang pengurus untuk periode berjalan.
 *
 * Dua query, berapa pun banyaknya tugas: satu untuk daftarnya, satu untuk
 * centang periode ini. Centangnya dicari dengan `period IN (…)` — dua kunci
 * saja, karena pekanan dan bulanan punya kunci yang berbeda bentuk.
 */
export async function getRoutineChecklist(userId: string): Promise<RoutineGroup[]> {
  const supabase = createServerClient()

  const { data: taskData } = await supabase
    .from('routine_tasks')
    .select('*')
    .eq('owner_id', userId)
    .order('cadence', { ascending: true })
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })

  const tasks = (taskData ?? []) as RoutineTask[]

  const periods: Record<RoutineCadence, string> = {
    pekanan: kunciPeriode('pekanan'),
    bulanan: kunciPeriode('bulanan'),
  }

  // Tanpa satu pun tugas, tidak ada yang perlu dicari centangnya.
  const checked = new Map<string, string>()
  if (tasks.length > 0) {
    const { data: checkData } = await supabase
      .from('routine_task_checks')
      .select('task_id, checked_at')
      .in('task_id', tasks.map(t => t.id))
      .in('period', [periods.pekanan, periods.bulanan])

    for (const c of (checkData ?? []) as { task_id: string; checked_at: string }[]) {
      checked.set(c.task_id, c.checked_at)
    }
  }

  // Kedua kelompok selalu ditampilkan, termasuk saat kosong: halaman yang
  // hanya memunculkan kelompok berisi membuat orang mengira ia belum pernah
  // membuat tugas bulanan padahal ia hanya belum sampai ke sana.
  return (['pekanan', 'bulanan'] as RoutineCadence[]).map(cadence => {
    const items: RoutineTaskState[] = tasks
      .filter(t => t.cadence === cadence)
      .map(task => ({
        task,
        done: checked.has(task.id),
        checkedAt: checked.get(task.id) ?? null,
      }))
    return {
      cadence,
      period: periods[cadence],
      items,
      done: items.filter(i => i.done).length,
      total: items.length,
    }
  })
}

/** Satu tugas rutin milik pengguna ini — null bila bukan miliknya. */
export async function getRoutineTask(id: string, userId: string): Promise<RoutineTask | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('routine_tasks')
    .select('*')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()
  return (data as RoutineTask | null) ?? null
}
