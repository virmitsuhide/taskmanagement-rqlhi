'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  canAssignTask, canChangeTaskStatus, canMoveTaskOnBoard,
  canDeleteTask, canEditTask, isManagement,
} from '@/lib/auth/permissions'
import {
  sendTaskAssigned,
  sendTaskReturned,
  sendTaskSubmittedForReview,
} from '@/lib/email/reminders'
import type {
  TaskPriority, TaskWeight, TaskHorizon, TaskProblemType, TaskSource, PublicTarget,
} from '@/types'

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
  const priority = (formData.get('priority') as TaskPriority) || 'middle'
  const weight = (formData.get('weight') as TaskWeight) || 'medium'
  const horizon = (formData.get('horizon') as TaskHorizon) || 'pendek'
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
      weight,
      horizon,
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
    .select('status, problem_type, assigned_by, assigned_to, title, deleted_at, users!assigned_by(email, display_name), assignee:users!assigned_to(email, display_name)')
    .eq('id', taskId)
    .single()

  if (!task || task.deleted_at) return { error: 'Task tidak ditemukan.' }

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
  // Jenis hambatan hanya relevan selama status 'problem'.
  if (newStatus === 'problem') {
    updateData.problem_type = task.problem_type ?? 'others'
  } else {
    updateData.problem_type = null
    updateData.problem_notes = null
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

/**
 * Ubah jenis hambatan pada task yang sedang berstatus 'problem'.
 * Izinnya sama dengan izin menggeser kartu: pelaksana, pemberi tugas, Kepala RQ.
 */
export async function updateTaskProblemAction(
  taskId: string,
  problemType: TaskProblemType,
  notes?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status, assigned_by, assigned_to, deleted_at')
    .eq('id', taskId)
    .single()

  if (!task || task.deleted_at) return { error: 'Task tidak ditemukan.' }
  if (task.status !== 'problem') return { error: 'Task ini tidak sedang berstatus Problem.' }

  const allowed = canMoveTaskOnBoard(
    session.role,
    task.assigned_to === session.userId,
    task.assigned_by === session.userId,
  )
  if (!allowed) return { error: 'Anda tidak memiliki izin mengubah hambatan task ini.' }

  const { error } = await supabase
    .from('tasks')
    .update({ problem_type: problemType, ...(notes !== undefined ? { problem_notes: notes } : {}) })
    .eq('id', taskId)
  if (error) return { error: 'Gagal memperbarui jenis hambatan.' }

  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
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

export async function deleteTaskFromFormAction(formData: FormData) {
  await deleteTaskAction(formData.get('task_id') as string)
}

export async function restoreTaskFromFormAction(formData: FormData) {
  await restoreTaskAction(formData.get('task_id') as string)
}

/** Label ramah untuk ringkasan perubahan di riwayat. */
const FIELD_LABELS: Record<string, string> = {
  title:       'judul',
  description: 'deskripsi',
  priority:    'prioritas',
  weight:      'bobot',
  horizon:     'jangka',
  due_date:    'tenggat',
}

/**
 * Sunting isi tugas.
 *
 * Hanya untuk tugas kepada diri sendiri (pemberi = penerima), plus Kepala RQ —
 * lihat canEditTask. Statusnya sengaja tidak ikut disunting di sini: perpindahan
 * status punya jalurnya sendiri lewat updateTaskStatusAction yang memvalidasi
 * transisi antar kolom kanban.
 *
 * Setiap suntingan mencatat baris riwayat action='edited' berisi ringkasan
 * field yang berubah. Baris itulah yang kemudian muncul sebagai notifikasi bagi
 * manajemen — tanpa jejak ini, tugas pribadi bisa diubah tanpa terpantau siapa
 * pun, karena pemberi dan penerimanya orang yang sama.
 */
export async function updateTaskAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const taskId = formData.get('task_id') as string
  if (!taskId) return { error: 'Task tidak dikenali.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('title, description, priority, weight, horizon, due_date, status, assigned_by, assigned_to, deleted_at')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.deleted_at) return { error: 'Tugas tidak ditemukan.' }

  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId
  if (!canEditTask(session.role, isAssignee, isAssigner)) {
    return { error: 'Anda tidak memiliki izin menyunting tugas ini.' }
  }

  const title = ((formData.get('title') as string) ?? '').trim()
  if (!title) return { error: 'Judul tugas wajib diisi.' }

  const next = {
    title,
    description: ((formData.get('description') as string) ?? '').trim() || null,
    priority: (formData.get('priority') as TaskPriority) || task.priority,
    weight: (formData.get('weight') as TaskWeight) || task.weight,
    horizon: (formData.get('horizon') as TaskHorizon) || task.horizon,
    due_date: ((formData.get('due_date') as string) ?? '') || null,
  }

  const changed = Object.keys(next).filter(
    k => next[k as keyof typeof next] !== task[k as keyof typeof task],
  )
  // Form dikirim tanpa mengubah apa pun — jangan mengotori riwayat & notifikasi.
  if (changed.length === 0) {
    redirect(`/tasks/${taskId}`)
  }

  const { error } = await supabase
    .from('tasks')
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { error: 'Gagal menyimpan perubahan.' }

  await supabase.from('task_history').insert({
    task_id: taskId,
    changed_by: session.userId,
    old_status: task.status,
    new_status: task.status, // tidak berpindah kolom; 'action' yang menerangkan
    action: 'edited',
    notes: `Menyunting ${changed.map(f => FIELD_LABELS[f] ?? f).join(', ')}`,
  })

  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
  revalidatePath(`/tasks/${taskId}`)
  redirect(`/tasks/${taskId}`)
}

/**
 * Hapus tugas — menyembunyikan, bukan membuang (lihat migrasi 0018).
 *
 * Hard delete akan meruntuhkan notifikasi yang baru saja dibuat: task_history
 * ber-FK ON DELETE CASCADE dan getNotifications membuang baris yang task
 * induknya hilang. Dengan deleted_at, jejaknya utuh dan tugas masih bisa
 * dipulihkan lewat restoreTaskAction.
 */
export async function deleteTaskAction(taskId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status, assigned_by, assigned_to, deleted_at')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.deleted_at) return { error: 'Tugas tidak ditemukan.' }

  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId
  if (!canDeleteTask(session.role, isAssignee, isAssigner)) {
    return { error: 'Anda tidak memiliki izin menghapus tugas ini.' }
  }

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { error: 'Gagal menghapus tugas.' }

  await supabase.from('task_history').insert({
    task_id: taskId,
    changed_by: session.userId,
    old_status: task.status,
    new_status: task.status,
    action: 'deleted',
    notes: 'Tugas dihapus',
  })

  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
  redirect('/tasks')
}

/**
 * Pulihkan tugas yang terhapus. Wewenang manajemen — inilah alasan penghapusan
 * dibuat lunak, supaya salah hapus tidak permanen.
 */
export async function restoreTaskAction(taskId: string) {
  const session = await getSession()
  if (!session || !isManagement(session.role)) {
    return { error: 'Tidak memiliki izin.' }
  }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status, deleted_at')
    .eq('id', taskId)
    .maybeSingle()

  if (!task) return { error: 'Tugas tidak ditemukan.' }
  if (!task.deleted_at) return { error: 'Tugas ini tidak sedang terhapus.' }

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: null })
    .eq('id', taskId)
  if (error) return { error: 'Gagal memulihkan tugas.' }

  await supabase.from('task_history').insert({
    task_id: taskId,
    changed_by: session.userId,
    old_status: task.status,
    new_status: task.status,
    action: 'restored',
    notes: 'Tugas dipulihkan',
  })

  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

/**
 * Hapus tugas yang sudah selesai dari riwayat (khusus kepala_rq).
 * Dipakai dari dashboard manajemen — tidak redirect, cukup revalidate.
 */
export async function deleteCompletedTaskAction(taskId: string) {
  const session = await getSession()
  if (!session || session.role !== 'kepala_rq') {
    return { error: 'Tidak memiliki izin.' }
  }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('status, deleted_at')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || task.deleted_at) return { error: 'Tugas tidak ditemukan.' }
  if (task.status !== 'done') return { error: 'Hanya tugas yang sudah selesai yang bisa dihapus dari riwayat.' }

  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { error: 'Gagal menghapus tugas.' }

  await supabase.from('task_history').insert({
    task_id: taskId,
    changed_by: session.userId,
    old_status: task.status,
    new_status: task.status,
    action: 'deleted',
    notes: 'Tugas selesai dihapus dari riwayat',
  })

  revalidatePath('/dashboard/manajemen')
  return { success: true }
}
