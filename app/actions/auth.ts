'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { createSession, destroySession } from '@/lib/auth/session'
import { DEFAULT_DASHBOARD } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'

export async function loginAction(_: unknown, formData: FormData) {
  const username = (formData.get('username') as string)?.trim()
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi.' }
  }

  const supabase = createServerClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password_hash, role, display_name')
    .eq('username', username)
    .single()

  if (error || !user) {
    return { error: 'Username atau password salah.' }
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return { error: 'Username atau password salah.' }
  }

  await createSession({
    userId: user.id,
    username: user.username,
    role: user.role as UserRole,
    displayName: user.display_name,
  })

  redirect(`/dashboard/${DEFAULT_DASHBOARD[user.role as UserRole]}`)
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
