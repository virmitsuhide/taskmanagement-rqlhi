'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canPostToHome, canPostPengumuman, canPostTugasGuru } from '@/lib/auth/permissions'
import type { PublicPostType, PublicTarget, PostPriority, PostIcon } from '@/types'
import { DEFAULT_POST_ICON, POST_ICON_ORDER } from '@/lib/home/post-icons'

const VALID_PRIORITIES: PostPriority[] = ['penting', 'info', 'pengingat']
const VALID_ICONS: PostIcon[] = POST_ICON_ORDER

export async function createPublicPostAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canPostToHome(session.role)) return { error: 'Tidak memiliki izin.' }

  const type = formData.get('type') as PublicPostType
  let target = formData.get('target') as PublicTarget

  if (type === 'pengumuman' && !canPostPengumuman(session.role)) {
    return { error: 'Tidak memiliki izin untuk posting pengumuman.' }
  }

  if (type === 'tugas_guru') {
    const allowed = canPostTugasGuru(session.role)
    if (!allowed) return { error: 'Tidak memiliki izin untuk posting tugas guru.' }
    if (allowed !== 'all') target = allowed
  }

  const rawPriority = (formData.get('priority') as string) ?? ''
  const priority: PostPriority = VALID_PRIORITIES.includes(rawPriority as PostPriority)
    ? (rawPriority as PostPriority)
    : 'info'

  const rawIcon = (formData.get('icon') as string) ?? ''
  const icon: PostIcon = VALID_ICONS.includes(rawIcon as PostIcon)
    ? (rawIcon as PostIcon)
    : DEFAULT_POST_ICON

  const supabase = createServerClient()
  const base = {
    type,
    target,
    title: formData.get('title') as string,
    content: formData.get('content') as string,
    due_date: (formData.get('due_date') as string) || null,
    created_by: session.userId,
    is_active: true,
  }

  // `priority` baru ada sejak migrasi 0017, `icon` sejak 0030. Selama migrasi
  // itu belum dijalankan PostgREST menolak kolom yang tidak dikenal, jadi
  // dicoba dari baris terlengkap ke yang paling minim — post tetap tersimpan
  // apa adanya daripada hilang sama sekali. Percobaan berhenti pada galat yang
  // bukan soal kolom, supaya kesalahan sungguhan tidak tertutupi percobaan
  // ulang. Seluruh blok ini boleh dihapus begitu 0030 jalan di semua tempat.
  const attempts = [{ ...base, priority, icon }, { ...base, priority }, base]

  let error: { message: string } | null = null
  for (const row of attempts) {
    ({ error } = await supabase.from('public_posts').insert(row))
    if (!error || !/priority|icon/i.test(error.message)) break
  }

  if (error) return { error: 'Gagal membuat post.' }

  revalidatePath('/')
  revalidatePath('/home-post')
  redirect('/home-post')
}

export async function togglePublicPostAction(postId: string, isActive: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: post } = await supabase
    .from('public_posts')
    .select('created_by')
    .eq('id', postId)
    .single()

  if (!post) return { error: 'Post tidak ditemukan.' }
  if (post.created_by !== session.userId && session.role !== 'kepala_rq') {
    return { error: 'Tidak memiliki izin.' }
  }

  const { error } = await supabase
    .from('public_posts')
    .update({ is_active: isActive })
    .eq('id', postId)

  if (error) return { error: 'Gagal memperbarui post.' }

  revalidatePath('/')
  revalidatePath('/home-post')
  return { success: true }
}

export async function deletePublicPostAction(postId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: post } = await supabase
    .from('public_posts')
    .select('created_by')
    .eq('id', postId)
    .single()

  if (!post) return { error: 'Post tidak ditemukan.' }
  if (post.created_by !== session.userId && session.role !== 'kepala_rq') {
    return { error: 'Tidak memiliki izin.' }
  }

  const { error } = await supabase.from('public_posts').delete().eq('id', postId)
  if (error) return { error: 'Gagal menghapus post.' }

  revalidatePath('/')
  revalidatePath('/home-post')
  redirect('/home-post')
}
