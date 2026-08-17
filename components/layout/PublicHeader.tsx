import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/brand/Logo'
import { getSiteSettings } from '@/lib/data/site'
import { getSession } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { ROLE_LABELS, DEFAULT_DASHBOARD, sapaanName } from '@/lib/auth/permissions'
import { HeaderUserCard } from './HeaderUserCard'

interface NavItem {
  label: string
  href: string
  /** Submenu yang muncul saat item di-hover. Item induk tetap bisa diklik. */
  children?: { label: string; href: string; description: string }[]
}

const NAV: NavItem[] = [
  { label: 'Beranda', href: '/'        },
  { label: 'News',    href: '/news'    },
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
    .select('sapaan, nickname, photo_url')
    .eq('id', userId)
    .maybeSingle()
  return data as { sapaan: string | null; nickname: string | null; photo_url: string | null } | null
}

export async function PublicHeader() {
  const [settings, session] = await Promise.all([getSiteSettings(), getSession()])
  const profile = session ? await getHeaderProfile(session.userId).catch(() => null) : null

  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-5xl mx-auto flex h-[58px] items-center gap-7 px-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-auto shrink-0">
          <Logo size={38} alt="" priority className="shadow-sm" />
          <div className="leading-tight">
            <p className="font-bold text-[15px] tracking-[-0.3px]">{settings.header_brand}</p>
            <p className="text-[9px] uppercase tracking-[0.8px] text-muted-foreground">
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
            dashboardHref={`/dashboard/${DEFAULT_DASHBOARD[session.role]}`}
          />
        ) : (
          <Button asChild size="sm" className="shrink-0">
            <Link href="/login">
              Masuk <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        )}
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
