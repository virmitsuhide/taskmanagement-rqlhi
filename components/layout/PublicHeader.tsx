import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { getSiteSettings } from '@/lib/data/site'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { logoutTeacherAction } from '@/app/actions/teacher-auth'
import { createServerClient } from '@/lib/supabase/server'
import { ROLE_LABELS, DEFAULT_DASHBOARD, sapaanName } from '@/lib/auth/permissions'
import { HeaderUserCard } from './HeaderUserCard'
import { PublicMobileNav, type PublicNavItem } from './PublicMobileNav'
import type { PhotoFocus } from '@/types'

/** Submenu (children) muncul saat item di-hover di desktop; di HP langsung terlihat. */
type NavItem = PublicNavItem

const NAV: NavItem[] = [
  { label: 'Beranda', href: '/'        },
  { label: 'Berita',  href: '/news'    },
  { label: 'Program', href: '/program' },
  {
    label: 'Tentang RQ',
    href: '/tentang',
    children: [
      {
        label: 'Tentang RQ',
        href: '/tentang',
        description: 'Struktur organisasi, visi-misi, dan sejarah',
      },
      {
        label: 'Profil Guru',
        href: '/profil-guru',
        description: "Para pengajar Rumah Qur'an LHI",
      },
    ],
  },
  {
    label: 'Ujian',
    href: '/ujian',
    children: [
      {
        label: 'Antrian Ujian',
        href: '/ujian',
        description: 'Pengajuan yang menunggu jadwal & yang sudah dijadwalkan',
      },
      {
        label: 'Rekap Hasil',
        href: '/ujian/rekap',
        description: 'Hasil ujian tahsin & tahfidz yang sudah terlaksana',
      },
    ],
  },
]

const LINK_CLASS =
  'px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'

/**
 * Ambil bagian profil yang dipakai header. Dipisah dengan catch supaya beranda
 * tetap tampil kalau migrasi 0014 belum dijalankan (kolomnya belum ada).
 */
async function getHeaderProfile(userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('users')
    .select('sapaan, nickname, photo_url, photo_focus')
    .eq('id', userId)
    .maybeSingle()
  return data as {
    sapaan: string | null
    nickname: string | null
    photo_url: string | null
    photo_focus: PhotoFocus | null
  } | null
}

/**
 * Profil ringkas seorang guru untuk kartu di header.
 *
 * Tabel yang dibaca berbeda — guru tinggal di `teachers`, pengurus di `users`
 * — jadi tidak bisa memakai getHeaderProfile() yang sama.
 */
async function getTeacherHeaderProfile(teacherId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('teachers')
    .select('sapaan, nickname, full_name, photo_url, photo_focus')
    .eq('id', teacherId)
    .maybeSingle()
  return data as {
    sapaan: string | null
    nickname: string | null
    full_name: string
    photo_url: string | null
    photo_focus: PhotoFocus | null
  } | null
}

export async function PublicHeader() {
  /*
    DUA SESI, BUKAN SATU.

    Guru dan pengurus masuk lewat pintu yang berbeda dan memakai cookie yang
    berbeda. Header ini dulu hanya menanyakan getSession() — sesi pengurus —
    sehingga guru yang sudah masuk lalu membuka halaman publik (dari tautan
    pengumuman di dashboardnya, misalnya) disambut tombol "Masuk", seolah
    sesinya hilang.

    Sesi pengurus diperiksa lebih dulu karena ia yang punya menu lebih luas;
    keduanya bisa saja hidup bersamaan di satu peramban, dan kalau begitu yang
    ditampilkan adalah yang wewenangnya lebih besar.
  */
  const [settings, session, teacher] = await Promise.all([
    getSiteSettings(),
    getSession(),
    getTeacherSession().catch(() => null),
  ])
  const profile = session ? await getHeaderProfile(session.userId).catch(() => null) : null
  const teacherProfile = !session && teacher
    ? await getTeacherHeaderProfile(teacher.teacherId).catch(() => null)
    : null

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Jarak & tepi dirapatkan di HP: logo, kartu akun, dan tombol menu harus
          muat berdampingan di layar 360px. */}
      <div className="max-w-5xl mx-auto flex h-[58px] items-center gap-2.5 px-4 sm:gap-4 sm:px-6 md:gap-7">

        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 mr-auto">
          <Logo size={38} alt="" priority className="shrink-0 shadow-sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-bold text-[15px] tracking-[-0.3px]">{settings.header_brand}</p>
            <p className="truncate text-[9px] uppercase tracking-[0.8px] text-muted-foreground">
              {settings.header_tagline}
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(item =>
            item.children ? <NavDropdown key={item.label} item={item} /> : (
              <Link key={item.label} href={item.href} className={LINK_CLASS}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {session ? (
          <HeaderUserCard
            name={sapaanName(profile?.sapaan, profile?.nickname, session.displayName)}
            roleLabel={ROLE_LABELS[session.role]}
            photoUrl={profile?.photo_url ?? null}
            photoFocus={profile?.photo_focus ?? null}
            dashboardHref={`/dashboard/${DEFAULT_DASHBOARD[session.role]}`}
          />
        ) : teacher ? (
          <HeaderUserCard
            name={sapaanName(
              teacherProfile?.sapaan,
              teacherProfile?.nickname,
              teacherProfile?.full_name ?? teacher.fullName,
            )}
            roleLabel="Guru"
            photoUrl={teacherProfile?.photo_url ?? null}
            photoFocus={teacherProfile?.photo_focus ?? null}
            dashboardHref="/guru"
            dashboardLabel="Portal Guru"
            profileHref="/guru/profil"
            logout={logoutTeacherAction}
          />
        ) : (
          <Button asChild size="sm" className="shrink-0">
            <Link href="/login">
              Masuk <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        )}

        {/* Menu HP — daftar yang sama dengan baris tautan desktop di atas. */}
        <PublicMobileNav items={NAV} />
      </div>
    </header>
  )
}

/**
 * Dropdown murni CSS — dibuka lewat `group-hover` dan `group-focus-within`,
 * jadi komponen ini tetap server component dan tetap bisa dipakai dengan
 * keyboard (Tab) maupun tanpa JavaScript.
 *
 * Panelnya menempel di `top-full` dengan padding atas sebagai jembatan, supaya
 * kursor yang bergerak dari trigger ke isi menu tidak melewati celah kosong
 * yang akan menutup menu di tengah jalan.
 */
function NavDropdown({ item }: { item: NavItem }) {
  return (
    <div className="relative group">
      <Link href={item.href} className={`${LINK_CLASS} inline-flex items-center gap-1`}>
        {item.label}
        <ChevronDown
          className="h-3 w-3 transition-transform duration-150 group-hover:rotate-180"
          aria-hidden
        />
      </Link>

      <div
        className="
          absolute left-0 top-full pt-2 w-[268px]
          invisible opacity-0 translate-y-1 pointer-events-none
          transition-all duration-150
          group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto
          group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto
        "
      >
        <div className="rounded-xl border bg-popover text-popover-foreground shadow-lg p-1.5">
          {item.children?.map(child => (
            <Link
              key={child.href}
              href={child.href}
              className="block rounded-lg px-3 py-2.5 hover:bg-accent transition-colors"
            >
              <span className="block text-sm font-medium">{child.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                {child.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
