import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'

interface Props {
  displayName: string
  role: UserRole
  title?: string
}

export function DashboardHeader({ displayName, role, title }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex-1">
        {title && <h1 className="text-base font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden sm:block text-muted-foreground">
          {displayName}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {ROLE_LABELS[role]}
        </span>
      </div>
    </header>
  )
}
