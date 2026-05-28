'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, CheckSquare, ImageIcon,
  FileText, User, Megaphone, LogOut, ChevronRight, GraduationCap, Newspaper, LayoutGrid,
  Users, UserCog, BookMarked,
} from 'lucide-react'
import { DASHBOARD_LABELS, getAccessibleDashboards, ROLE_LABELS } from '@/lib/auth/permissions'
import {
  canAccessNotes, canPostToHome, canRequestToHumas, canCreateNews,
  canViewStudents, canViewHalaqoh, canViewTeachers,
} from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { logoutAction } from '@/app/actions/auth'

interface Props {
  role: UserRole
  displayName: string
  username: string
}

const DASHBOARD_ICONS: Record<string, React.ReactNode> = {
  manajemen: <LayoutDashboard className="h-4 w-4" />,
  kumik: <GraduationCap className="h-4 w-4" />,
  sdm: <User className="h-4 w-4" />,
  'koor-sd': <GraduationCap className="h-4 w-4" />,
  'koor-smp': <GraduationCap className="h-4 w-4" />,
  'koor-ekstra': <GraduationCap className="h-4 w-4" />,
  humas: <Megaphone className="h-4 w-4" />,
  'div-training': <BookOpen className="h-4 w-4" />,
}

export function Sidebar({ role, displayName, username }: Props) {
  const pathname = usePathname()
  const dashboards = getAccessibleDashboards(role)

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground text-sm font-bold shadow-sm">
          RQ
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">RQ LHI</p>
          <p className="text-[11px] text-sidebar-foreground/60 mt-1 truncate">{ROLE_LABELS[role]}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
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
          </ul>
        </div>

        {/* Fitur section */}
        <div>
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Fitur
          </p>
          <ul className="space-y-1">
            <NavItem href="/program" icon={<LayoutGrid className="h-4 w-4" />} label="Program RQ" active={isActive('/program')} />
            <NavItem href="/rapat" icon={<BookOpen className="h-4 w-4" />} label="Rapat & Notulen" active={isActive('/rapat')} />
            <NavItem href="/tasks" icon={<CheckSquare className="h-4 w-4" />} label="Task" active={isActive('/tasks')} />
            {canRequestToHumas(role) && (
              <NavItem href="/humas-request" icon={<ImageIcon className="h-4 w-4" />} label="Request Humas" active={isActive('/humas-request')} />
            )}
            {canPostToHome(role) && (
              <NavItem href="/home-post" icon={<Megaphone className="h-4 w-4" />} label="Home Publik" active={isActive('/home-post')} />
            )}
            {canCreateNews(role) && (
              <NavItem href="/news" icon={<Newspaper className="h-4 w-4" />} label="Berita" active={isActive('/news')} />
            )}
            {canAccessNotes(role) && (
              <NavItem href="/notes" icon={<FileText className="h-4 w-4" />} label="Catatan Pribadi" active={isActive('/notes')} />
            )}
          </ul>
        </div>

        {/* Tahsin & Tahfidz section */}
        {(canViewStudents(role) || canViewHalaqoh(role) || canViewTeachers(role)) && (
          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Tahsin &amp; Tahfidz
            </p>
            <ul className="space-y-1">
              {canViewHalaqoh(role) && (
                <NavItem href="/halaqoh" icon={<BookMarked className="h-4 w-4" />} label="Halaqoh" active={isActive('/halaqoh')} />
              )}
              {canViewStudents(role) && (
                <NavItem href="/siswa" icon={<Users className="h-4 w-4" />} label="Siswa" active={isActive('/siswa')} />
              )}
              {canViewTeachers(role) && (
                <NavItem href="/ustadz" icon={<UserCog className="h-4 w-4" />} label="Ustadz / Guru" active={isActive('/ustadz')} />
              )}
            </ul>
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t px-3 py-3 space-y-1">
        <Link
          href="/profil"
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
  href, icon, label, active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {icon}
        {label}
        {active && <ChevronRight className="ml-auto h-3 w-3" />}
      </Link>
    </li>
  )
}
