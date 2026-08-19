import { cache } from 'react'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { TeacherSessionData } from '@/types'
import { createServerClient } from '@/lib/supabase/server'
import { isContractExpired } from './contract'

const COOKIE_NAME = 'rqlhi-teacher-session'

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function createTeacherSession(data: Omit<TeacherSessionData, 'isLoggedIn' | 'type'>) {
  const token = await new SignJWT({ ...data, isLoggedIn: true, type: 'teacher' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

/**
 * Sesi guru untuk halaman & action di /guru.
 *
 * Selain memverifikasi JWT, fungsi ini memastikan akunnya masih berlaku di
 * database. Token-nya berumur 7 hari dan tidak menyimpan status apa pun di
 * dalamnya, jadi tanpa pemeriksaan ini guru yang baru dihapus atau
 * dinonaktifkan tetap bisa memakai sesi lamanya sampai seminggu ke depan —
 * termasuk untuk menyimpan setoran baru.
 *
 * Dibungkus `cache()` supaya satu request yang memanggilnya beberapa kali
 * (layout, halaman, lalu action) hanya sekali menyentuh database.
 */
export const getTeacherSession = cache(async (): Promise<TeacherSessionData | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  let data: TeacherSessionData
  try {
    const { payload } = await jwtVerify(token, getSecret())
    data = payload as unknown as TeacherSessionData
    if (data.type !== 'teacher') return null
  } catch {
    return null
  }

  try {
    const supabase = createServerClient()
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, contract_end')
      .eq('id', data.teacherId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (!teacher) return null

    // Kontrak guru OS berakhir tiap tahun ajaran. Aksesnya dicabut sendiri
    // lewat tanggal ini supaya tidak bergantung pada ada yang ingat
    // menonaktifkannya satu per satu. contract_end kosong = tanpa batas,
    // dipakai guru tetap yayasan.
    if (isContractExpired(teacher.contract_end as string | null)) return null
  } catch {
    // Database tak terjangkau: tolak sesinya. Guru akan diminta login ulang,
    // dan itu lebih baik daripada meloloskan akun yang mungkin sudah dicabut.
    return null
  }

  return data
})

export async function destroyTeacherSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export const TEACHER_COOKIE_NAME = COOKIE_NAME
