import { createServerClient } from '@/lib/supabase/server'
import { isManagement } from '@/lib/auth/permissions'
import type { TaskStatus, TaskHistoryAction, UserRole } from '@/types'

/**
 * Notifikasi diturunkan dari task_history, bukan tabel tersendiri.
 *
 * task_history mencatat peristiwa yang dibutuhkan:
 *   • tugas dibuat/diberikan → old_status IS NULL
 *   • status tugas diubah    → old_status IS NOT NULL
 *   • disunting/dihapus/dipulihkan → kolom action (migrasi 0018)
 *
 * Konsekuensinya: tidak ada pemicu terpisah yang bisa lupa dipasang saat ada
 * alur baru yang mengubah status, dan riwayat lama ikut tampil sejak awal.
 *
 * Inilah alasan penghapusan tugas dibuat lunak. FK task_history ON DELETE
 * CASCADE — hard delete akan menghapus baris riwayat "tugas dihapus" pada saat
 * yang sama ia dibuat, sehingga notifikasinya mustahil sampai ke siapa pun.
 */

export type NotificationKind = 'assigned' | 'status' | 'edited' | 'deleted' | 'restored'

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
  action: TaskHistoryAction | null
  created_at: string
  actor: { display_name: string } | null
  task: {
    id: string
    title: string
    assigned_to: string | null
    assigned_by: string | null
    deleted_at: string | null
  } | null
}

/** Peristiwa tata kelola — yang membuat manajemen ikut diberi tahu. */
const AUDIT_ACTIONS: TaskHistoryAction[] = ['edited', 'deleted', 'restored']

export async function getNotifications(userId: string, role: UserRole): Promise<NotificationFeed> {
  const supabase = createServerClient()

  const [historyRes, seenRes, readsRes] = await Promise.all([
    supabase
      .from('task_history')
      .select(
        'id, task_id, changed_by, old_status, new_status, action, created_at,' +
        ' actor:users!changed_by(display_name),' +
        ' task:tasks!task_id(id, title, assigned_to, assigned_by, deleted_at)',
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

  const viewerIsManagement = isManagement(role)

  const items: NotificationItem[] = []
  for (const r of rows) {
    if (!r.task) continue
    // Perubahan yang dilakukan sendiri bukan notifikasi.
    if (r.changed_by === userId) continue

    const isAssignee = r.task.assigned_to === userId
    const isAssigner = r.task.assigned_by === userId
    const action = r.action ?? 'status'
    const isAudit = AUDIT_ACTIONS.includes(action)

    if (isAudit) {
      /**
       * Manajemen ikut menerima peristiwa sunting/hapus/pulih.
       *
       * Tanpa aturan ini, tugas untuk diri sendiri tidak terpantau siapa pun:
       * pemberi dan penerimanya orang yang sama, dan aksinya sendiri sudah
       * disaring oleh pemeriksaan changed_by di atas — sehingga tidak ada
       * seorang pun yang tersisa untuk diberi tahu.
       */
      if (!isAssignee && !isAssigner && !viewerIsManagement) continue
    } else {
      if (!isAssignee && !isAssigner) continue
      // Riwayat status pada tugas yang sudah dihapus tidak lagi bisa
      // ditindaklanjuti — hanya peristiwa hapus/pulihnya yang relevan.
      if (r.task.deleted_at) continue

      // "Dapat tugas" hanya relevan bagi penerimanya.
      if (r.old_status === null && !isAssignee) continue
    }

    const kind: NotificationKind = isAudit
      ? (action as NotificationKind)
      : r.old_status === null ? 'assigned' : 'status'

    items.push({
      id: r.id,
      taskId: r.task.id,
      taskTitle: r.task.title,
      kind,
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
