'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { isContractExpired } from '@/lib/auth/contract'
import { createSession, destroySession } from '@/lib/auth/session'
import { createTeacherSession } from '@/lib/auth/teacher-session'
import { DEFAULT_DASHBOARD } from '@/lib/auth/permissions'
import { POLA_USERNAME_TR } from '@/lib/rq/tahsin-rekomendasi'
import { muatSuasanaSaatLogin } from '@/lib/tampilan/suasana-akun'
import type { UserRole } from '@/types'

/**
 * Login terpadu: satu form untuk pengurus & guru.
 * Deteksi otomatis — cek tabel `users` (pengurus) dulu, lalu `teachers` (guru).
 * Username pengurus (role-based) & guru (ust_*) tidak bentrok, jadi aman.
 */
export async function loginAction(_: unknown, formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  const supabase = createServerClient()

  // 1. Coba sebagai pengurus (users)
  const { data: user } = await supabase
    .from('users')
    .select('id, username, password_hash, role, display_name')
    .eq('username', username)
    .maybeSingle()

  if (user && (await bcrypt.compare(password, user.password_hash))) {
    await createSession({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      displayName: user.display_name,
    })
    // Suasana tampilan tersimpan di akun ikut ke perangkat ini. Tidak pernah
    // melempar galat — login tidak boleh gagal karenanya.
    await muatSuasanaSaatLogin('users', user.id).catch(() => {})
    redirect(`/dashboard/${DEFAULT_DASHBOARD[user.role as UserRole]}`)
  }

  // 2. Coba sebagai guru (teachers). Akun bersama Tahsin Rekomendasi bernama
  // TR1, TR2, … — papan ketik HP sering mengetiknya "tr1", jadi disamakan.
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, username, password_hash, full_name, is_active, contract_end')
    .eq('username', POLA_USERNAME_TR.test(username.toUpperCase()) ? username.toUpperCase() : username)
    // Akun terhapus kehilangan akses saat itu juga.
    .is('deleted_at', null)
    .maybeSingle()

  if (teacher && (await bcrypt.compare(password, teacher.password_hash))) {
    if (!teacher.is_active) {
      return { error: 'Akun guru ini sudah dinonaktifkan. Hubungi admin.' }
    }
    if (isContractExpired(teacher.contract_end)) {
      return { error: 'Masa kontrak akun ini sudah berakhir. Hubungi admin RQ.' }
    }
    await createTeacherSession({
      teacherId: teacher.id,
      username: teacher.username,
      fullName: teacher.full_name,
    })
    // Suasana tampilan tersimpan di akun ikut ke perangkat ini. Tidak pernah
    // melempar galat — login tidak boleh gagal karenanya.
    await muatSuasanaSaatLogin('teachers', teacher.id).catch(() => {})
    redirect('/guru')
  }

  // 3. Tidak cocok di keduanya
  return { error: 'Username atau password salah.' }
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
