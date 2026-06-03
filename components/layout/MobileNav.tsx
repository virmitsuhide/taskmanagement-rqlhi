'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, CheckSquare, BookOpen,
  ImageIcon, Megaphone, FileText, User, LogOut, GraduationCap, Newspaper, LayoutGrid,
  Users, UserCog, BookMarked, BarChart3, Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_LABELS, getAccessibleDashboards, DEFAULT_DASHBOARD,
  canAccessNotes, canPostToHome, canRequestToHumas, canCreateNews,
  canViewStudents, canViewHalaqoh, canViewTeachers, canViewAnalytics,
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

const navLinkClass = (active: boolean) => cn(
  'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
  active
    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
)

function DrawerLink({ href, icon, label, active, onNavigate }: {
  href: string
  icon: ReactNode
  label: string
  active: boolean
  onNavigate: () => void
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={navLinkClass(active)}
      >
        {icon}
        {label}
      </Link>
    </li>
  )
}

export function MobileNav({ role, displayName, username }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const dashboards = getAccessibleDashboards(role)
  const defaultDashboard = DEFAULT_DASHBOARD[role]

  const drawerRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }
  const close = () => setOpen(false)

  // Accessible-dialog behaviour: focus into the drawer on open, trap Tab,
  // close on Escape, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return
    const trigger = menuBtnRef.current
    closeBtnRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Slide-in drawer */}
      <div
        ref={drawerRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">RQ</div>
            <div>
              <p className="text-sm font-semibold leading-none">RQ LHI</p>
              <p className="text-xs text-sidebar-foreground/60 mt-0.5">Sistem Manajemen</p>
            </div>
          </div>
          <button ref={closeBtnRef} onClick={close} aria-label="Tutup menu" className="rounded-md p-1 hover:bg-sidebar-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Dashboard</p>
            <ul className="space-y-1">
              {dashboards.map(slug => (
                <DrawerLink key={slug} href={`/dashboard/${slug}`} icon={DASHBOARD_ICONS[slug]} label={DASHBOARD_LABELS[slug]} active={isActive(`/dashboard/${slug}`)} onNavigate={close} />
              ))}
              {canViewAnalytics(role) && (
                <DrawerLink href="/dashboard/analitik" icon={<BarChart3 className="h-4 w-4" />} label="Analitik RQ" active={isActive('/dashboard/analitik')} onNavigate={close} />
              )}
            </ul>
          </div>

          <div>
            <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Fitur</p>
            <ul className="space-y-1">
              <DrawerLink href="/program" icon={<LayoutGrid className="h-4 w-4" />} label="Program RQ" active={isActive('/program')} onNavigate={close} />
              <DrawerLink href="/rapat" icon={<BookOpen className="h-4 w-4" />} label="Rapat & Notulen" active={isActive('/rapat')} onNavigate={close} />
              <DrawerLink href="/tasks" icon={<CheckSquare className="h-4 w-4" />} label="Tugas" active={isActive('/tasks')} onNavigate={close} />
              <DrawerLink href="/tasks/board" icon={<LayoutGrid className="h-4 w-4" />} label="Papan Tugas" active={isActive('/tasks/board')} onNavigate={close} />
              {canViewAnalytics(role) && (
                <DrawerLink href="/tasks/matrix" icon={<Table2 className="h-4 w-4" />} label="PR Manajemen" active={isActive('/tasks/matrix')} onNavigate={close} />
              )}
              {canRequestToHumas(role) && (
                <DrawerLink href="/humas-request" icon={<ImageIcon className="h-4 w-4" />} label="Request Humas" active={isActive('/humas-request')} onNavigate={close} />
              )}
              {canPostToHome(role) && (
                <DrawerLink href="/home-post" icon={<Megaphone className="h-4 w-4" />} label="Home Publik" active={isActive('/home-post')} onNavigate={close} />
              )}
              {canCreateNews(role) && (
                <DrawerLink href="/news" icon={<Newspaper className="h-4 w-4" />} label="Berita" active={isActive('/news')} onNavigate={close} />
              )}
              {canAccessNotes(role) && (
                <DrawerLink href="/notes" icon={<FileText className="h-4 w-4" />} label="Catatan Pribadi" active={isActive('/notes')} onNavigate={close} />
              )}
            </ul>
          </div>

          {(canViewStudents(role) || canViewHalaqoh(role) || canViewTeachers(role)) && (
            <div>
              <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Tahsin &amp; Tahfidz</p>
              <ul className="space-y-1">
                {canViewHalaqoh(role) && (
                  <DrawerLink href="/halaqoh" icon={<BookMarked className="h-4 w-4" />} label="Halaqoh" active={isActive('/halaqoh')} onNavigate={close} />
                )}
                {canViewStudents(role) && (
                  <DrawerLink href="/siswa" icon={<Users className="h-4 w-4" />} label="Siswa" active={isActive('/siswa')} onNavigate={close} />
                )}
                {canViewTeachers(role) && (
                  <DrawerLink href="/ustadz" icon={<UserCog className="h-4 w-4" />} label="Ustadz / Guru" active={isActive('/ustadz')} onNavigate={close} />
                )}
              </ul>
            </div>
          )}
        </nav>

        <div className="border-t px-3 py-3 space-y-1">
          <Link
            href="/profil"
            onClick={close}
            aria-current={isActive('/profil') ? 'page' : undefined}
            className={navLinkClass(isActive('/profil'))}
          >
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
      <nav aria-label="Navigasi bawah" className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t bg-background px-2 md:hidden">
        <Link
          href={`/dashboard/${defaultDashboard}`}
          aria-current={isActive(`/dashboard/${defaultDashboard}`) ? 'page' : undefined}
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive(`/dashboard/${defaultDashboard}`) ? 'text-primary' : 'text-muted-foreground')}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>
        <Link
          href="/tasks"
          aria-current={isActive('/tasks') ? 'page' : undefined}
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive('/tasks') ? 'text-primary' : 'text-muted-foreground')}
        >
          <CheckSquare className="h-5 w-5" />
          Task
        </Link>
        <Link
          href="/rapat"
          aria-current={isActive('/rapat') ? 'page' : undefined}
          className={cn('flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors', isActive('/rapat') ? 'text-primary' : 'text-muted-foreground')}
        >
          <BookOpen className="h-5 w-5" />
          Rapat
        </Link>
        <button
          ref={menuBtnRef}
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-drawer"
          aria-haspopup="dialog"
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs text-muted-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          Menu
        </button>
      </nav>
    </>
  )
}
