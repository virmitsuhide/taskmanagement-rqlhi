import { createServerClient } from '@/lib/supabase/server'
import { highestLevel, isEducationLevel, sortEducation } from '@/lib/profil/pendidikan'
import { collectRows } from '@/lib/profil/form-rows'
import { focusFromFormData } from '@/lib/profil/foto'
import type {
  AmanahEntry, AwardEntry, CompetencyEntry, EducationEntry, TrainingEntry,
} from '@/types'

/**
 * Pembaca bagian "data diri" dari form profil, dipakai bersama tiga entitas.
 *
 * Kolom profil di teachers, employees, dan users sengaja dibuat sebentuk (lihat
 * drizzle/0044 & 0048), dan satu komponen form melayani ketiganya. Kalau tiap
 * server action menulis pembacanya sendiri, ketiganya akan berbeda pelan-pelan:
 * satu memangkas spasi, satu tidak; satu membuang baris kosong, satu
 * menyimpannya. Diangkat ke sini supaya perbedaan itu tidak punya tempat
 * tumbuh.
 *
 * Sengaja BUKAN berkas 'use server': modul server action hanya boleh
 * mengekspor fungsi async, sedangkan yang di sini dipanggil sebagai penolong
 * biasa dari beberapa action sekaligus.
 */

export const teks = (fd: FormData, key: string) => ((fd.get(key) as string) ?? '').trim() || null

export function bacaDataDiri(formData: FormData): Record<string, unknown> {
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

  const sapaan = formData.get('sapaan')

  return {
    sapaan: sapaan === 'ust' || sapaan === 'usth' ? sapaan : null,
    nickname: teks(formData, 'nickname'),
    birth_place: teks(formData, 'birth_place'),
    birth_date: (formData.get('birth_date') as string) || null,
    education_history: educationHistory,
    education_level: highestLevel(educationHistory),
    quran_competencies: collectRows<CompetencyEntry>(
      formData,
      [{ key: 'name', field: 'quran_comp_name' }, { key: 'institution', field: 'quran_comp_institution' }],
      'name',
    ),
    other_competencies: collectRows<CompetencyEntry>(
      formData,
      [{ key: 'name', field: 'other_comp_name' }, { key: 'institution', field: 'other_comp_institution' }],
      'name',
    ),
    ijazah_sanad: formData.getAll('ijazah_sanad').map(v => String(v).trim()).filter(Boolean),
    trainings: collectRows<TrainingEntry>(
      formData,
      [
        { key: 'name', field: 'training_name' },
        { key: 'year', field: 'training_year' },
        { key: 'organizer', field: 'training_organizer' },
      ],
      'name',
    ),
    amanah_history: collectRows<AmanahEntry>(
      formData,
      [{ key: 'position', field: 'amanah_position' }, { key: 'period', field: 'amanah_period' }],
      'position',
    ),
    awards: collectRows<AwardEntry>(
      formData,
      [{ key: 'name', field: 'award_name' }, { key: 'year', field: 'award_year' }],
      'name',
    ),
    photo_focus: focusFromFormData(formData, 'photo_focus'),
    updated_at: new Date().toISOString(),
  }
}

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/**
 * Unggah foto profil bila ada berkas baru pada form.
 *
 * `prefix` memisahkan berkas milik guru, karyawan, dan pengurus di dalam satu
 * bucket. Mengembalikan undefined kalau tidak ada berkas (kolom foto tidak
 * disentuh), atau null kalau unggahannya gagal — pemanggil tetap menyimpan sisa
 * profilnya dan melaporkan kegagalan fotonya secara terpisah.
 */
export async function unggahFotoProfil(
  supabase: ReturnType<typeof createServerClient>,
  formData: FormData,
  prefix: string,
  id: string,
): Promise<string | null | undefined> {
  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return undefined
  if (file.size > MAX_PHOTO_BYTES) return null
  try {
    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${prefix}-${id}-${Date.now()}.${ext}`, Buffer.from(bytes), {
        contentType: file.type,
        upsert: true,
      })
    if (error || !data) return null
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}
