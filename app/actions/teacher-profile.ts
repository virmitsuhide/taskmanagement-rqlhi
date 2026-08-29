'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageTeacherProfiles } from '@/lib/auth/permissions'
import { highestLevel, isEducationLevel, sortEducation } from '@/lib/profil/pendidikan'
import { collectRows } from '@/lib/profil/form-rows'
import { focusFromFormData } from '@/lib/profil/foto'
import type {
  AmanahEntry, AwardEntry, CompetencyEntry, EducationEntry, TrainingEntry,
} from '@/types'

/**
 * Profil guru Qur'an — disunting dari dua pintu.
 *
 * SDM lewat /ustadz/profil, dan guru sendiri lewat /guru/profil. Keduanya
 * menulis ke baris teachers yang sama, tapi TIDAK ke kolom yang sama:
 *
 *   Data diri (nama panggilan, TTL, pendidikan, kompetensi, ijazah,
 *   diklat, amanah, penghargaan)      → SDM & guru
 *   Kepegawaian (unit, TMT, NIP,
 *   jenis kepegawaian)                → SDM saja
 *
 * Pemisahan itu bukan kerapian tampilan. Unit menentukan rubrik KPI mana yang
 * dipakai menilai guru, TMT menentukan masa kerja yang tercetak di rapornya,
 * dan jenis kepegawaian menentukan pos gaji. Ketiganya keputusan lembaga —
 * kalau guru bisa mengubahnya sendiri, ia bisa mengubah dasar penilaian atas
 * dirinya sendiri. Karena itu pemisahannya ditegakkan di server, bukan dengan
 * menyembunyikan medannya di form.
 */

const teks = (fd: FormData, key: string) => ((fd.get(key) as string) ?? '').trim() || null

/** Bagian data diri — sama persis untuk kedua pintu masuk. */
function bacaDataDiri(formData: FormData): Record<string, unknown> {
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
    // Aman ditulis sejak form profil guru punya pengatur posisinya sendiri:
    // nilainya berasal dari lingkaran yang barusan dilihat penyuntingnya, bukan
    // dari nilai bawaan. Halaman Humas (/humas/beranda) menulis kolom yang sama
    // — siapa pun yang menyimpan terakhir, itulah bingkai yang berlaku.
    photo_focus: focusFromFormData(formData, 'photo_focus'),
    updated_at: new Date().toISOString(),
  }
}

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/**
 * Unggah foto guru bila ada berkas baru pada form.
 *
 * Berbagi bucket & awalan nama berkas ('teacher-') dengan unggahan Humas di
 * app/actions/site.ts, jadi foto yang diunggah dari sini terbaca di sana dan
 * sebaliknya. Mengembalikan undefined kalau tidak ada berkas (kolom foto tidak
 * disentuh), atau null kalau unggahannya gagal — pemanggil tetap menyimpan
 * sisa profilnya dan melaporkan kegagalan fotonya secara terpisah.
 */
async function unggahFoto(
  supabase: ReturnType<typeof createServerClient>,
  formData: FormData,
  teacherId: string,
): Promise<string | null | undefined> {
  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return undefined
  if (file.size > MAX_PHOTO_BYTES) return null
  try {
    const bytes = await file.arrayBuffer()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`teacher-${teacherId}-${Date.now()}.${ext}`, Buffer.from(bytes), {
        contentType: file.type,
        upsert: true,
      })
    if (error || !data) return null
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(data.path).data.publicUrl
  } catch {
    return null
  }
}

/** Pesan galat yang menunjuk migrasinya, bukan "gagal menyimpan" yang buntu. */
function pesanGalat(message: string | undefined): string {
  if (message?.includes('education_history') || message?.includes('quran_competencies') || message?.includes('sapaan')) {
    return 'Profil guru belum bisa disimpan: jalankan drizzle/0044_profil_guru_dan_catatan_kpi_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  return 'Gagal menyimpan profil guru.'
}

/** Disunting SDM — termasuk kolom kepegawaian. */
export async function updateGuruProfileBySdmAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageTeacherProfiles(session.role)) return { error: 'Tidak memiliki izin.' }

  const teacherId = formData.get('teacher_id') as string
  if (!teacherId) return { error: 'Guru tidak dikenali.' }

  const fullName = ((formData.get('full_name') as string) ?? '').trim()
  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }

  const unit = formData.get('unit') as string
  const employment = formData.get('employment_type') as string

  const patch = {
    ...bacaDataDiri(formData),
    full_name: fullName,
    nip: teks(formData, 'nip'),
    // TMT boleh dikosongkan: lebih baik kosong daripada tanggal yang tidak
    // pernah dimasukkan siapa pun — lihat migrasi 0044.
    joined_at: (formData.get('joined_at') as string) || null,
    unit: ['paud', 'sd', 'sd_juara', 'smp', 'sma'].includes(unit) ? unit : null,
    employment_type: ['tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq'].includes(employment)
      ? employment
      : null,
  }

  const supabase = createServerClient()

  const foto = await unggahFoto(supabase, formData, teacherId)
  if (foto) (patch as Record<string, unknown>).photo_url = foto

  const { error } = await supabase.from('teachers').update(patch).eq('id', teacherId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/ustadz/profil')
  revalidatePath('/ustadz')
  revalidatePath('/kpi/cetak')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB dan bucket "profile-photos" sudah dibuat di Supabase.'
      : 'Profil guru tersimpan.',
  }
}

/**
 * Disunting guru sendiri lewat portal guru.
 *
 * Id gurunya diambil dari sesi, TIDAK dari form. Medan tersembunyi berisi id
 * bisa disunting siapa pun yang membuka peralatan pengembang peramban, dan
 * satu medan seperti itu sudah cukup untuk menyunting profil rekannya.
 */
export async function updateOwnGuruProfileAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()

  const patch: Record<string, unknown> = bacaDataDiri(formData)
  const foto = await unggahFoto(supabase, formData, session.teacherId)
  if (foto) patch.photo_url = foto

  const { error } = await supabase.from('teachers').update(patch).eq('id', session.teacherId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/guru/profil')
  revalidatePath('/ustadz/profil')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB.'
      : 'Profil tersimpan. Terima kasih — data ini memudahkan SDM.',
  }
}
