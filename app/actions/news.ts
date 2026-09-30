'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { fromWibInputValue, hasStatusColumns } from '@/lib/data/news-status'

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

// ─── Status tayang (Draf / Terbitkan sekarang / Jadwalkan) ───────────────────
// Kolom status & publish_at baru ada setelah migrasi 0107. Field form
// `publish_mode` bersifat opsional: bila tidak dikirim, perilaku lama berlaku
// persis (langsung terbit, tanpa menyentuh kolom baru).

type PublishMode = 'draf' | 'sekarang' | 'jadwal'
type Publishing = { mode: PublishMode; scheduledAt: string | null }

const MIGRATION_HINT =
  'Draf & jadwal terbit belum aktif — jalankan migrasi drizzle/0107_berita_status_dan_dibaca di Supabase dulu.'

function parsePublishing(formData: FormData): Publishing | { error: string } | null {
  const raw = (formData.get('publish_mode') as string | null)?.trim()
  if (!raw) return null
  if (raw !== 'draf' && raw !== 'sekarang' && raw !== 'jadwal') return null
  if (raw !== 'jadwal') return { mode: raw, scheduledAt: null }
  const iso = fromWibInputValue(formData.get('publish_at') as string | null)
  if (!iso) return { error: 'Tanggal & jam tayang wajib diisi untuk berita terjadwal.' }
  if (new Date(iso).getTime() <= Date.now()) {
    return { error: 'Waktu tayang sudah lewat — pilih "Terbitkan sekarang" atau atur waktu yang akan datang.' }
  }
  return { mode: 'jadwal', scheduledAt: iso }
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true
  return /(status|publish_at).*(column|schema cache)|column.*(status|publish_at)/i.test(error.message ?? '')
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

  const publishing = parsePublishing(formData)
  if (publishing && 'error' in publishing) return { error: publishing.error }

  const base = {
    title,
    excerpt,
    content,
    thumbnail_url: thumbnailUrl,
    category,
    type,
    author_id: session.userId,
    is_active: true,
  }
  const statusFields = publishing
    ? {
        status: publishing.mode === 'draf' ? 'draf' : 'terbit',
        publish_at:
          publishing.mode === 'jadwal' ? publishing.scheduledAt
          : publishing.mode === 'sekarang' ? new Date().toISOString()
          : null,
      }
    : null

  let { error } = await supabase
    .from('news_articles')
    .insert(statusFields ? { ...base, ...statusFields } : base)

  // Sebelum migrasi 0107: kolom status/publish_at belum ada.
  if (error && statusFields && isMissingColumnError(error)) {
    if (publishing?.mode !== 'sekarang') return { error: MIGRATION_HINT }
    ;({ error } = await supabase.from('news_articles').insert(base))
  }

  if (error) return { error: error.message || 'Gagal membuat berita.' }

  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath('/humas/berita')
  // Editor kembali ke panel kelola, bukan ke halaman publik — di sanalah
  // status terbit/nonaktif dan seluruh arsip terlihat.
  redirect('/humas/berita')
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

  const publishing = parsePublishing(formData)
  if (publishing && 'error' in publishing) return { error: publishing.error }

  if (thumbnailFile && thumbnailFile.size > 0) {
    const url = await uploadThumbnail(supabase, thumbnailFile)
    if (url) update.thumbnail_url = url
  } else if (removeThumbnail) {
    update.thumbnail_url = null
  }

  // Kolom status hanya ikut disimpan bila barisnya sudah memilikinya
  // (migrasi 0107 sudah dijalankan).
  let statusFields: Record<string, unknown> | null = null
  if (publishing) {
    const { data: existing } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', newsId)
      .maybeSingle()
    const current = existing as { status?: string | null; publish_at?: string | null } | null
    if (current && hasStatusColumns(current)) {
      if (publishing.mode === 'draf') {
        statusFields = { status: 'draf', publish_at: null }
      } else if (publishing.mode === 'jadwal') {
        statusFields = { status: 'terbit', publish_at: publishing.scheduledAt }
      } else {
        // Terbitkan sekarang: tanggal tayang lama dipertahankan bila berita
        // memang sudah tayang; draf/terjadwal mendapat waktu terbit = sekarang.
        const alreadyLive =
          current.status !== 'draf' &&
          (!current.publish_at || new Date(current.publish_at).getTime() <= Date.now())
        statusFields = {
          status: 'terbit',
          publish_at: alreadyLive ? current.publish_at ?? null : new Date().toISOString(),
        }
      }
    } else if (publishing.mode !== 'sekarang') {
      return { error: MIGRATION_HINT }
    }
  }

  let { error } = await supabase
    .from('news_articles')
    .update(statusFields ? { ...update, ...statusFields } : update)
    .eq('id', newsId)

  if (error && statusFields && isMissingColumnError(error)) {
    if (publishing?.mode !== 'sekarang') return { error: MIGRATION_HINT }
    ;({ error } = await supabase.from('news_articles').update(update).eq('id', newsId))
  }

  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  revalidatePath('/')
  revalidatePath('/news')
  revalidatePath('/humas/berita')
  revalidatePath(`/news/${newsId}`)
  redirect('/humas/berita')
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
  revalidatePath('/humas/berita')
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
  revalidatePath('/humas/berita')
  revalidatePath('/')
  return { success: true }
}
