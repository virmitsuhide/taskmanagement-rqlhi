import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/rapat',
  '/tasks',
  '/humas-request',
  '/home-post',
  '/notes',
  '/profil',
]

function getSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('rqlhi-session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('rqlhi-session')
    return response
  }
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
  ],
}
