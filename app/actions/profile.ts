'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canHavePengurusProfile } from '@/lib/auth/permissions'
import type { TrainingEntry, AmanahEntry, AwardEntry } from '@/types'

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'S1', 'S2', 'S3']

/**
 * Unggah foto profil. Mengembalikan null kalau gagal — pemanggil memilih untuk
 * tetap menyimpan sisa profil, supaya bucket yang belum dibuat tidak membuat
 * seluruh form gagal.
 */
async function uploadPhoto(
  supabase: ReturnType<typeof createServerClient>,
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${userId}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filename, Buffer.from(bytes), { contentType: file.type, upsert: true })
    if (error || !data) return null
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}

/**
 * Baris daftar dikirim sebagai field berulang dengan nama sama, mis.
 * `training_name`, `training_year`, `training_organizer`. getAll() menjaga
 * urutannya, jadi indeks ke-i dari tiap field membentuk satu baris.
 * Baris yang kolom utamanya kosong dibuang.
 */
function collectRows<T>(
  formData: FormData,
  fields: { key: keyof T & string; field: string }[],
  requiredKey: keyof T & string,
): T[] {
  const columns = fields.map(f => formData.getAll(f.field).map(v => String(v)))
  const length = Math.max(0, ...columns.map(c => c.length))

  const rows: T[] = []
  for (let i = 0; i < length; i++) {
    const row: Record<string, string> = {}
    fields.forEach((f, ci) => {
      row[f.key] = (columns[ci][i] ?? '').trim()
    })
    if (row[requiredKey]) rows.push(row as T)
  }
  return rows
}

export async function updatePengurusProfileAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canHavePengurusProfile(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()

  const sapaan = formData.get('sapaan') as string
  const educationLevel = formData.get('education_level') as string

  const competencies = formData
    .getAll('competency')
    .map(v => String(v).trim())
    .filter(Boolean)

  const trainings = collectRows<TrainingEntry>(
    formData,
    [
      { key: 'name', field: 'training_name' },
      { key: 'year', field: 'training_year' },
      { key: 'organizer', field: 'training_organizer' },
    ],
    'name',
  )

  const amanahHistory = collectRows<AmanahEntry>(
    formData,
    [
      { key: 'position', field: 'amanah_position' },
      { key: 'period', field: 'amanah_period' },
    ],
    'position',
  )

  const awards = collectRows<AwardEntry>(
    formData,
    [
      { key: 'name', field: 'award_name' },
      { key: 'year', field: 'award_year' },
    ],
    'name',
  )

  const patch: Record<string, unknown> = {
    sapaan: sapaan === 'ust' || sapaan === 'usth' ? sapaan : null,
    nickname: (formData.get('nickname') as string)?.trim() || null,
    full_name: (formData.get('full_name') as string)?.trim() || null,
    nip: (formData.get('nip') as string)?.trim() || null,
    birth_place: (formData.get('birth_place') as string)?.trim() || null,
    birth_date: (formData.get('birth_date') as string) || null,
    current_amanah: (formData.get('current_amanah') as string)?.trim() || null,
    education_level: EDUCATION_LEVELS.includes(educationLevel) ? educationLevel : null,
    competencies,
    trainings,
    amanah_history: amanahHistory,
    awards,
  }

  // Foto hanya disentuh kalau ada berkas baru yang diunggah.
  const photo = formData.get('photo') as File | null
  let photoWarning: string | null = null
  if (photo && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return { error: 'Ukuran foto maksimal 2 MB.' }
    }
    const url = await uploadPhoto(supabase, photo, session.userId)
    if (url) patch.photo_url = url
    else photoWarning = 'Profil tersimpan, tetapi foto gagal diunggah. Pastikan bucket "profile-photos" sudah dibuat di Supabase.'
  }

  const { error } = await supabase.from('users').update(patch).eq('id', session.userId)
  if (error) return { error: 'Gagal menyimpan profil.' }

  revalidatePath('/profil')
  revalidatePath('/', 'layout')

  if (photoWarning) return { success: true, message: photoWarning }
  return { success: true, message: 'Profil berhasil disimpan.' }
}

export async function updateEmailAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const email = (formData.get('email') as string)?.trim()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('users')
    .update({ email: email || null })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal memperbarui email.' }

  revalidatePath('/profil')
  return { success: true, message: 'Email berhasil diperbarui.' }
}

export async function changePasswordAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: user } = await supabase
    .from('users')
    .select('password_hash, can_change_password')
    .eq('id', session.userId)
    .single()

  if (!user) return { error: 'User tidak ditemukan.' }
  if (!user.can_change_password) return { error: 'Akun ini tidak dapat mengganti password.' }

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword !== confirmPassword) return { error: 'Konfirmasi password tidak cocok.' }
  if (newPassword.length < 8) return { error: 'Password minimal 8 karakter.' }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return { error: 'Password saat ini tidak benar.' }

  const hash = await bcrypt.hash(newPassword, 12)
  const { error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal mengganti password.' }

  return { success: true, message: 'Password berhasil diperbarui.' }
}
