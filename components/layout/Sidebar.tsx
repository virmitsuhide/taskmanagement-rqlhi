'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, CheckSquare, ImageIcon,
  FileText, User, Megaphone, LogOut, ChevronRight, GraduationCap, Newspaper, LayoutGrid,
  Users, UserCog, BookMarked, BarChart3, LayoutTemplate, Info, Wallet, CalendarRange, CalendarDays,
  ClipboardCheck, KeyRound, ScrollText, Repeat, IdCard, UsersRound, Briefcase, Stamp, Scale, ListChecks, Kanban,
  PanelLeftClose, PanelLeftOpen, CalendarHeart, Lock,
} from 'lucide-react'
import { DASHBOARD_LABELS, getAccessibleDashboards, ROLE_LABELS , canManageTeacherProfiles } from '@/lib/auth/permissions'
import {
  canViewTerms, canViewGukarRecap, canViewFinance, canViewFinanceNotes, canPostToHome, canViewHumasRequests, canCreateNews,
  canAccessProgramMenu, canEditAbout,
  canViewStudents, canViewHalaqoh, canViewTeachers, canViewUnitAnalytics,
  canManageHomepage, canViewKpi, canManageAllAccounts, canManagePengurus, canManageEmployees, canViewUjian,
  canAccessKpiPublikasi, canManageRaporTemplate, canManageRiyadhoh, canManageEkstra, canManageKaldik, canViewKpiBanding, canViewTasks, canViewRoutineBoard,
  isAdmin,
} from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { logoutAction } from '@/app/actions/auth'
import { Logo } from '@/components/brand/Logo'
import {
  useSidebarCiut, SEMBUNYI_SAAT_CIUT, HILANG_SAAT_CIUT, TAUTAN_CIUT, LENCANA_CIUT,
} from './sidebar-ciut'

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
  /** Sidebar diciutkan jadi deretan ikon — dibaca AppShell dari cookie. */
  ciutAwal?: boolean
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

export function Sidebar({ role, displayName, username, lencanaKpi, ciutAwal = false }: Props) {
  const pathname = usePathname()
  const [ciut, gantiCiut] = useSidebarCiut(ciutAwal)
  const dashboards = getAccessibleDashboards(role)

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <aside
      data-ciut={ciut}
      className="group/sb flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 data-[ciut=true]:w-16"
    >
      {/* Logo / Brand — saat ciut logo & tombolnya bertumpuk */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4 group-data-[ciut=true]/sb:flex-col group-data-[ciut=true]/sb:px-2">
        <Logo size={36} alt="" className="shadow-sm" />
        <div className={cn('min-w-0', SEMBUNYI_SAAT_CIUT)}>
          <p className="font-heading text-[17px] font-semibold leading-none text-sidebar-accent-foreground">RQ LHI</p>
          <p className="text-[11px] text-sidebar-foreground/60 mt-1 truncate">{ROLE_LABELS[role]}</p>
        </div>
        <button
          type="button"
          onClick={gantiCiut}
          aria-label={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
          aria-expanded={!ciut}
          title={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
          className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[ciut=true]/sb:ml-0"
        >
          {ciut ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-6 group-data-[ciut=true]/sb:px-2 group-data-[ciut=true]/sb:[scrollbar-width:none]">
        {isAdmin(role) ? (
          // Admin bukan pengurus: tanpa dashboard jabatan, rapat, tugas, maupun
          // modul tahsin/tahfidz — hanya tiga pengelolaan ini.
          <div>
            <p className={cn('px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50', SEMBUNYI_SAAT_CIUT)}>
              Admin
            </p>
            <ul className="space-y-1">
              <NavItem href="/dashboard/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Beranda Admin" active={isActive('/dashboard/admin')} />
              <NavItem href="/pengurus" icon={<UsersRound className="h-4 w-4" />} label="Pengurus" active={isActive('/pengurus')} />
              <NavItem href="/akun" icon={<KeyRound className="h-4 w-4" />} label="Akun & Password" active={isActive('/akun')} />
              <NavItem href="/karyawan" icon={<Briefcase className="h-4 w-4" />} label="Karyawan" active={isActive('/karyawan')} />
              <NavItem href="/profil#ganti-password" icon={<Lock className="h-4 w-4" />} label="Ganti Password" active={isActive('/profil')} />
            </ul>
          </div>
        ) : (<>
        {/* Dashboard section */}
        <div>
          <p className={cn('px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50', SEMBUNYI_SAAT_CIUT)}>
            Dashboard
          </p>
          <ul className="space-y-1">
            {dashboards.map(slug => (
              <li key={slug}>
                <Link
                  href={`/dashboard/${slug}`}
                  title={DASHBOARD_LABELS[slug]}
                  aria-current={isActive(`/dashboard/${slug}`) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors', TAUTAN_CIUT,
                    isActive(`/dashboard/${slug}`)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  {DASHBOARD_ICONS[slug]}
                  <span className={cn('truncate', SEMBUNYI_SAAT_CIUT)}>{DASHBOARD_LABELS[slug]}</span>
                  {isActive(`/dashboard/${slug}`) && (
                    <ChevronRight className={cn('ml-auto h-3 w-3', HILANG_SAAT_CIUT)} />
                  )}
                </Link>
              </li>
            ))}
            {canViewUnitAnalytics(role) && (
              <NavItem
                href="/dashboard/analitik"
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
                href="/kpi/analisis"
                icon={<BarChart3 className="h-4 w-4" />}
                label="Analisis KPI Guru"
                active={pathname.startsWith('/kpi/analisis')}
              />
            )}
            {canViewKpi(role) && (
              <NavItem
                href="/kpi"
                icon={<ClipboardCheck className="h-4 w-4" />}
                label="Buat KPI"
                // Dikecualikan dari dua anaknya yang punya menu sendiri —
                // idiom yang sama dengan /tasks terhadap /tasks/board.
                active={isActive('/kpi') && !pathname.startsWith('/kpi/publikasi') && !pathname.startsWith('/kpi/banding') && !pathname.startsWith('/kpi/analisis')}
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
          <p className={cn('px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50', SEMBUNYI_SAAT_CIUT)}>
            Fitur
          </p>
          <ul className="space-y-1">
            {canAccessProgramMenu(role) && (
              <NavItem href="/humas/program" icon={<LayoutGrid className="h-4 w-4" />} label="Program RQ" active={isActive('/humas/program') || isActive('/program')} />
            )}
            {canEditAbout(role) && (
              <NavItem href="/humas/tentang" icon={<Info className="h-4 w-4" />} label="Tentang RQ" active={isActive('/humas/tentang')} />
            )}
            <NavItem href="/rapat" icon={<BookOpen className="h-4 w-4" />} label="Rapat & Notulen" active={isActive('/rapat') && !pathname.startsWith('/rapat/papan')} />
            <NavItem href="/rapat/papan" icon={<Kanban className="h-4 w-4" />} label="Papan Rapat" active={pathname.startsWith('/rapat/papan')} />
            {/* Menempel di bawah Rapat & Notulen: keduanya irama kerja yang
                berulang menurut kalender, bukan pekerjaan yang ditugaskan. */}
            {canViewTasks(role) && (
              <>
                <NavItem href="/tugas-rutin" icon={<Repeat className="h-4 w-4" />} label="Tugas Rutin" active={isActive('/tugas-rutin') && !pathname.startsWith('/tugas-rutin/papan')} />
                {canViewRoutineBoard(role) && (
                  <NavItem href="/tugas-rutin/papan" icon={<ListChecks className="h-4 w-4" />} label="Papan Rutin" active={pathname.startsWith("/tugas-rutin/papan")} />
                )}
                <NavItem href="/tasks" icon={<CheckSquare className="h-4 w-4" />} label="Tugas" active={isActive('/tasks') && !pathname.startsWith('/tasks/board')} />
                <NavItem href="/tasks/board" icon={<LayoutGrid className="h-4 w-4" />} label="Papan Tugas" active={pathname.startsWith('/tasks/board')} />
              </>
            )}
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
        {(canViewStudents(role) || canViewHalaqoh(role) || canViewTeachers(role) || canViewTerms(role) || canViewUjian(role) || canManageEkstra(role)) && (
          <div>
            <p className={cn('px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50', SEMBUNYI_SAAT_CIUT)}>
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
              {/* Bentuk rapor adalah keputusan unit, bukan seorang guru —
                  karena itu template-nya di sini, bukan di portal guru. */}
              {canManageRaporTemplate(role) && (
                <NavItem href="/rapor-quran/template" icon={<LayoutTemplate className="h-4 w-4" />} label="Template Rapor" active={isActive('/rapor-quran')} />
              )}
              {canManageRiyadhoh(role) && (
                <NavItem href="/riyadhoh" icon={<CalendarHeart className="h-4 w-4" />} label="Riyadhoh Sabtu" active={isActive('/riyadhoh')} />
              )}
              {canManageEkstra(role) && (
                <NavItem href="/ekstra" icon={<CalendarHeart className="h-4 w-4" />} label="Ekstra & Booking" active={isActive('/ekstra')} />
              )}
              {/* Menempel di bawah template rapor: keduanya menetapkan isi
                  rapor seluruh angkatan — yang satu bentuknya, yang satu
                  penyebut kehadirannya. */}
              {canManageRaporTemplate(role) && (
                <NavItem href="/kalender-quran" icon={<CalendarRange className="h-4 w-4" />} label="Kalender Qur'an" active={isActive('/kalender-quran')} />
              )}
              {/* Kalender pendidikan — pindahan dari aplikasi kaldikrqlhi (0085).
                  Satu alamat: beranda publik dan Kalender Qur'an membaca agenda ini. */}
              {canManageKaldik(role) && (
                <NavItem href="/kalender" icon={<CalendarDays className="h-4 w-4" />} label="Kalender Pendidikan" active={isActive('/kalender') && !pathname.startsWith('/kalender-quran')} />
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
        </>)}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        {/* Admin sudah melihat keduanya di menu utama. */}
        {!isAdmin(role) && canManagePengurus(role) && (
          <NavItem href="/pengurus" icon={<UsersRound className="h-4 w-4" />} label="Pengurus" active={isActive('/pengurus')} />
        )}
        {!isAdmin(role) && canManageAllAccounts(role) && (
          <NavItem href="/akun" icon={<KeyRound className="h-4 w-4" />} label="Akun & Password" active={isActive('/akun')} />
        )}
        <Link
          href="/profil"
          title={`${displayName} — profil`}
          aria-current={isActive('/profil') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors', TAUTAN_CIUT,
            isActive('/profil')
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <User className="h-4 w-4" />
          <div className={cn('flex-1 min-w-0', SEMBUNYI_SAAT_CIUT)}>
            <p className="truncate font-medium">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">@{username}</p>
          </div>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Keluar"
            className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors', TAUTAN_CIUT)}
          >
            <LogOut className="h-4 w-4" />
            <span className={SEMBUNYI_SAAT_CIUT}>Keluar</span>
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
        title={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors', TAUTAN_CIUT,
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {icon}
        <span className={cn('truncate', SEMBUNYI_SAAT_CIUT)}>{label}</span>
        {badge ? (
          <span className={cn(LENCANA_CIUT, 'ml-auto min-w-[18px] rounded-full bg-accent-warm px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white')}>
            {badge > 9 ? '9+' : badge}
          </span>
        ) : active ? (
          <ChevronRight className={cn('ml-auto h-3 w-3', HILANG_SAAT_CIUT)} />
        ) : null}
      </Link>
    </li>
  )
}
