'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canHavePengurusProfile } from '@/lib/auth/permissions'
import { highestLevel, isEducationLevel, sortEducation } from '@/lib/profil/pendidikan'
import { focusFromFormData } from '@/lib/profil/foto'
import { collectRows } from '@/lib/profil/form-rows'
import type { EducationEntry, TrainingEntry, AmanahEntry, AwardEntry, CompetencyEntry } from '@/types'

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

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
export async function updatePengurusProfileAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canHavePengurusProfile(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()

  const sapaan = formData.get('sapaan') as string

  // Riwayat pendidikan: baris tanpa jenjang terpilih dibuang, sisanya diurutkan
  // dari jenjang terendah. `education_level` menyusul sebagai jenjang tertinggi.
  const educationHistory = sortEducation(
    collectRows<EducationEntry>(
      formData,
      [
        { key: 'level', field: 'edu_level' },
        { key: 'institution', field: 'edu_institution' },
        { key: 'major', field: 'edu_major' },
        { key: 'graduation_year', field: 'edu_year' },
      ],
      'level',
    ).filter(row => isEducationLevel(row.level)),
  )

  // Dua daftar kompetensi berbentuk sama; yang membedakan hanya awalan
  // fieldnya. Lembaga yang kosong dibiarkan kosong — itulah cara menyatakan
  // "belum tersertifikasi" (lihat CompetencyEntry).
  const quranCompetencies = collectRows<CompetencyEntry>(
    formData,
    [
      { key: 'name', field: 'quran_comp_name' },
      { key: 'institution', field: 'quran_comp_institution' },
    ],
    'name',
  )

  const otherCompetencies = collectRows<CompetencyEntry>(
    formData,
    [
      { key: 'name', field: 'other_comp_name' },
      { key: 'institution', field: 'other_comp_institution' },
    ],
    'name',
  )

  const ijazahSanad = formData
    .getAll('ijazah_sanad')
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
    education_history: educationHistory,
    education_level: highestLevel(educationHistory),
    // Posisi foto ikut tersimpan tiap kali profil disimpan, termasuk saat
    // fotonya tidak diganti — menggeser bingkai saja sudah pantas disimpan.
    photo_focus: focusFromFormData(formData, 'photo_focus'),
    quran_competencies: quranCompetencies,
    other_competencies: otherCompetencies,
    ijazah_sanad: ijazahSanad,
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
  if (error) {
    // Kolom baru belum ada → beri tahu migrasinya, jangan diam-diam membuang
    // riwayat yang barusan diketik pengurus.
    if (error.message?.includes('education_history')) {
      return {
        error:
          'Riwayat pendidikan belum bisa disimpan: jalankan drizzle/0039_riwayat_pendidikan_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    if (error.message?.includes('quran_competencies') || error.message?.includes('ijazah_sanad')) {
      return {
        error:
          'Kompetensi & ijazah belum bisa disimpan: jalankan drizzle/0042_kompetensi_quran_ijazah_sanad_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    if (error.message?.includes('photo_focus')) {
      return {
        error:
          'Posisi foto belum bisa disimpan: jalankan drizzle/0040_foto_geser_dan_foto_guru_PASTE_TO_SUPABASE.sql di Supabase.',
      }
    }
    return { error: 'Gagal menyimpan profil.' }
  }

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
