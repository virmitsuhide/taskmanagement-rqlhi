'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, CheckSquare, ImageIcon,
  FileText, User, Megaphone, LogOut, ChevronRight, GraduationCap, Newspaper, LayoutGrid,
  Users, UserCog, BookMarked, BarChart3, LayoutTemplate, Info, Wallet, CalendarRange,
  ClipboardCheck, KeyRound, ScrollText, Repeat, IdCard, UsersRound, Briefcase, Stamp, Scale,
} from 'lucide-react'
import { DASHBOARD_LABELS, getAccessibleDashboards, ROLE_LABELS , canManageTeacherProfiles } from '@/lib/auth/permissions'
import {
  canViewTerms, canViewGukarRecap, canViewFinance, canViewFinanceNotes, canPostToHome, canViewHumasRequests, canCreateNews,
  canAccessProgramMenu, canEditAbout,
  canViewStudents, canViewHalaqoh, canViewTeachers, canViewAnalytics, canViewUnitAnalytics,
  canManageHomepage, canViewKpi, canManageAllAccounts, canManagePengurus, canManageEmployees, canViewUjian,
  canAccessKpiPublikasi, canViewKpiBanding,
} from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { logoutAction } from '@/app/actions/auth'
import { Logo } from '@/components/brand/Logo'

interface Props {
  role: UserRole
  displayName: string
  username: string
  /**
   * Hitungan yang menunggu di alur rapor KPI: rapor yang menanti tanda tangan
   * koordinator, dan banding yang menanti putusan. Dihitung di AppShell —
   * komponen ini client, dan navigasi yang mengambil datanya sendiri akan
   * menembak database dari peramban tiap kali menunya digambar.
   */
  lencanaKpi?: { publikasi: number; banding: number }
}

const DASHBOARD_ICONS: Record<string, React.ReactNode> = {
  manajemen: <LayoutDashboard className="h-4 w-4" />,
  kumik: <GraduationCap className="h-4 w-4" />,
  sdm: <User className="h-4 w-4" />,
  'koor-sd': <GraduationCap className="h-4 w-4" />,
  'koor-smp': <GraduationCap className="h-4 w-4" />,
  'koor-qulssd': <GraduationCap className="h-4 w-4" />,
  'koor-ekstra': <GraduationCap className="h-4 w-4" />,
  humas: <Megaphone className="h-4 w-4" />,
  'div-training': <BookOpen className="h-4 w-4" />,
  pribadi: <LayoutDashboard className="h-4 w-4" />,
}

export function Sidebar({ role, displayName, username, lencanaKpi }: Props) {
  const pathname = usePathname()
  const dashboards = getAccessibleDashboards(role)

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <Logo size={36} alt="" className="shadow-sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">RQ LHI</p>
          <p className="text-[11px] text-sidebar-foreground/60 mt-1 truncate">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Dashboard section */}
        <div>
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Dashboard
          </p>
          <ul className="space-y-1">
            {dashboards.map(slug => (
              <li key={slug}>
                <Link
                  href={`/dashboard/${slug}`}
                  aria-current={isActive(`/dashboard/${slug}`) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                    isActive(`/dashboard/${slug}`)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  {DASHBOARD_ICONS[slug]}
                  {DASHBOARD_LABELS[slug]}
                  {isActive(`/dashboard/${slug}`) && (
                    <ChevronRight className="ml-auto h-3 w-3" />
                  )}
                </Link>
              </li>
            ))}
            {canViewUnitAnalytics(role) && (
              <NavItem
                href={canViewAnalytics(role) ? '/dashboard/analitik' : '/dashboard/analitik/unit'}
                icon={<BarChart3 className="h-4 w-4" />}
                label="Analitik RQ"
                active={isActive('/dashboard/analitik')}
              />
            )}
            {/* Ditaruh menempel di bawah Analitik RQ: KPI adalah penilaian
                kinerja, sekelompok dengan angka-angka pemantauan — bukan dengan
                menu Tahsin & Tahfidz yang isinya pekerjaan harian. */}
            {canViewKpi(role) && (
              <NavItem
                href="/kpi"
                icon={<ClipboardCheck className="h-4 w-4" />}
                label="KPI Guru"
                // Dikecualikan dari dua anaknya yang punya menu sendiri —
                // idiom yang sama dengan /tasks terhadap /tasks/board.
                active={isActive('/kpi') && !pathname.startsWith('/kpi/publikasi') && !pathname.startsWith('/kpi/banding')}
              />
            )}
            {/*
              Dua menu turunan alur rapor. Sengaja berdiri sendiri, bukan
              disembunyikan di dalam halaman KPI: keduanya membawa lencana
              angka, dan pemberitahuan yang hanya terlihat setelah membuka
              halaman lain bukan pemberitahuan.
            */}
            {canAccessKpiPublikasi(role) && (
              <NavItem
                href="/kpi/publikasi"
                icon={<Stamp className="h-4 w-4" />}
                label="Publikasi Rapor"
                active={isActive('/kpi/publikasi')}
                badge={lencanaKpi?.publikasi}
              />
            )}
            {canViewKpiBanding(role) && (
              <NavItem
                href="/kpi/banding"
                icon={<Scale className="h-4 w-4" />}
                label="Banding KPI"
                active={isActive('/kpi/banding')}
                badge={lencanaKpi?.banding}
              />
            )}
          </ul>
        </div>

        {/* Fitur section */}
        <div>
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Fitur
          </p>
          <ul className="space-y-1">
            {canAccessProgramMenu(role) && (
              <NavItem href="/humas/program" icon={<LayoutGrid className="h-4 w-4" />} label="Program RQ" active={isActive('/humas/program') || isActive('/program')} />
            )}
            {canEditAbout(role) && (
              <NavItem href="/humas/tentang" icon={<Info className="h-4 w-4" />} label="Tentang RQ" active={isActive('/humas/tentang')} />
            )}
            <NavItem href="/rapat" icon={<BookOpen className="h-4 w-4" />} label="Rapat & Notulen" active={isActive('/rapat')} />
            {/* Menempel di bawah Rapat & Notulen: keduanya irama kerja yang
                berulang menurut kalender, bukan pekerjaan yang ditugaskan. */}
            <NavItem href="/tugas-rutin" icon={<Repeat className="h-4 w-4" />} label="Tugas Rutin" active={isActive('/tugas-rutin')} />
            <NavItem href="/tasks" icon={<CheckSquare className="h-4 w-4" />} label="Tugas" active={isActive('/tasks') && !pathname.startsWith('/tasks/board')} />
            <NavItem href="/tasks/board" icon={<LayoutGrid className="h-4 w-4" />} label="Papan Tugas" active={pathname.startsWith('/tasks/board')} />
            {canViewHumasRequests(role) && (
              <NavItem href="/humas-request" icon={<ImageIcon className="h-4 w-4" />} label="Request Humas" active={isActive('/humas-request')} />
            )}
            {canPostToHome(role) && (
              <NavItem href="/home-post" icon={<Megaphone className="h-4 w-4" />} label="Home Publik" active={isActive('/home-post')} />
            )}
            {/* Menyala juga saat menulis/menyunting di /news/… */}
            {canCreateNews(role) && (
              <NavItem href="/humas/berita" icon={<Newspaper className="h-4 w-4" />} label="Berita" active={isActive('/humas/berita') || isActive('/news')} />
            )}
            {canManageHomepage(role) && (
              <NavItem href="/humas/beranda" icon={<LayoutTemplate className="h-4 w-4" />} label="Kelola Beranda" active={isActive('/humas/beranda')} />
            )}
            {canViewFinance(role) && (
              <NavItem href="/keuangan" icon={<Wallet className="h-4 w-4" />} label="Keuangan" active={isActive('/keuangan')} />
            )}
            {canViewFinanceNotes(role) && (
              <NavItem href="/notes" icon={<FileText className="h-4 w-4" />} label="Catatan Keuangan" active={isActive('/notes')} />
            )}
          </ul>
        </div>

        {/* Tahsin & Tahfidz section */}
        {(canViewStudents(role) || canViewHalaqoh(role) || canViewTeachers(role) || canViewTerms(role) || canViewUjian(role)) && (
          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Tahsin &amp; Tahfidz
            </p>
            <ul className="space-y-1">
              {canViewTerms(role) && (
                <NavItem href="/tahun-ajaran" icon={<CalendarRange className="h-4 w-4" />} label="Tahun Ajaran" active={isActive('/tahun-ajaran')} />
              )}
              {canViewHalaqoh(role) && (
                <NavItem href="/halaqoh" icon={<BookMarked className="h-4 w-4" />} label="Halaqoh" active={isActive('/halaqoh')} />
              )}
              {canViewStudents(role) && (
                <NavItem href="/siswa" icon={<Users className="h-4 w-4" />} label="Siswa" active={isActive('/siswa')} />
              )}
              {canViewTeachers(role) && (
                <NavItem href="/ustadz" icon={<UserCog className="h-4 w-4" />} label="Ustadz / Guru" active={isActive('/ustadz') && !pathname.startsWith('/ustadz/profil')} />
              )}
              {/* Menempel di bawah daftar guru: keduanya bicara tentang orang
                  yang sama, hanya berbeda sisi — daftar untuk operasional,
                  profil untuk arsip kepegawaian. */}
              {canManageEmployees(role) && (
                <NavItem href="/karyawan" icon={<Briefcase className="h-4 w-4" />} label="Karyawan" active={isActive('/karyawan')} />
              )}
              {canManageTeacherProfiles(role) && (
                <NavItem href="/ustadz/profil" icon={<IdCard className="h-4 w-4" />} label="Profil Guru" active={pathname.startsWith('/ustadz/profil')} />
              )}
              {canViewUjian(role) && (
                <NavItem href="/ujian/kelola" icon={<ScrollText className="h-4 w-4" />} label="Pengajuan Ujian" active={isActive('/ujian')} />
              )}
              {canViewGukarRecap(role) && (
                <NavItem
                  href="/dashboard/analitik/gukar"
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Analitik Gukar"
                  active={isActive('/dashboard/analitik/gukar')}
                />
              )}
            </ul>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t px-3 py-3 space-y-1">
        {canManagePengurus(role) && (
          <NavItem href="/pengurus" icon={<UsersRound className="h-4 w-4" />} label="Pengurus" active={isActive('/pengurus')} />
        )}
        {canManageAllAccounts(role) && (
          <NavItem href="/akun" icon={<KeyRound className="h-4 w-4" />} label="Akun & Password" active={isActive('/akun')} />
        )}
        <Link
          href="/profil"
          aria-current={isActive('/profil') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
            isActive('/profil')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <User className="h-4 w-4" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">@{username}</p>
          </div>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavItem({
  href, icon, label, active, badge,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
  /** Jumlah yang menunggu. 0/undefined = tanpa lencana sama sekali. */
  badge?: number
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {icon}
        {label}
        {badge ? (
          <span className="ml-auto min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-primary-foreground">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : active ? (
          <ChevronRight className="ml-auto h-3 w-3" />
        ) : null}
      </Link>
    </li>
  )
}
