'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageStudents } from '@/lib/auth/permissions'
import type { Gender, Jenjang } from '@/types'

function pickStudentFields(formData: FormData) {
  return {
    nis: ((formData.get('nis') as string) || '').trim() || null,
    full_name: ((formData.get('full_name') as string) || '').trim(),
    gender: ((formData.get('gender') as string) || null) as Gender | null,
    birth_date: ((formData.get('birth_date') as string) || '') || null,
    jenjang: formData.get('jenjang') as Jenjang,
    kelas: ((formData.get('kelas') as string) || '').trim() || null,
    halaqoh_id: ((formData.get('halaqoh_id') as string) || '') || null,
    wali_name: ((formData.get('wali_name') as string) || '').trim() || null,
    wali_phone: ((formData.get('wali_phone') as string) || '').trim() || null,
    wali_email: ((formData.get('wali_email') as string) || '').trim() || null,
    current_method_id: ((formData.get('current_method_id') as string) || '') || null,
    current_jilid_id: ((formData.get('current_jilid_id') as string) || '') || null,
    current_jilid_page: formData.get('current_jilid_page')
      ? Number(formData.get('current_jilid_page')) || null
      : null,
  }
}

export async function createStudentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const fields = pickStudentFields(formData)
  if (!fields.full_name || !fields.jenjang) {
    return { error: 'Nama lengkap dan jenjang wajib diisi.' }
  }
  if (!canManageStudents(session.role, fields.jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa jenjang ini.' }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('students')
    .insert(fields)
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return { error: 'NIS sudah dipakai siswa lain.' }
    }
    return { error: 'Gagal menambah siswa.' }
  }

  revalidatePath('/siswa')
  redirect(`/siswa/${data.id}`)
}

export async function updateStudentAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'ID siswa hilang.' }

  const fields = pickStudentFields(formData)
  const is_active = formData.get('is_active') === 'on'
  if (!fields.full_name || !fields.jenjang) {
    return { error: 'Nama lengkap dan jenjang wajib diisi.' }
  }
  if (!canManageStudents(session.role, fields.jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa jenjang ini.' }
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang').eq('id', id).single()
  if (!existing || !canManageStudents(session.role, existing.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk siswa ini.' }
  }

  const { error } = await supabase
    .from('students')
    .update({ ...fields, is_active })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'NIS sudah dipakai siswa lain.' }
    return { error: 'Gagal memperbarui siswa.' }
  }

  revalidatePath('/siswa')
  revalidatePath(`/siswa/${id}`)
  redirect(`/siswa/${id}`)
}

export async function deleteStudentAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('students').select('jenjang').eq('id', id).single()
  if (!existing) return { error: 'Siswa tidak ditemukan.' }
  if (!canManageStudents(session.role, existing.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  // Soft delete: set is_active=false. Lebih aman daripada hard delete karena
  // ada FK ke tahsin_logs/tahfidz_logs.
  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', id)
  if (error) return { error: 'Gagal menonaktifkan siswa.' }

  revalidatePath('/siswa')
  redirect('/siswa')
}
