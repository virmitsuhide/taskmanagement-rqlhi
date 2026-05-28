import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Route admin (pakai cookie rqlhi-session, role-based)
const ADMIN_PREFIXES = [
  '/dashboard',
  '/rapat',
  '/tasks',
  '/humas-request',
  '/home-post',
  '/notes',
  '/profil',
  '/halaqoh',
  '/siswa',
  '/ustadz',
]

// Route guru (pakai cookie rqlhi-teacher-session)
// /guru/login dikecualikan dari guard.
const TEACHER_PREFIX = '/guru'
const TEACHER_PUBLIC = ['/guru/login']

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

async function verifyToken(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Teacher routes ─────────────────────────────────────────────
  if (pathname.startsWith(TEACHER_PREFIX)) {
    // Public teacher routes (login)
    if (TEACHER_PUBLIC.includes(pathname)) return NextResponse.next()

    const token = request.cookies.get('rqlhi-teacher-session')?.value
    const payload = await verifyToken(token)
    if (!payload || payload.type !== 'teacher') {
      const response = NextResponse.redirect(new URL('/guru/login', request.url))
      response.cookies.delete('rqlhi-teacher-session')
      return response
    }
    return NextResponse.next()
  }

  // ── Admin routes ───────────────────────────────────────────────
  const isAdminProtected = ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  if (!isAdminProtected) return NextResponse.next()

  const token = request.cookies.get('rqlhi-session')?.value
  const payload = await verifyToken(token)
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('rqlhi-session')
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/rapat/:path*',
    '/tasks/:path*',
    '/humas-request/:path*',
    '/home-post/:path*',
    '/notes/:path*',
    '/profil/:path*',
    '/halaqoh/:path*',
    '/siswa/:path*',
    '/ustadz/:path*',
    '/guru/:path*',
  ],
}
