import { createServerClient } from '@/lib/supabase/server'
import type { Task, Meeting, TaskComment, MemberCompletion, CompletedTaskEntry } from '@/types'
import type { MeetingType } from '@/types'

export async function getDashboardStats(userId: string) {
  const supabase = createServerClient()
  const today = new Date()
  const threeDaysLater = new Date(today)
  threeDaysLater.setDate(today.getDate() + 3)

  const [myTasksRes, pendingVerifRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, status, priority, due_date')
      .eq('assigned_to', userId)
      .not('status', 'in', '("done")'),
    supabase
      .from('tasks')
      .select('id')
      .eq('assigned_by', userId)
      .eq('status', 'submitted'),
  ])

  const myTasks = myTasksRes.data ?? []
  const urgentCount = myTasks.filter(t => t.priority === 'mendesak').length
  const dueSoonCount = myTasks.filter(t => {
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    return due >= today && due <= threeDaysLater
  }).length
  const inProgressCount = myTasks.filter(t => t.status === 'in_progress').length
  const pendingVerifCount = pendingVerifRes.data?.length ?? 0

  return { urgentCount, dueSoonCount, pendingVerifCount, inProgressCount }
}

export async function getMyActiveTasks(userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assigner:users!assigned_by(id, display_name, role)')
    .eq('assigned_to', userId)
    .not('status', 'in', '("done")')
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)
  return (data ?? []) as Task[]
}

export async function getRecentMeetings(meetingTypes: MeetingType[], limit = 5) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, creator:users!created_by(id, display_name)')
    .in('type', meetingTypes)
    .order('date', { ascending: false })
    .limit(limit)
  return (data ?? []) as Meeting[]
}

/**
 * Semua task aktif (belum 'done') lintas divisi — untuk dashboard Kepala RQ.
 * Menyertakan assignee (untuk dikelompokkan per divisi) dan assigner.
 */
export async function getTeamActiveTasks() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:users!assigned_to(id, display_name, role), assigner:users!assigned_by(id, display_name, role)')
    .not('status', 'in', '("done")')
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
  return (data ?? []) as Task[]
}

/**
 * Riwayat penyelesaian tugas (status 'done') dikelompokkan per pengurus.
 * Untuk tiap tugas dihitung waktu mulai (entri in_progress pertama di task_history),
 * waktu selesai (verified_at / entri done), lama pengerjaan, dan history diskusi.
 */
export async function getCompletionHistory(limit = 100): Promise<MemberCompletion[]> {
  const supabase = createServerClient()

  const { data: doneData } = await supabase
    .from('tasks')
    .select('*, assignee:users!assigned_to(id, display_name, role), assigner:users!assigned_by(id, display_name, role)')
    .eq('status', 'done')
    .order('verified_at', { ascending: false, nullsFirst: false })
    .limit(limit)
  const doneTasks = (doneData ?? []) as Task[]
  if (doneTasks.length === 0) return []

  const ids = doneTasks.map(t => t.id)

  const [histRes, commentRes] = await Promise.all([
    supabase.from('task_history').select('task_id, new_status, created_at').in('task_id', ids),
    supabase
      .from('task_comments')
      .select('*, author:users!task_comments_author_id_fkey(id, display_name, role)')
      .in('task_id', ids)
      .order('created_at', { ascending: true }),
  ])

  const history = (histRes.data ?? []) as { task_id: string; new_status: string; created_at: string }[]
  const comments = (commentRes.data ?? []) as TaskComment[]

  // Index waktu dari task_history.
  const firstStart = new Map<string, string>() // in_progress paling awal
  const lastDone = new Map<string, string>()   // done paling akhir
  for (const h of history) {
    if (h.new_status === 'in_progress') {
      const cur = firstStart.get(h.task_id)
      if (!cur || h.created_at < cur) firstStart.set(h.task_id, h.created_at)
    } else if (h.new_status === 'done') {
      const cur = lastDone.get(h.task_id)
      if (!cur || h.created_at > cur) lastDone.set(h.task_id, h.created_at)
    }
  }

  const commentsByTask = new Map<string, TaskComment[]>()
  for (const c of comments) {
    const arr = commentsByTask.get(c.task_id) ?? []
    arr.push(c)
    commentsByTask.set(c.task_id, arr)
  }

  const byMember = new Map<string, MemberCompletion>()
  for (const task of doneTasks) {
    const u = task.assignee
    if (!u) continue
    const startedAt = firstStart.get(task.id) ?? null
    const completedAt = task.verified_at ?? lastDone.get(task.id) ?? task.updated_at
    const durationMs = startedAt ? new Date(completedAt).getTime() - new Date(startedAt).getTime() : null
    const entry: CompletedTaskEntry = { task, startedAt, completedAt, durationMs, comments: commentsByTask.get(task.id) ?? [] }
    const group = byMember.get(u.id) ?? { user: { id: u.id, display_name: u.display_name, role: u.role }, tasks: [] }
    group.tasks.push(entry)
    byMember.set(u.id, group)
  }

  return [...byMember.values()]
}

export async function getPendingVerifications(userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:users!assigned_to(id, display_name, role)')
    .eq('assigned_by', userId)
    .eq('status', 'submitted')
    .order('updated_at', { ascending: false })
    .limit(10)
  return (data ?? []) as Task[]
}
