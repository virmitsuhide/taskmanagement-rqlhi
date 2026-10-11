'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { isContractExpired } from '@/lib/auth/contract'
import { createTeacherSession, destroyTeacherSession } from '@/lib/auth/teacher-session'
import { POLA_USERNAME_TR } from '@/lib/rq/tahsin-rekomendasi'

export async function loginTeacherAction(_: unknown, formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  // Akun bersama Tahsin Rekomendasi bernama TR1, TR2, … (huruf besar), dan
  // papan ketik HP sering mengetiknya "tr1" atau "Tr1" — samakan dulu.
  const dicari = POLA_USERNAME_TR.test(username.toUpperCase()) ? username.toUpperCase() : username

  const supabase = createServerClient()
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, username, password_hash, full_name, is_active, contract_end')
    .eq('username', dicari)
    // Akun terhapus kehilangan akses saat itu juga.
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !teacher) {
    return { error: 'Username atau password salah.' }
  }

  if (!teacher.is_active) {
    return { error: 'Akun guru ini sudah dinonaktifkan. Hubungi admin.' }
  }

  // Ditolak di sini, bukan hanya saat sesi diperiksa, supaya guru OS yang
  // kontraknya sudah lewat mendapat alasan yang jelas — bukan dilempar
  // bolak-balik ke halaman login tanpa keterangan.
  if (isContractExpired(teacher.contract_end)) {
    return { error: 'Masa kontrak akun ini sudah berakhir. Hubungi admin RQ.' }
  }

  const valid = await bcrypt.compare(password, teacher.password_hash)
  if (!valid) {
    return { error: 'Username atau password salah.' }
  }

  await createTeacherSession({
    teacherId: teacher.id,
    username: teacher.username,
    fullName: teacher.full_name,
  })

  redirect('/guru')
}

export async function logoutTeacherAction() {
  await destroyTeacherSession()
  redirect('/guru/login')
}
