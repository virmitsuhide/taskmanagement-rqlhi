import { createServerClient } from '@/lib/supabase/server'
import type { TaskStatus } from '@/types'

/**
 * Notifikasi diturunkan dari task_history, bukan tabel tersendiri.
 *
 * task_history sudah mencatat dua peristiwa yang dibutuhkan:
 *   • tugas dibuat/diberikan → old_status IS NULL
 *   • status tugas diubah    → old_status IS NOT NULL
 *
 * Konsekuensinya: tidak ada pemicu terpisah yang bisa lupa dipasang saat ada
 * alur baru yang mengubah status, dan riwayat lama ikut tampil sejak awal.
 */

export type NotificationKind = 'assigned' | 'status'

export interface NotificationItem {
  /** id baris task_history — dipakai sebagai id notifikasi. */
  id: string
  taskId: string
  taskTitle: string
  kind: NotificationKind
  oldStatus: TaskStatus | null
  newStatus: TaskStatus
  /** Nama orang yang melakukan perubahan. */
  actorName: string
  createdAt: string
  /** Sudah diklik? Mengendalikan titik biru per baris. */
  read: boolean
}

export interface NotificationFeed {
  items: NotificationItem[]
  /** Jumlah yang lebih baru dari notifications_seen_at — angka di lonceng. */
  unseenCount: number
}

/** Ambil lebih banyak dari yang ditampilkan, karena disaring lagi di aplikasi. */
const SCAN_LIMIT = 150
const SHOW_LIMIT = 15

interface HistoryRow {
  id: string
  task_id: string
  changed_by: string | null
  old_status: TaskStatus | null
  new_status: TaskStatus
  created_at: string
  actor: { display_name: string } | null
  task: { id: string; title: string; assigned_to: string | null; assigned_by: string | null } | null
}

export async function getNotifications(userId: string): Promise<NotificationFeed> {
  const supabase = createServerClient()

  const [historyRes, seenRes, readsRes] = await Promise.all([
    supabase
      .from('task_history')
      .select(
        'id, task_id, changed_by, old_status, new_status, created_at,' +
        ' actor:users!changed_by(display_name),' +
        ' task:tasks!task_id(id, title, assigned_to, assigned_by)',
      )
      .order('created_at', { ascending: false })
      .limit(SCAN_LIMIT),
    supabase.from('users').select('notifications_seen_at').eq('id', userId).maybeSingle(),
    supabase.from('notification_reads').select('history_id').eq('user_id', userId),
  ])

  // Kolom/tabel belum ada (migrasi belum dijalankan) → jangan sampai header
  // ikut gagal render; cukup tampilkan tanpa status baca.
  const seenAt = (seenRes.data?.notifications_seen_at as string | null | undefined) ?? null
  const readIds = new Set((readsRes.data ?? []).map(r => r.history_id as string))

  const rows = (historyRes.data ?? []) as unknown as HistoryRow[]

  const items: NotificationItem[] = []
  for (const r of rows) {
    if (!r.task) continue
    // Perubahan yang dilakukan sendiri bukan notifikasi.
    if (r.changed_by === userId) continue

    const isAssignee = r.task.assigned_to === userId
    const isAssigner = r.task.assigned_by === userId
    if (!isAssignee && !isAssigner) continue

    const isNewTask = r.old_status === null
    // "Dapat tugas" hanya relevan bagi penerimanya.
    if (isNewTask && !isAssignee) continue

    items.push({
      id: r.id,
      taskId: r.task.id,
      taskTitle: r.task.title,
      kind: isNewTask ? 'assigned' : 'status',
      oldStatus: r.old_status,
      newStatus: r.new_status,
      actorName: r.actor?.display_name ?? 'Seseorang',
      createdAt: r.created_at,
      read: readIds.has(r.id),
    })

    if (items.length >= SHOW_LIMIT) break
  }

  const unseenCount = seenAt
    ? items.filter(i => i.createdAt > seenAt).length
    : items.length

  return { items, unseenCount }
}
