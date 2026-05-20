'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession, createSession } from '@/lib/auth/session'

export async function updateEmailAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const email = (formData.get('email') as string)?.trim()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('users')
    .update({ email: email || null })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal memperbarui email.' }

  revalidatePath('/profil')
  return { success: true, message: 'Email berhasil diperbarui.' }
}

export async function changePasswordAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: user } = await supabase
    .from('users')
    .select('password_hash, can_change_password')
    .eq('id', session.userId)
    .single()

  if (!user) return { error: 'User tidak ditemukan.' }
  if (!user.can_change_password) return { error: 'Akun ini tidak dapat mengganti password.' }

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword !== confirmPassword) return { error: 'Konfirmasi password tidak cocok.' }
  if (newPassword.length < 8) return { error: 'Password minimal 8 karakter.' }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return { error: 'Password saat ini tidak benar.' }

  const hash = await bcrypt.hash(newPassword, 12)
  const { error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal mengganti password.' }

  return { success: true, message: 'Password berhasil diperbarui.' }
}
