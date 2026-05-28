'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

/** Cek apakah user boleh mengakses (lihat/komentar) sebuah task. */
async function canAccessTask(taskId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'kepala_rq') return true
  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('assigned_to, assigned_by')
    .eq('id', taskId)
    .maybeSingle()
  if (!data) return false
  return data.assigned_to === userId || data.assigned_by === userId
}

export async function createTaskCommentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const taskId = formData.get('task_id') as string
  const body = ((formData.get('body') as string) || '').trim()

  if (!taskId) return { error: 'Task tidak ditemukan.' }
  if (!body) return { error: 'Komentar tidak boleh kosong.' }
  if (body.length > 2000) return { error: 'Komentar terlalu panjang (maks 2000 karakter).' }

  const allowed = await canAccessTask(taskId, session.userId, session.role)
  if (!allowed) return { error: 'Anda tidak punya akses ke task ini.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    author_id: session.userId,
    body,
  })
  if (error) return { error: 'Gagal mengirim komentar.' }

  revalidatePath(`/tasks/${taskId}`)
  return { success: true }
}

export async function deleteTaskCommentAction(commentId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: comment } = await supabase
    .from('task_comments')
    .select('id, task_id, author_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!comment) return { error: 'Komentar tidak ditemukan.' }

  // Hanya penulis atau kepala_rq yang boleh hapus
  if (comment.author_id !== session.userId && session.role !== 'kepala_rq') {
    return { error: 'Anda tidak punya izin menghapus komentar ini.' }
  }

  const { error } = await supabase.from('task_comments').delete().eq('id', commentId)
  if (error) return { error: 'Gagal menghapus komentar.' }

  revalidatePath(`/tasks/${comment.task_id}`)
  return { success: true }
}
