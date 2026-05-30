'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canAssignTask, canChangeTaskStatus } from '@/lib/auth/permissions'
import {
  sendTaskAssigned,
  sendTaskReturned,
  sendTaskSubmittedForReview,
} from '@/lib/email/reminders'
import type { TaskPriority, TaskSource, PublicTarget } from '@/types'

export async function createTaskAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()

  const assignedToId = formData.get('assigned_to') as string
  const { data: assignee } = await supabase
    .from('users')
    .select('role, email, display_name')
    .eq('id', assignedToId)
    .single()

  if (!assignee) return { error: 'Penerima task tidak ditemukan.' }
  // Self-assign (tugas pribadi) selalu diperbolehkan.
  // Delegasi ke orang lain dicek lewat canAssignTask.
  if (assignedToId !== session.userId && !canAssignTask(session.role, assignee.role)) {
    return { error: 'Anda tidak memiliki izin untuk menugaskan ke role tersebut.' }
  }

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const sourceType = (formData.get('source_type') as TaskSource) || 'mandiri'
  const sourceMeetingId = formData.get('source_meeting_id') as string | null
  const sourceAgendaId = formData.get('source_agenda_id') as string | null
  const priority = (formData.get('priority') as TaskPriority) || 'normal'
  const dueDate = formData.get('due_date') as string | null
  const publicTarget = formData.get('public_target') as PublicTarget | null

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title,
      description: description || null,
      source_type: sourceType,
      source_meeting_id: sourceMeetingId || null,
      source_agenda_id: sourceAgendaId || null,
      assigned_by: session.userId,
      assigned_to: assignedToId,
      public_target: publicTarget || null,
      priority,
      due_date: dueDate || null,
      status: 'todo',
    })
    .select('id')
    .single()

  if (error || !task) return { error: 'Gagal membuat task.' }

  await supabase.from('task_history').insert({
    task_id: task.id,
    changed_by: session.userId,
    old_status: null,
    new_status: 'todo',
    notes: 'Task dibuat',
  })

  if (assignee.email) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendTaskAssigned({
      to: assignee.email,
      assigneeName: assignee.display_name,
      taskTitle: title,
      assignerName: session.displayName,
      dueDate: dueDate,
      taskUrl: `${baseUrl}/tasks/${task.id}`,
    })
  }

  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function updateTaskStatusAction(
  taskId: string,
  newStatus: string,
  notes?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status, assigned_by, assigned_to, title, users!assigned_by(email, display_name), assignee:users!assigned_to(email, display_name)')
    .eq('id', taskId)
    .single()

  if (!task) return { error: 'Task tidak ditemukan.' }

  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId

  if (!canChangeTaskStatus(session.role, task.status, newStatus as never, isAssignee, isAssigner)) {
    return { error: 'Anda tidak memiliki izin untuk mengubah status task ini.' }
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'returned') updateData.return_notes = notes ?? ''
  if (newStatus === 'done') {
    updateData.verified_by = session.userId
    updateData.verified_at = new Date().toISOString()
  }

  const { error } = await supabase.from('tasks').update(updateData).eq('id', taskId)
  if (error) return { error: 'Gagal memperbarui status.' }

  await supabase.from('task_history').insert({
    task_id: taskId,
    changed_by: session.userId,
    old_status: task.status,
    new_status: newStatus,
    notes: notes ?? null,
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const taskUrl = `${baseUrl}/tasks/${taskId}`

  const assigneeUser = task.assignee as unknown as { email?: string; display_name: string } | null
  const assignerUser = task.users as unknown as { email?: string; display_name: string } | null

  if (newStatus === 'returned' && assigneeUser?.email) {
    await sendTaskReturned({
      to: assigneeUser.email,
      assigneeName: assigneeUser.display_name,
      taskTitle: task.title,
      returnNotes: notes ?? '',
      taskUrl,
    })
  }

  if (newStatus === 'submitted' && assignerUser?.email) {
    await sendTaskSubmittedForReview({
      to: assignerUser.email,
      assignerName: assignerUser.display_name,
      taskTitle: task.title,
      assigneeName: assigneeUser?.display_name ?? '',
      taskUrl,
    })
  }

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

// Form-compatible wrapper for status updates (reads from FormData)
export async function updateTaskStatusFromFormAction(formData: FormData) {
  const taskId = formData.get('task_id') as string
  const newStatus = formData.get('new_status') as string
  const notes = (formData.get('notes') as string) || undefined
  await updateTaskStatusAction(taskId, newStatus, notes)
}

export async function deleteTaskAction(taskId: string) {
  const session = await getSession()
  if (!session || session.role !== 'kepala_rq') {
    return { error: 'Tidak memiliki izin.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return { error: 'Gagal menghapus task.' }

  revalidatePath('/tasks')
  redirect('/tasks')
}
