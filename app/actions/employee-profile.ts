'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getEmployeeSession } from '@/lib/auth/employee-session'
import { canManageEmployees } from '@/lib/auth/permissions'
import { bacaDataDiri, teks, unggahFotoProfil } from '@/lib/profil/data-diri'

/**
 * Profil karyawan — disunting dari dua pintu, sama seperti profil guru.
 *
 *   Data diri     → karyawan sendiri & admin
 *   Kepegawaian   → admin saja (jabatan, NIP, TMT, jenis kepegawaian)
 *
 * Pemisahannya ditegakkan di server, bukan dengan menyembunyikan medannya di
 * form: action karyawan memang tidak pernah membaca medan kepegawaian, jadi
 * menyisipkannya lewat peralatan pengembang peramban tidak berpengaruh.
 */

const pesanGalat = (message: string | undefined): string =>
  message?.includes('employees')
    ? 'Profil karyawan belum bisa disimpan: jalankan drizzle/0048_karyawan_rq_PASTE_TO_SUPABASE.sql di Supabase.'
    : `Gagal menyimpan profil karyawan: ${message ?? 'sebab tidak diketahui'}`

/** Disunting karyawan sendiri lewat portalnya. */
export async function updateOwnEmployeeProfileAction(_: unknown, formData: FormData) {
  const session = await getEmployeeSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()

  // Id diambil dari sesi, TIDAK dari form: medan tersembunyi berisi id bisa
  // disunting siapa pun yang membuka peralatan pengembang peramban.
  const patch: Record<string, unknown> = bacaDataDiri(formData)
  const foto = await unggahFotoProfil(supabase, formData, 'employee', session.employeeId)
  if (foto) patch.photo_url = foto

  const { error } = await supabase.from('employees').update(patch).eq('id', session.employeeId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/karyawan/profil')
  revalidatePath('/profil')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB.'
      : 'Profil tersimpan.',
  }
}

/** Disunting admin — termasuk kolom kepegawaian. */
export async function updateEmployeeBySdmAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageEmployees(session.role)) return { error: 'Tidak memiliki izin.' }

  const employeeId = formData.get('employee_id') as string
  if (!employeeId) return { error: 'Karyawan tidak dikenali.' }

  const fullName = ((formData.get('full_name') as string) ?? '').trim()
  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }

  const employment = formData.get('employment_type') as string

  const patch: Record<string, unknown> = {
    ...bacaDataDiri(formData),
    full_name: fullName,
    jabatan: teks(formData, 'jabatan'),
    nip: teks(formData, 'nip'),
    joined_at: (formData.get('joined_at') as string) || null,
    employment_type: ['tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq'].includes(employment)
      ? employment
      : null,
  }

  const supabase = createServerClient()

  const foto = await unggahFotoProfil(supabase, formData, 'employee', employeeId)
  if (foto) patch.photo_url = foto

  const { error } = await supabase.from('employees').update(patch).eq('id', employeeId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/karyawan')
  revalidatePath('/profil')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB.'
      : 'Profil karyawan tersimpan.',
  }
}
