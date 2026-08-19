'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh } from '@/lib/auth/permissions'
import type { Jenjang } from '@/types'

export async function createHalaqohAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const name = (formData.get('name') as string)?.trim()
  const jenjang = formData.get('jenjang') as Jenjang
  const waliRaw = (formData.get('wali_teacher_id') as string) || ''
  const wali_teacher_id = (!waliRaw || waliRaw === 'none') ? null : waliRaw
  const schedule_note = (formData.get('schedule_note') as string)?.trim() || null

  if (!name || !jenjang) return { error: 'Nama dan jenjang wajib diisi.' }
  if (!canManageHalaqoh(session.role, jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk halaqoh jenjang ini.' }
  }

  const supabase = createServerClient()

  // Halaqoh selalu milik satu semester. Tiap semester santri dan guru diacak
  // ulang, jadi halaqoh yang dibuat sekarang adalah halaqoh semester berjalan
  // — bukan kelompok abadi. Tanpa penanda ini, pembagian semester lalu akan
  // tercampur dengan yang sekarang begitu pengacakan berikutnya dibuat.
  const { data: term } = await supabase
    .from('academic_terms')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()

  if (!term) {
    return { error: 'Belum ada tahun ajaran berjalan. Tetapkan dulu semester aktif.' }
  }

  const { data, error } = await supabase
    .from('halaqoh')
    .insert({ name, jenjang, wali_teacher_id, schedule_note, term_id: term.id })
    .select('id')
    .single()

  if (error || !data) return { error: 'Gagal membuat halaqoh.' }

  revalidatePath('/halaqoh')
  redirect(`/halaqoh/${data.id}`)
}

export async function updateHalaqohAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const jenjang = formData.get('jenjang') as Jenjang
  const waliRaw = (formData.get('wali_teacher_id') as string) || ''
  const wali_teacher_id = (!waliRaw || waliRaw === 'none') ? null : waliRaw
  const schedule_note = (formData.get('schedule_note') as string)?.trim() || null
  const is_active = formData.get('is_active') === 'on'

  if (!id || !name || !jenjang) return { error: 'Data tidak lengkap.' }
  if (!canManageHalaqoh(session.role, jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk halaqoh jenjang ini.' }
  }

  const supabase = createServerClient()

  // Pastikan record existing juga dalam scope user
  const { data: existing } = await supabase
    .from('halaqoh').select('jenjang').eq('id', id).single()
  if (!existing || !canManageHalaqoh(session.role, existing.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin untuk halaqoh ini.' }
  }

  const { error } = await supabase
    .from('halaqoh')
    .update({ name, jenjang, wali_teacher_id, schedule_note, is_active })
    .eq('id', id)

  if (error) return { error: 'Gagal memperbarui halaqoh.' }

  revalidatePath('/halaqoh')
  revalidatePath(`/halaqoh/${id}`)
  redirect(`/halaqoh/${id}`)
}

export async function deleteHalaqohAction(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('halaqoh').select('jenjang').eq('id', id).single()
  if (!existing) return { error: 'Halaqoh tidak ditemukan.' }
  if (!canManageHalaqoh(session.role, existing.jenjang as Jenjang)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  // Cek apakah ada siswa di halaqoh ini
  const { count } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('halaqoh_id', id)
  if ((count ?? 0) > 0) {
    return { error: `Halaqoh masih punya ${count} siswa. Pindahkan siswa dulu sebelum menghapus.` }
  }

  const { error } = await supabase.from('halaqoh').delete().eq('id', id)
  if (error) return { error: 'Gagal menghapus halaqoh.' }

  revalidatePath('/halaqoh')
  redirect('/halaqoh')
}
