'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, CheckSquare, BookOpen,
  ImageIcon, Megaphone, FileText, User, LogOut, GraduationCap, Newspaper, LayoutGrid,
  Users, UserCog, BookMarked,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_LABELS, getAccessibleDashboards, DEFAULT_DASHBOARD,
  canAccessNotes, canPostToHome, canRequestToHumas, canCreateNews,
  canViewStudents, canViewHalaqoh, canViewTeachers,
} from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { logoutAction } from '@/app/actions/auth'

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

interface Props {
  role: UserRole
  displayName: string
  username: string
}

export function MobileNav({ role, displayName, username }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const dashboards = getAccessibleDashboards(role)
  const defaultDashboard = DEFAULT_DASHBOARD[role]

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  const navLinkClass = (href: string) => cn(
    'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
    isActive(href)
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
  )

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div className={cn(
        'fixed top-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">RQ</div>
            <div>
              <p className="text-sm font-semibold leading-none">RQ LHI</p>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">Sistem Manajemen</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-sidebar-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Dashboard</p>
            <ul className="space-y-1">
              {dashboards.map(slug => (
                <li key={slug}>
                  <Link href={`/dashboard/${slug}`} onClick={() => setOpen(false)} className={navLinkClass(`/dashboard/${slug}`)}>
                    {DASHBOARD_ICONS[slug]}
                    {DASHBOARD_LABELS[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Fitur</p>
            <ul className="space-y-1">
              <li><Link href="/program" onClick={() => setOpen(false)} className={navLinkClass('/program')}><LayoutGrid className="h-4 w-4" />Program RQ</Link></li>
              <li><Link href="/rapat" onClick={() => setOpen(false)} className={navLinkClass('/rapat')}><BookOpen className="h-4 w-4" />Rapat & Notulen</Link></li>
              <li><Link href="/tasks" onClick={() => setOpen(false)} className={navLinkClass('/tasks')}><CheckSquare className="h-4 w-4" />Task</Link></li>
              {canRequestToHumas(role) && (
                <li><Link href="/humas-request" onClick={() => setOpen(false)} className={navLinkClass('/humas-request')}><ImageIcon className="h-4 w-4" />Request Humas</Link></li>
              )}
              {canPostToHome(role) && (
                <li><Link href="/home-post" onClick={() => setOpen(false)} className={navLinkClass('/home-post')}><Megaphone className="h-4 w-4" />Home Publik</Link></li>
              )}
              {canCreateNews(role) && (
                <li><Link href="/news" onClick={() => setOpen(false)} className={navLinkClass('/news')}><Newspaper className="h-4 w-4" />Berita</Link></li>
              )}
              {canAccessNotes(role) && (
                <li><Link href="/notes" onClick={() => setOpen(false)} className={navLinkClass('/notes')}><FileText className="h-4 w-4" />Catatan Pribadi</Link></li>
              )}
            </ul>
          </div>

          {(canViewStudents(role) || canViewHalaqoh(role) || canViewTeachers(role)) && (
            <div>
              <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Tahsin &amp; Tahfidz</p>
              <ul className="space-y-1">
                {canViewHalaqoh(role) && (
                  <li><Link href="/halaqoh" onClick={() => setOpen(false)} className={navLinkClass('/halaqoh')}><BookMarked className="h-4 w-4" />Halaqoh</Link></li>
                )}
                {canViewStudents(role) && (
                  <li><Link href="/siswa" onClick={() => setOpen(false)} className={navLinkClass('/siswa')}><Users className="h-4 w-4" />Siswa</Link></li>
                )}
                {canViewTeachers(role) && (
                  <li><Link href="/ustadz" onClick={() => setOpen(false)} className={navLinkClass('/ustadz')}><UserCog className="h-4 w-4" />Ustadz / Guru</Link></li>
                )}
              </ul>
            </div>
          )}
        </nav>

        <div className="border-t px-3 py-3 space-y-1">
          <Link href="/profil" onClick={() => setOpen(false)} className={navLinkClass('/profil')}>
            <User className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">@{username}</p>
            </div>
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t bg-background px-2 md:hidden">
        <Link
          href={`/dashboard/${defaultDashboard}`}
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive(`/dashboard/${defaultDashboard}`) ? 'text-primary' : 'text-muted-foreground')}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>
        <Link
          href="/tasks"
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive('/tasks') ? 'text-primary' : 'text-muted-foreground')}
        >
          <CheckSquare className="h-5 w-5" />
          Task
        </Link>
        <Link
          href="/rapat"
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive('/rapat') ? 'text-primary' : 'text-muted-foreground')}
        >
          <BookOpen className="h-5 w-5" />
          Rapat
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-muted-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          Menu
        </button>
      </div>
    </>
  )
}
