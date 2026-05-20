import { createServerClient } from '@/lib/supabase/server'
import type { Task, Meeting } from '@/types'
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
    .select('*, assigner:users!tasks_assigned_by_fkey(id, display_name, role)')
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
    .select('*, creator:users!meetings_created_by_fkey(id, display_name)')
    .in('type', meetingTypes)
    .order('date', { ascending: false })
    .limit(limit)
  return (data ?? []) as Meeting[]
}

export async function getPendingVerifications(userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*, assignee:users!tasks_assigned_to_fkey(id, display_name, role)')
    .eq('assigned_by', userId)
    .eq('status', 'submitted')
    .order('updated_at', { ascending: false })
    .limit(10)
  return (data ?? []) as Task[]
}
