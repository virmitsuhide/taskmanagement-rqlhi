import Link from 'next/link'
import { ChevronRight, LayoutDashboard } from 'lucide-react'
import { ROLE_LABELS, DEFAULT_DASHBOARD } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { BackButton } from './BackButton'
import { ThemeToggle } from './ThemeToggle'

interface Crumb {
  label: string
  href?: string
}

interface Props {
  displayName: string
  role: UserRole
  title?: string
  showBack?: boolean
  breadcrumbs?: Crumb[]
}

export function DashboardHeader({ displayName, role, title, showBack, breadcrumbs }: Props) {
  const dashboardHref = `/dashboard/${DEFAULT_DASHBOARD[role]}`

  // Explicit breadcrumbs take priority; fall back to single crumb from title
  const crumbs: Crumb[] | null = breadcrumbs ?? (title ? [{ label: title }] : null)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 print:hidden">
      {/* Main row */}
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={dashboardHref}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          {showBack && <BackButton />}
        </div>
        <div className="flex-1 min-w-0 px-1">
          {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 text-sm pl-2 border-l h-6">
            <span className="text-muted-foreground">{displayName}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="sm:hidden">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {ROLE_LABELS[role]}
            </span>
          </div>
        </div>
      </div>

      {/* Breadcrumb row */}
      {crumbs && (
        <div className="flex items-center gap-0.5 px-4 md:px-6 py-1.5 bg-muted/30 text-xs text-muted-foreground overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={dashboardHref}
            className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
          >
            <LayoutDashboard className="h-3 w-3" />
            <span>Dashboard</span>
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-0.5 min-w-0">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground transition-colors truncate max-w-[180px] shrink-0"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium truncate max-w-[240px] shrink-0">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </header>
  )
}
