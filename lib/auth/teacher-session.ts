import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { TeacherSessionData } from '@/types'

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

export async function getTeacherSession(): Promise<TeacherSessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const data = payload as unknown as TeacherSessionData
    if (data.type !== 'teacher') return null
    return data
  } catch {
    return null
  }
}

export async function destroyTeacherSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export const TEACHER_COOKIE_NAME = COOKIE_NAME
