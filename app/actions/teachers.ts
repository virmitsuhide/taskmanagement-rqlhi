'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'

function generatePassword(): string {
  // Format: Guru@<3 huruf random><4 digit random>
  const letters = 'abcdefghijkmnpqrstuvwxyz'  // hapus l, o yang mirip 1/0
  const digits = '23456789'                    // hapus 0, 1 yang mirip O, l
  let pwd = 'Guru@'
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)]
  return pwd
}

export async function createTeacherAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin untuk mengelola akun guru.' }
  }

  const username = ((formData.get('username') as string) || '').trim().toLowerCase()
  const full_name = ((formData.get('full_name') as string) || '').trim()
  const nip = ((formData.get('nip') as string) || '').trim() || null
  const email = ((formData.get('email') as string) || '').trim() || null
  const phone = ((formData.get('phone') as string) || '').trim() || null
  const customPassword = ((formData.get('password') as string) || '').trim()

  if (!username || !full_name) {
    return { error: 'Username dan nama lengkap wajib diisi.' }
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { error: 'Username hanya huruf kecil, angka, dan underscore.' }
  }

  const password = customPassword || generatePassword()
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  const password_hash = await bcrypt.hash(password, 10)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('teachers')
    .insert({ username, password_hash, full_name, nip, email, phone })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return { error: 'Username sudah dipakai.' }
    }
    return { error: 'Gagal membuat akun guru.' }
  }

  revalidatePath('/ustadz')
  // Pass generated password via query param supaya admin bisa copy
  redirect(`/ustadz/${data.id}?new_password=${encodeURIComponent(password)}`)
}

export async function updateTeacherAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  const id = formData.get('id') as string
  const full_name = ((formData.get('full_name') as string) || '').trim()
  const nip = ((formData.get('nip') as string) || '').trim() || null
  const email = ((formData.get('email') as string) || '').trim() || null
  const phone = ((formData.get('phone') as string) || '').trim() || null
  const is_active = formData.get('is_active') === 'on'

  if (!id || !full_name) return { error: 'Data tidak lengkap.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ full_name, nip, email, phone, is_active })
    .eq('id', id)
  if (error) return { error: 'Gagal memperbarui guru.' }

  revalidatePath('/ustadz')
  revalidatePath(`/ustadz/${id}`)
  redirect(`/ustadz/${id}`)
}

export async function resetTeacherPasswordAction(id: string) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  const password = generatePassword()
  const password_hash = await bcrypt.hash(password, 10)

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ password_hash })
    .eq('id', id)
  if (error) return { error: 'Gagal reset password.' }

  revalidatePath(`/ustadz/${id}`)
  redirect(`/ustadz/${id}?new_password=${encodeURIComponent(password)}`)
}
