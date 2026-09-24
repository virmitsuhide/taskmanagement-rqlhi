'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canPostToHome, canPostPengumuman, canPostTugasGuru } from '@/lib/auth/permissions'
import type { PublicPostType, PublicTarget, PostPriority, PostIcon, UserRole } from '@/types'
import { DEFAULT_POST_ICON, POST_ICON_ORDER } from '@/lib/home/post-icons'

const VALID_PRIORITIES: PostPriority[] = ['penting', 'info', 'pengingat']
const VALID_ICONS: PostIcon[] = POST_ICON_ORDER
const VALID_TYPES: PublicPostType[] = ['pengumuman', 'tugas_guru']
const VALID_TARGETS: PublicTarget[] = ['all', 'sd', 'smp']

type Supabase = ReturnType<typeof createServerClient>

/**
 * Flyer pengumuman (0088) — bucket publik yang sama dengan thumbnail berita,
 * di folder sendiri. Formulir sudah memperkecilnya di peramban (sisi terpanjang
 * 1600 px); batas di sini jaring pengaman bila kompresi tidak berjalan.
 */
const BUCKET_GAMBAR = 'news-images'
const FOLDER_GAMBAR = 'pengumuman'
const MAKS_GAMBAR = 3 * 1024 * 1024
const MIME_GAMBAR = ['image/jpeg', 'image/png', 'image/webp']

/** Path objek dari url publik bucket gambar; null bila bukan milik folder pengumuman. */
function pathGambar(url: string | null | undefined): string | null {
  const i = url?.indexOf(`/${BUCKET_GAMBAR}/${FOLDER_GAMBAR}/`) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + BUCKET_GAMBAR.length + 2)) : null
}

async function hapusGambar(supabase: Supabase, url: string | null | undefined) {
  const path = pathGambar(url)
  if (path) await supabase.storage.from(BUCKET_GAMBAR).remove([path])
}

/**
 * Unggah gambar dari medan `gambar`, bila ada. Diunggah SEBELUM baris post
 * disimpan, supaya galatnya bisa dilaporkan sebelum post tersimpan tanpa
 * gambar yang dimaksud penulisnya.
 */
async function unggahGambar(supabase: Supabase, formData: FormData): Promise<{ error: string } | { url: string; path: string } | null> {
  const gambar = formData.get('gambar')
  if (!(gambar instanceof File) || gambar.size === 0) return null
  if (!MIME_GAMBAR.includes(gambar.type)) return { error: 'Gambar harus JPG, PNG, atau WebP.' }
  if (gambar.size > MAKS_GAMBAR) return { error: 'Gambar terlalu besar (maksimal 3 MB).' }
  const ext = gambar.type === 'image/png' ? 'png' : gambar.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${FOLDER_GAMBAR}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await supabase.storage
    .from(BUCKET_GAMBAR)
    .upload(path, Buffer.from(await gambar.arrayBuffer()), { contentType: gambar.type, upsert: false })
  if (error || !data) return { error: 'Gagal mengunggah gambar. Coba lagi.' }
  return { url: supabase.storage.from(BUCKET_GAMBAR).getPublicUrl(data.path).data.publicUrl, path: data.path }
}

/**
 * Isian formulir → kolom post, dengan aturan izin per jenis. Dipakai membuat
 * dan menyunting: menyunting tidak boleh menjadi jalan memindahkan post ke
 * jenis atau sasaran yang tidak boleh diposting penulisnya.
 */
function bacaIsian(formData: FormData, role: UserRole) {
  const type = formData.get('type') as PublicPostType
  let target = formData.get('target') as PublicTarget
  if (!VALID_TYPES.includes(type)) return { error: 'Jenis post tidak dikenal.' } as const
  if (!VALID_TARGETS.includes(target)) return { error: 'Target tidak dikenal.' } as const

  if (type === 'pengumuman' && !canPostPengumuman(role)) {
    return { error: 'Tidak memiliki izin untuk posting pengumuman.' } as const
  }
  if (type === 'tugas_guru') {
    const allowed = canPostTugasGuru(role)
    if (!allowed) return { error: 'Tidak memiliki izin untuk posting tugas guru.' } as const
    if (allowed !== 'all') target = allowed
  }

  const title = ((formData.get('title') as string) ?? '').trim()
  const content = ((formData.get('content') as string) ?? '').trim()
  if (!title || !content) return { error: 'Judul dan isi wajib diisi.' } as const

  const rawPriority = (formData.get('priority') as string) ?? ''
  const rawIcon = (formData.get('icon') as string) ?? ''
  return {
    base: { type, target, title, content, due_date: (formData.get('due_date') as string) || null },
    priority: VALID_PRIORITIES.includes(rawPriority as PostPriority) ? (rawPriority as PostPriority) : 'info',
    icon: VALID_ICONS.includes(rawIcon as PostIcon) ? (rawIcon as PostIcon) : DEFAULT_POST_ICON,
  }
}

function segarkan(postId?: string) {
  revalidatePath('/')
  revalidatePath('/home-post')
  if (postId) {
    revalidatePath(`/pengumuman/${postId}`)
    revalidatePath(`/guru/pengumuman/${postId}`)
  }
}

const PESAN_MIGRASI_GAMBAR = 'Kolom gambar belum ada. Minta admin menjalankan migrasi 0088, atau simpan tanpa gambar.'

export async function createPublicPostAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canPostToHome(session.role)) return { error: 'Tidak memiliki izin.' }

  const isian = bacaIsian(formData, session.role)
  if ('error' in isian) return { error: isian.error }

  const supabase = createServerClient()
  const gambar = await unggahGambar(supabase, formData)
  if (gambar && 'error' in gambar) return { error: gambar.error }

  const base = {
    ...isian.base,
    created_by: session.userId,
    is_active: true,
    ...(gambar ? { image_url: gambar.url } : {}),
  }

  // `priority` baru ada sejak migrasi 0017, `icon` sejak 0030. Selama migrasi
  // itu belum dijalankan PostgREST menolak kolom yang tidak dikenal, jadi
  // dicoba dari baris terlengkap ke yang paling minim — post tetap tersimpan
  // apa adanya daripada hilang sama sekali. Percobaan berhenti pada galat yang
  // bukan soal kolom, supaya kesalahan sungguhan tidak tertutupi percobaan
  // ulang. Seluruh blok ini boleh dihapus begitu 0030 jalan di semua tempat.
  const attempts = [{ ...base, priority: isian.priority, icon: isian.icon }, { ...base, priority: isian.priority }, base]

  let error: { message: string } | null = null
  for (const row of attempts) {
    ({ error } = await supabase.from('public_posts').insert(row))
    if (!error || !/priority|icon/i.test(error.message)) break
  }

  if (error) {
    // Gambar yang sudah terunggah tidak boleh tertinggal tanpa post.
    if (gambar) await supabase.storage.from(BUCKET_GAMBAR).remove([gambar.path])
    if (gambar && /image_url/i.test(error.message)) return { error: PESAN_MIGRASI_GAMBAR }
    return { error: 'Gagal membuat post.' }
  }

  segarkan()
  redirect('/home-post')
}

/**
 * Sunting post — hanya oleh pembuatnya, sama dengan menyembunyikan dan
 * menghapus. Gambar: tetap bila tidak disentuh, diganti bila ada berkas baru,
 * dilepas bila `hapus_gambar=1`. Berkas lama baru dihapus SETELAH barisnya
 * tersimpan, supaya kegagalan menyimpan tidak meninggalkan post tanpa gambar.
 */
export async function updatePublicPostAction(postId: string, _: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canPostToHome(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { data: lama } = await supabase.from('public_posts').select('*').eq('id', postId).maybeSingle()
  if (!lama) return { error: 'Post tidak ditemukan.' }
  if (lama.created_by !== session.userId) return { error: 'Tidak memiliki izin.' }
  const gambarLama = (lama as { image_url?: string | null }).image_url ?? null

  const isian = bacaIsian(formData, session.role)
  if ('error' in isian) return { error: isian.error }

  const gambar = await unggahGambar(supabase, formData)
  if (gambar && 'error' in gambar) return { error: gambar.error }
  const lepas = !gambar && formData.get('hapus_gambar') === '1' && gambarLama !== null

  const patch = {
    ...isian.base,
    priority: isian.priority,
    icon: isian.icon,
    updated_at: new Date().toISOString(),
    ...(gambar ? { image_url: gambar.url } : lepas ? { image_url: null } : {}),
  }
  const { error } = await supabase.from('public_posts').update(patch).eq('id', postId)
  if (error) {
    if (gambar) await supabase.storage.from(BUCKET_GAMBAR).remove([gambar.path])
    if ((gambar || lepas) && /image_url/i.test(error.message)) return { error: PESAN_MIGRASI_GAMBAR }
    return { error: 'Gagal menyimpan perubahan.' }
  }

  if (gambar || lepas) await hapusGambar(supabase, gambarLama)

  segarkan(postId)
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
  if (post.created_by !== session.userId) {
    return { error: 'Tidak memiliki izin.' }
  }

  const { error } = await supabase
    .from('public_posts')
    .update({ is_active: isActive })
    .eq('id', postId)

  if (error) return { error: 'Gagal memperbarui post.' }

  segarkan(postId)
  return { success: true }
}

export async function deletePublicPostAction(postId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: post } = await supabase
    .from('public_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (!post) return { error: 'Post tidak ditemukan.' }
  if (post.created_by !== session.userId) {
    return { error: 'Tidak memiliki izin.' }
  }

  const { error } = await supabase.from('public_posts').delete().eq('id', postId)
  if (error) return { error: 'Gagal menghapus post.' }
  await hapusGambar(supabase, (post as { image_url?: string | null }).image_url)

  segarkan(postId)
  redirect('/home-post')
}
