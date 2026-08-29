'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageSubtasks } from '@/lib/auth/permissions'
import type { SubtaskStatus } from '@/types'

/**
 * Rincian (sub-tugas) sebuah tugas.
 *
 * Sengaja TIDAK menulis ke task_history. Riwayat tugas adalah sumber notifikasi
 * (lihat lib/data/notifications.ts), dan mencentang tiga langkah kecil dalam
 * satu sesi kerja akan mengirim tiga notifikasi yang tidak berarti apa-apa bagi
 * penerimanya. Rincian adalah catatan kerja pribadi di dalam sebuah tugas;
 * peristiwa yang layak diumumkan tetap perpindahan status tugas induknya.
 */

interface Guard {
  error?: string
  taskId?: string
}

/** Pastikan pemanggil berhak mengubah rincian tugas ini. */
async function guardTask(taskId: string): Promise<Guard> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, assigned_by, assigned_to, deleted_at')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.deleted_at) return { error: 'Tugas tidak ditemukan.' }

  const allowed = canManageSubtasks(
    session.role,
    task.assigned_to === session.userId,
    task.assigned_by === session.userId,
  )
  if (!allowed) return { error: 'Anda tidak berhak mengubah rincian tugas ini.' }

  return { taskId: task.id }
}

/** Versi guard yang berangkat dari id rincian, bukan id tugas. */
async function guardSubtask(subtaskId: string): Promise<Guard> {
  const supabase = createServerClient()
  const { data: sub } = await supabase
    .from('task_subtasks')
    .select('task_id')
    .eq('id', subtaskId)
    .maybeSingle()

  if (!sub) return { error: 'Rincian tidak ditemukan.' }
  return guardTask(sub.task_id as string)
}

function refresh(taskId: string) {
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/tasks/gantt')
  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
}

/** Tanggal dari form: string kosong → null, bukan '' (kolom bertipe date). */
function dateField(formData: FormData, name: string): string | null {
  const v = (formData.get(name) as string | null)?.trim()
  return v ? v : null
}

export async function createSubtaskAction(_: unknown, formData: FormData) {
  const taskId = formData.get('task_id') as string
  const guard = await guardTask(taskId)
  if (guard.error) return { error: guard.error }

  const session = await getSession()
  const title = ((formData.get('title') as string) ?? '').trim()
  if (!title) return { error: 'Judul rincian wajib diisi.' }

  const start = dateField(formData, 'start_date')
  const due = dateField(formData, 'due_date')
  if (start && due && due < start) {
    return { error: 'Tenggat tidak boleh lebih awal dari tanggal mulai.' }
  }

  const supabase = createServerClient()

  // Rincian baru selalu ditaruh paling bawah. order_num dihitung dari nilai
  // terbesar yang ada, bukan dari jumlah baris: rincian yang dihapus akan
  // membuat hitungan jumlah bertabrakan dengan urutan yang masih terpakai.
  const { data: last } = await supabase
    .from('task_subtasks')
    .select('order_num')
    .eq('task_id', taskId)
    .order('order_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('task_subtasks').insert({
    task_id: taskId,
    title,
    start_date: start,
    due_date: due,
    order_num: ((last?.order_num as number | undefined) ?? -1) + 1,
    created_by: session!.userId,
  })
  if (error) return { error: 'Gagal menambahkan rincian.' }

  refresh(taskId)
  return { success: true }
}

export async function updateSubtaskAction(_: unknown, formData: FormData) {
  const id = formData.get('subtask_id') as string
  const guard = await guardSubtask(id)
  if (guard.error) return { error: guard.error }

  const title = ((formData.get('title') as string) ?? '').trim()
  if (!title) return { error: 'Judul rincian wajib diisi.' }

  const start = dateField(formData, 'start_date')
  const due = dateField(formData, 'due_date')
  if (start && due && due < start) {
    return { error: 'Tenggat tidak boleh lebih awal dari tanggal mulai.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('task_subtasks')
    .update({ title, start_date: start, due_date: due, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Gagal menyimpan perubahan.' }

  refresh(guard.taskId!)
  return { success: true }
}

/**
 * Ubah status satu rincian.
 *
 * completed_at ikut diisi/dikosongkan di sini supaya "kapan langkah ini kelar"
 * tidak hilang saat rincian lain diubah — kolom updated_at menyimpan sentuhan
 * terakhir apa pun bentuknya, jadi ia tidak bisa menjawab pertanyaan itu.
 */
export async function setSubtaskStatusAction(subtaskId: string, status: SubtaskStatus) {
  const guard = await guardSubtask(subtaskId)
  if (guard.error) return { error: guard.error }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('task_subtasks')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subtaskId)
  if (error) return { error: 'Gagal mengubah status rincian.' }

  refresh(guard.taskId!)
  return { success: true }
}

export async function deleteSubtaskAction(subtaskId: string) {
  const guard = await guardSubtask(subtaskId)
  if (guard.error) return { error: guard.error }

  const supabase = createServerClient()
  const { error } = await supabase.from('task_subtasks').delete().eq('id', subtaskId)
  if (error) return { error: 'Gagal menghapus rincian.' }

  refresh(guard.taskId!)
  return { success: true }
}

/**
 * Geser satu rincian ke atas/bawah dengan menukar order_num-nya dengan tetangga.
 *
 * Menukar sepasang nilai jauh lebih murah daripada menomori ulang seluruh
 * daftar, dan tidak bisa merusak urutan rincian lain kalau salah satu update
 * gagal di tengah jalan.
 */
export async function moveSubtaskAction(subtaskId: string, direction: 'up' | 'down') {
  const guard = await guardSubtask(subtaskId)
  if (guard.error) return { error: guard.error }

  const supabase = createServerClient()
  const { data: rows } = await supabase
    .from('task_subtasks')
    .select('id, order_num')
    .eq('task_id', guard.taskId!)
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })

  const list = (rows ?? []) as { id: string; order_num: number }[]
  const i = list.findIndex(r => r.id === subtaskId)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= list.length) return { success: true } // sudah di ujung

  await Promise.all([
    supabase.from('task_subtasks').update({ order_num: list[j].order_num }).eq('id', list[i].id),
    supabase.from('task_subtasks').update({ order_num: list[i].order_num }).eq('id', list[j].id),
  ])

  refresh(guard.taskId!)
  return { success: true }
}
