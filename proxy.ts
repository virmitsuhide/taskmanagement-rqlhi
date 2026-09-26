import { NextResponse } from 'next/server'
import type { NextRequest, ProxyConfig } from 'next/server'
import { jwtVerify } from 'jose'

// Route admin (pakai cookie rqlhi-session, role-based)
const ADMIN_PREFIXES = [
  '/dashboard',
  '/rapat',
  '/tasks',
  '/humas-request',
  // Panel CMS Humas: /humas/beranda, /humas/berita
  '/humas',
  '/home-post',
  '/notes',
  '/profil',
  '/halaqoh',
  '/siswa',
  '/ustadz',
  // Hanya sisi pengurus modul ujian. /ujian dan /ujian/rekap sengaja tidak
  // masuk — keduanya halaman publik yang boleh dibuka tanpa login.
  '/ujian/kelola',
  '/ujian/ajukan',
  '/ujian/riwayat',
  '/ujian/penguji',
  // Sisi koordinator Ekstra. Pendaftaran orang tua ada di /daftar-ekstra (publik).
  '/ekstra',
]

/** Halaman publik yang kebetulan berawalan sama dengan route pengurus. */
const PUBLIK = ['/profil-guru']

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

export async function proxy(request: NextRequest) {
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
  // '/profil' juga mencocokkan '/profil-guru' — halaman publik daftar guru
  // (dan pintu booking ekstra). Dikecualikan tegas, bukan dengan mengubah
  // cara pencocokan semua awalan.
  const isAdminProtected = ADMIN_PREFIXES.some(p => pathname.startsWith(p)) && !PUBLIK.some(p => pathname === p || pathname.startsWith(`${p}/`))
  if (!isAdminProtected) return NextResponse.next()

  const token = request.cookies.get('rqlhi-session')?.value
  const payload = await verifyToken(token)
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('rqlhi-session')
    return response
  }

  // Akun admin bukan pengurus: di wilayah pengurus ia hanya boleh ke
  // berandanya sendiri dan profil. Pengurus, Akun, Karyawan berada di luar
  // ADMIN_PREFIXES dan dijaga halamannya masing-masing.
  if (payload.role === 'admin' && !BOLEH_ADMIN.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/dashboard/admin', request.url))
  }
  return NextResponse.next()
}

const BOLEH_ADMIN = ['/dashboard/admin', '/profil']

export const config: ProxyConfig = {
  matcher: [
    '/dashboard/:path*',
    '/rapat/:path*',
    '/tasks/:path*',
    '/humas-request/:path*',
    '/humas/:path*',
    '/home-post/:path*',
    '/notes/:path*',
    '/profil/:path*',
    '/halaqoh/:path*',
    '/siswa/:path*',
    '/ustadz/:path*',
    '/ujian/kelola/:path*',
    '/ujian/ajukan/:path*',
    '/ujian/riwayat/:path*',
    '/ujian/penguji/:path*',
    '/guru/:path*',
  ],
}
