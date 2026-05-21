import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { UserRole } from '@/types'
import { BackButton } from './BackButton'

interface Props {
  displayName: string
  role: UserRole
  title?: string
  showBack?: boolean
}

export function DashboardHeader({ displayName, role, title, showBack }: Props) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
      {showBack && (
        <div className="shrink-0">
          <BackButton />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
      </div>
      <div className="flex items-center gap-3 text-sm shrink-0">
        <span className="hidden sm:block text-muted-foreground">{displayName}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {ROLE_LABELS[role]}
        </span>
      </div>
    </header>
  )
}
