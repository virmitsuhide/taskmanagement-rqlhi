import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { SessionData } from '@/types'

const COOKIE_NAME = 'rqlhi-session'

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function createSession(data: Omit<SessionData, 'isLoggedIn'>) {
  const token = await new SignJWT({ ...data, isLoggedIn: true })
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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionData
  } catch {
    return null
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
