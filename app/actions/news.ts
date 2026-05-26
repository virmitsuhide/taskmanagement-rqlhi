'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'

const BUCKET = 'news-images'

const VALID_CATEGORIES = ['sdit_lhi', 'smpit_lhi', 'sma_lhi', 'paud_lhi', 'sd_lhi_juara'] as const
const VALID_TYPES = ['berita', 'artikel'] as const

async function uploadThumbnail(
  supabase: ReturnType<typeof createServerClient>,
  file: File,
): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, Buffer.from(bytes), { contentType: file.type, upsert: false })
    if (error || !data) return null
    return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}

export async function createNewsAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCreateNews(session.role)) return { error: 'Tidak memiliki izin.' }

  const title   = (formData.get('title') as string)?.trim()
  const excerpt = (formData.get('excerpt') as string)?.trim() || null
  const content = (formData.get('content') as string)?.trim()
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' }

  const rawCategory = (formData.get('category') as string)?.trim() || ''
  const rawType = (formData.get('type') as string)?.trim() || 'berita'
  const category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null
  const type = (VALID_TYPES as readonly string[]).includes(rawType) ? rawType : 'berita'
  if (type === 'berita' && !category) {
    return { error: 'Kategori unit wajib dipilih untuk berita.' }
  }

  const supabase = createServerClient()

  const thumbnailFile = formData.get('thumbnail') as File | null
  let thumbnailUrl: string | null = null
  if (thumbnailFile && thumbnailFile.size > 0) {
    thumbnailUrl = await uploadThumbnail(supabase, thumbnailFile)
  }

  const { error } = await supabase.from('news_articles').insert({
    title,
    excerpt,
    content,
    thumbnail_url: thumbnailUrl,
    category,
    type,
    author_id: session.userId,
    is_active: true,
  })

  if (error) return { error: error.message || 'Gagal membuat berita.' }

  revalidatePath('/')
  revalidatePath('/news')
  redirect('/news')
}

export async function updateNewsAction(newsId: string, _: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canCreateNews(session.role)) return { error: 'Tidak memiliki izin.' }

  const title   = (formData.get('title') as string)?.trim()
  const excerpt = (formData.get('excerpt') as string)?.trim() || null
  const content = (formData.get('content') as string)?.trim()
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' }

  const rawCategory = (formData.get('category') as string)?.trim() || ''
  const rawType = (formData.get('type') as string)?.trim() || 'berita'
  const category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null
  const type = (VALID_TYPES as readonly string[]).includes(rawType) ? rawType : 'berita'
  if (type === 'berita' && !category) {
    return { error: 'Kategori unit wajib dipilih untuk berita.' }
  }

  const supabase = createServerClient()

  const removeThumbnail = formData.get('remove_thumbnail') === '1'
  const thumbnailFile = formData.get('thumbnail') as File | null

  const update: Record<string, unknown> = {
    title,
    excerpt,
    content,
    category,
    type,
    updated_at: new Date().toISOString(),
  }

  if (thumbnailFile && thumbnailFile.size > 0) {
    const url = await uploadThumbnail(supabase, thumbnailFile)
    if (url) update.thumbnail_url = url
  } else if (removeThumbnail) {
    update.thumbnail_url = null
  }

  const { error } = await supabase
    .from('news_articles')
    .update(update)
    .eq('id', newsId)

  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath(`/news/${newsId}`)
  redirect(`/news/${newsId}`)
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

  if (error) return { error: error.message }
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
  if (error) return { error: error.message }

  revalidatePath('/news')
  revalidatePath('/')
  return { success: true }
}
