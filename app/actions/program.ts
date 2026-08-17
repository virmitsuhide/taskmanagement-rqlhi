'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditProgram } from '@/lib/auth/permissions'
import { PROGRAM_ACCENT_KEYS, PROGRAM_ICON_KEYS, slugify } from '@/lib/programs/theme'

const BUCKET = 'program-images'

/** Semua rute yang menampilkan program. */
function revalidateProgramPaths(slug?: string) {
  revalidatePath('/')
  revalidatePath('/program')
  revalidatePath('/humas/program')
  if (slug) revalidatePath(`/program/${slug}`)
}

async function uploadPhoto(
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

/** Field isi yang sama antara create & update. */
function readFields(formData: FormData) {
  const title = ((formData.get('title') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim()
  const rawIcon = ((formData.get('icon') as string) ?? '').trim()
  const rawAccent = ((formData.get('accent') as string) ?? '').trim()

  return {
    title,
    description,
    icon: PROGRAM_ICON_KEYS.includes(rawIcon) ? rawIcon : 'BookOpen',
    accent: (PROGRAM_ACCENT_KEYS as string[]).includes(rawAccent) ? rawAccent : 'emerald',
    long_description: ((formData.get('long_description') as string) ?? '').trim(),
    curriculum:       ((formData.get('curriculum') as string) ?? '').trim(),
    schedule:         ((formData.get('schedule') as string) ?? '').trim(),
    target_audience:  ((formData.get('target_audience') as string) ?? '').trim(),
    contact_info:     ((formData.get('contact_info') as string) ?? '').trim(),
    is_active: formData.get('is_active') === 'on' || formData.get('is_active') === '1',
  }
}

export async function createProgramAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }

  const fields = readFields(formData)
  if (!fields.title) return { error: 'Nama program wajib diisi.' }
  if (!fields.description) return { error: 'Ringkasan wajib diisi — dipakai di kartu beranda.' }

  const supabase = createServerClient()

  // Slug diturunkan dari judul; kalau bentrok, tambahkan akhiran angka.
  const base = slugify(fields.title) || 'program'
  let slug = base
  for (let i = 2; i < 50; i++) {
    const { data: taken } = await supabase
      .from('programs').select('slug').eq('slug', slug).maybeSingle()
    if (!taken) break
    slug = `${base}-${i}`
  }

  // Program baru ditaruh paling bawah.
  const { data: last } = await supabase
    .from('programs').select('display_order')
    .order('display_order', { ascending: false }).limit(1).maybeSingle()
  const display_order = ((last?.display_order as number | undefined) ?? 0) + 1

  const photoFile = formData.get('photo') as File | null
  let photo_url: string | null = null
  if (photoFile && photoFile.size > 0) photo_url = await uploadPhoto(supabase, photoFile)

  const { error } = await supabase.from('programs').insert({
    ...fields,
    slug,
    photo_url,
    display_order,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  })

  if (error) return { error: error.message || 'Gagal membuat program.' }

  revalidateProgramPaths(slug)
  redirect('/humas/program')
}

export async function updateProgramAction(slug: string, _: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }

  const fields = readFields(formData)
  if (!fields.title) return { error: 'Nama program wajib diisi.' }
  if (!fields.description) return { error: 'Ringkasan wajib diisi — dipakai di kartu beranda.' }

  const supabase = createServerClient()

  const update: Record<string, unknown> = {
    ...fields,
    updated_by: session.userId,
    updated_at: new Date().toISOString(),
  }

  const photoFile = formData.get('photo') as File | null
  const removePhoto = formData.get('remove_photo') === '1'
  if (photoFile && photoFile.size > 0) {
    const url = await uploadPhoto(supabase, photoFile)
    if (url) update.photo_url = url
  } else if (removePhoto) {
    update.photo_url = null
  }

  const { error } = await supabase.from('programs').update(update).eq('slug', slug)
  if (error) return { error: error.message || 'Gagal menyimpan perubahan.' }

  revalidateProgramPaths(slug)
  redirect('/humas/program')
}

export async function toggleProgramAction(slug: string, isActive: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('programs')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('slug', slug)

  if (error) return { error: error.message }
  revalidateProgramPaths(slug)
  return { success: true }
}

export async function deleteProgramAction(slug: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('programs').delete().eq('slug', slug)
  if (error) return { error: error.message }

  revalidateProgramPaths(slug)
  return { success: true }
}

/**
 * Geser satu program naik/turun dengan menukar display_order-nya dengan
 * tetangga terdekat. Menukar sepasang nilai jauh lebih aman daripada menulis
 * ulang seluruh urutan — kalau dua editor menggeser bersamaan, yang kacau
 * paling banter dua baris, bukan seluruh daftar.
 */
export async function moveProgramAction(slug: string, direction: 'up' | 'down') {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canEditProgram(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { data: all } = await supabase
    .from('programs')
    .select('slug, display_order')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const list = (all ?? []) as { slug: string; display_order: number }[]
  const idx = list.findIndex(p => p.slug === slug)
  if (idx === -1) return { error: 'Program tidak ditemukan.' }

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= list.length) return { success: true } // sudah di ujung

  const a = list[idx]
  const b = list[swapIdx]

  // Urutan bisa sama-sama 0 pada data lama; pakai posisi indeks sebagai
  // nilai pengganti supaya penukaran tetap menghasilkan urutan yang berbeda.
  const aOrder = a.display_order === b.display_order ? idx + 1 : a.display_order
  const bOrder = a.display_order === b.display_order ? swapIdx + 1 : b.display_order

  const [r1, r2] = await Promise.all([
    supabase.from('programs').update({ display_order: bOrder }).eq('slug', a.slug),
    supabase.from('programs').update({ display_order: aOrder }).eq('slug', b.slug),
  ])
  if (r1.error || r2.error) return { error: r1.error?.message ?? r2.error?.message }

  revalidateProgramPaths()
  return { success: true }
}
