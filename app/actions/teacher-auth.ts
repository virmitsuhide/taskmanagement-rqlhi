'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { createTeacherSession, destroyTeacherSession } from '@/lib/auth/teacher-session'

export async function loginTeacherAction(_: unknown, formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  const supabase = createServerClient()
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, username, password_hash, full_name, is_active')
    .eq('username', username)
    .maybeSingle()

  if (error || !teacher) {
    return { error: 'Username atau password salah.' }
  }

  if (!teacher.is_active) {
    return { error: 'Akun guru ini sudah dinonaktifkan. Hubungi admin.' }
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
