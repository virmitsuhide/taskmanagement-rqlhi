import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { ROLE_LABELS, DEFAULT_DASHBOARD } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { BackButton } from './BackButton'
import { ThemeToggle } from './ThemeToggle'

interface Props {
  displayName: string
  role: UserRole
  title?: string
  showBack?: boolean
}

export function DashboardHeader({ displayName, role, title, showBack }: Props) {
  const dashboardHref = `/dashboard/${DEFAULT_DASHBOARD[role]}`

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4 md:px-6 print:hidden">
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
    </header>
  )
}
