'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageStudents } from '@/lib/auth/permissions'
import type { Gender, Jenjang } from '@/types'

/** Ubah string kosong atau sentinel 'none' (dari Radix Select) menjadi null. */
function clean(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim()
  if (!s || s === 'none') return null
  return s
}

function pickStudentFields(formData: FormData) {
  return {
    nis: clean(formData.get('nis')),
    full_name: ((formData.get('full_name') as string) || '').trim(),
    gender: clean(formData.get('gender')) as Gender | null,
    birth_date: clean(formData.get('birth_date')),
    jenjang: formData.get('jenjang') as Jenjang,
    kelas: clean(formData.get('kelas')),
    program: clean(formData.get('program')),
    halaqoh_id: clean(formData.get('halaqoh_id')),
    wali_name: clean(formData.get('wali_name')),
    wali_phone: clean(formData.get('wali_phone')),
    wali_email: clean(formData.get('wali_email')),
    current_method_id: clean(formData.get('current_method_id')),
    current_jilid_id: clean(formData.get('current_jilid_id')),
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

  await syncHalaqohMembership(supabase, data.id, fields.halaqoh_id)

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
    .from('students').select('jenjang, halaqoh_id').eq('id', id).single()
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

  if (fields.halaqoh_id !== (existing.halaqoh_id as string | null)) {
    await syncHalaqohMembership(supabase, id, fields.halaqoh_id, existing.halaqoh_id as string | null)
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

/**
 * Catat perpindahan halaqoh sebagai riwayat, bukan sekadar mengganti pointer.
 *
 * `students.halaqoh_id` tetap dipertahankan sebagai penunjuk penempatan yang
 * berlaku sekarang — puluhan layar memakainya untuk pertanyaan "halaqoh anak
 * ini apa?", dan menjadikannya JOIN di semua tempat tidak sepadan. Sumber
 * kebenaran riwayatnya ada di `halaqoh_members`, yang disegarkan di sini.
 *
 * Karena halaqoh sendiri milik satu semester (halaqoh.term_id), keanggotaan
 * ini ikut bersemester dengan sendirinya. Jadi setelah pengacakan semester
 * berikutnya, pertanyaan "anak ini di halaqoh mana pada Semester 1" tetap
 * terjawab — dan rapor bulan lampau tetap menyebut ustadz yang benar.
 */
async function syncHalaqohMembership(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string,
  nextHalaqohId: string | null,
  previousHalaqohId?: string | null,
) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Keanggotaan lama ditutup, bukan dihapus: kepindahan di tengah semester
  // adalah fakta yang perlu terbaca saat rapor bulan itu disusun.
  if (previousHalaqohId) {
    await supabase
      .from('halaqoh_members')
      .update({ left_at: iso })
      .eq('halaqoh_id', previousHalaqohId)
      .eq('student_id', studentId)
      .is('left_at', null)
  }

  if (!nextHalaqohId) return

  // Kembali ke halaqoh yang pernah ditinggalkan: buka lagi barisnya alih-alih
  // membuat baris kedua — kunci utamanya sepasang (halaqoh, santri).
  await supabase
    .from('halaqoh_members')
    .upsert(
      { halaqoh_id: nextHalaqohId, student_id: studentId, joined_at: iso, left_at: null },
      { onConflict: 'halaqoh_id,student_id' },
    )
}
