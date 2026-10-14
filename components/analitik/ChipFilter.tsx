import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface Chip { label: string; href: string; active: boolean; count?: number }

/**
 * Deretan chip filter berupa tautan (query string) — dirender di server,
 * bisa dibagikan lewat URL. Di HP digeser mendatar.
 */
export function ChipFilter({ label, chips, className }: { label: string; chips: Chip[]; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div role="group" aria-label={label} className={cn('flex shrink-0 items-center gap-1.5', className)}>
      {chips.map(c => (
        <Link key={c.href + c.label} href={c.href} scroll={false} aria-current={c.active ? 'true' : undefined}
          className={cn(
            'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
            c.active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:border-primary/40',
          )}>
          {c.label}
          {c.count !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{c.count.toLocaleString('id-ID')}</span>}
        </Link>
      ))}
    </div>
  )
}

/** Label kecil berwarna untuk penanda (Laju turun, Drill lama, Siap diuji, …). */
export function Lencana({ nada, children }: { nada: 'destructive' | 'warning' | 'info' | 'success' | 'muted'; children: React.ReactNode }) {
  const kelas = {
    destructive: 'bg-destructive-wash text-destructive',
    warning: 'bg-accent-warm-wash text-accent-warm',
    info: 'bg-info-wash text-info',
    success: 'bg-success-wash text-success',
    muted: 'bg-muted text-muted-foreground',
  }[nada]
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold', kelas)}>{children}</span>
}
