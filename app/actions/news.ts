'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'

export async function createNewsAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCreateNews(session.role)) return { error: 'Tidak memiliki izin.' }

  const title   = (formData.get('title') as string)?.trim()
  const content = (formData.get('content') as string)?.trim()
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('news_articles').insert({
    title,
    content,
    author_id: session.userId,
    is_active: true,
  })

  if (error) return { error: 'Gagal membuat berita.' }

  revalidatePath('/')
  revalidatePath('/news')
  redirect('/news')
}

export async function toggleNewsAction(newsId: string, isActive: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCreateNews(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('news_articles')
    .update({ is_active: isActive })
    .eq('id', newsId)

  if (error) return { error: 'Gagal memperbarui berita.' }
  revalidatePath('/news')
  revalidatePath('/')
  return { success: true }
}

export async function deleteNewsAction(newsId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCreateNews(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('news_articles').delete().eq('id', newsId)
  if (error) return { error: 'Gagal menghapus berita.' }

  revalidatePath('/news')
  revalidatePath('/')
  redirect('/news')
}
