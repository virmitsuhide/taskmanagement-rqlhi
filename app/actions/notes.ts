'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canAccessNotes } from '@/lib/auth/permissions'

export async function createNoteAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canAccessNotes(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('private_notes').insert({
    user_id: session.userId,
    title: formData.get('title') as string,
    content: formData.get('content') as string,
  })

  if (error) return { error: 'Gagal menyimpan catatan.' }

  revalidatePath('/notes')
  return { success: true }
}

export async function updateNoteAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canAccessNotes(session.role)) return { error: 'Tidak memiliki izin.' }

  const noteId = formData.get('note_id') as string
  const supabase = createServerClient()

  const { error } = await supabase
    .from('private_notes')
    .update({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    })
    .eq('id', noteId)
    .eq('user_id', session.userId)

  if (error) return { error: 'Gagal memperbarui catatan.' }

  revalidatePath('/notes')
  return { success: true }
}

export async function deleteNoteAction(noteId: string) {
  const session = await getSession()
  if (!session || !canAccessNotes(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('private_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', session.userId)

  if (error) return { error: 'Gagal menghapus catatan.' }

  revalidatePath('/notes')
  return { success: true }
}
