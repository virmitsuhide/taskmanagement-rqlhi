import { NextResponse } from 'next/server'
import type { NextRequest, ProxyConfig } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

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
  // Setoran sebulan per guru untuk koordinator (koreksi & hapus).
  '/setoran',
  // Halaqoh asrama boarding (0110) — Div Qur'an BPA/BPI.
  '/asrama',
  '/ustadz',
  // Hanya sisi pengurus modul ujian. /ujian dan /ujian/rekap sengaja tidak
  // masuk — keduanya halaman publik yang boleh dibuka tanpa login.
  '/ujian/kelola',
  '/ujian/ajukan',
  '/ujian/riwayat',
  '/ujian/penguji',
  // Laporan bulanan Kurikulum (Bab 02 BPH) — Kumik & Kepala RQ.
  '/laporan-kurikulum',
  // Target bulanan (0103) & kelola Panduan Guru (0104).
  '/target-bulanan',
  '/panduan-guru',
  // Pembaruan Sistem / changelog (0121).
  '/pembaruan',
  // Sisi koordinator Ekstra. Pendaftaran orang tua ada di /daftar-ekstra (publik).
  '/ekstra',
  // Tahsin Rekomendasi SDIT (0115) — Koor SD; analitik juga Kumik & Kepala RQ.
  '/tahsin-rekomendasi',
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

// ── Sesi bergeser ────────────────────────────────────────────────
//
// Token berumur 7 hari sejak DITERBITKAN. Dulu umur itu dihitung dari login
// saja, jadi guru yang membuka aplikasi setiap hari tetap terlempar ke halaman
// login tepat seminggu sesudahnya — sering di tengah mengisi setoran. Kini
// token diterbitkan ulang (paling sering sehari sekali) selama akunnya
// dipakai; sesi baru berakhir sesudah 7 hari TIDAK dibuka sama sekali.
const UMUR_SESI = 60 * 60 * 24 * 7
const PERBARUI_SESUDAH = 60 * 60 * 24

async function perpanjang(response: NextResponse, cookie: string, payload: Record<string, unknown>) {
  const iat = typeof payload.iat === 'number' ? payload.iat : 0
  if (Date.now() / 1000 - iat < PERBARUI_SESUDAH) return response
  const { iat: _i, exp: _e, ...isi } = payload
  void _i; void _e
  const token = await new SignJWT(isi)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
  response.cookies.set(cookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: UMUR_SESI,
    path: '/',
  })
  return response
}

/** Diteruskan ke halaman supaya /akses-ditolak bisa menyebut halaman asalnya. */
function lanjut(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

/**
 * Sesi tidak berlaku. Pemanggilan server action TIDAK dialihkan: dialihkan,
 * browser pindah ke halaman login dan isian formulir hilang. Diteruskan, action
 * itu sendiri menjawab "Sesi Anda sudah berakhir" — formulir tetap di layar
 * dan bisa dikirim ulang sesudah masuk lagi (lib/auth/pesan.ts).
 */
function tolakSesi(request: NextRequest, login: string, cookie: string, adaToken: boolean) {
  if (request.headers.has('next-action')) return NextResponse.next()
  const url = new URL(login, request.url)
  if (adaToken) url.searchParams.set('sesi', 'habis')
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  const response = NextResponse.redirect(url)
  response.cookies.delete(cookie)
  return response
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
      return tolakSesi(request, '/guru/login', 'rqlhi-teacher-session', Boolean(token))
    }
    return perpanjang(lanjut(request), 'rqlhi-teacher-session', payload)
  }

  // ── Admin routes ───────────────────────────────────────────────
  // '/profil' juga mencocokkan '/profil-guru' — halaman publik daftar guru
  // (dan pintu booking ekstra). Dikecualikan tegas, bukan dengan mengubah
  // cara pencocokan semua awalan.
  const isAdminProtected = ADMIN_PREFIXES.some(p => pathname.startsWith(p)) && !PUBLIK.some(p => pathname === p || pathname.startsWith(`${p}/`))
  if (!isAdminProtected) return NextResponse.next()

  const token = request.cookies.get('rqlhi-session')?.value
  const payload = await verifyToken(token)
  if (!payload) return tolakSesi(request, '/login', 'rqlhi-session', Boolean(token))

  // Akun admin bukan pengurus: di wilayah pengurus ia hanya boleh ke
  // berandanya sendiri dan profil. Pengurus, Akun, Karyawan berada di luar
  // ADMIN_PREFIXES dan dijaga halamannya masing-masing.
  if (payload.role === 'admin' && !BOLEH_ADMIN.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.redirect(new URL('/dashboard/admin', request.url))
  }
  return perpanjang(lanjut(request), 'rqlhi-session', payload)
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
    '/setoran/:path*',
    '/asrama/:path*',
    '/ustadz/:path*',
    '/ujian/kelola/:path*',
    '/ujian/ajukan/:path*',
    '/ujian/riwayat/:path*',
    '/ujian/penguji/:path*',
    '/laporan-kurikulum/:path*',
    '/target-bulanan/:path*',
    '/panduan-guru/:path*',
    '/pembaruan/:path*',
    '/guru/:path*',
  ],
}
