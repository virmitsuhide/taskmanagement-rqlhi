import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  page: number
  pageSize: number
  total: number
  basePath: string
  searchParams?: Record<string, string | undefined>
  className?: string
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) params.set(k, v)
  }
  if (page > 1) params.set('page', String(page))
  else params.delete('page')
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function getPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages: (number | 'ellipsis')[] = [1]
  if (current > 3) pages.push('ellipsis')

  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams = {},
  className,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)
  const prevHref = buildHref(basePath, searchParams, Math.max(1, page - 1))
  const nextHref = buildHref(basePath, searchParams, Math.min(totalPages, page + 1))

  return (
    <nav className={cn('flex items-center justify-between gap-3 pt-4', className)} aria-label="Pagination">
      <p className="text-xs text-muted-foreground">
        Halaman <span className="font-medium text-foreground">{page}</span> dari {totalPages} ·{' '}
        <span className="font-medium text-foreground">{total}</span> total
      </p>
      <div className="flex items-center gap-1">
        <PageLink
          href={prevHref}
          disabled={page <= 1}
          ariaLabel="Halaman sebelumnya"
          icon
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageLink>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
          ) : (
            <PageLink
              key={p}
              href={buildHref(basePath, searchParams, p)}
              active={p === page}
              ariaLabel={`Halaman ${p}`}
            >
              {p}
            </PageLink>
          )
        )}

        <PageLink
          href={nextHref}
          disabled={page >= totalPages}
          ariaLabel="Halaman berikutnya"
          icon
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({
  href,
  active,
  disabled,
  ariaLabel,
  icon,
  children,
}: {
  href: string
  active?: boolean
  disabled?: boolean
  ariaLabel: string
  icon?: boolean
  children: React.ReactNode
}) {
  const base = `inline-flex items-center justify-center text-xs font-medium rounded-md border transition-colors ${
    icon ? 'h-8 w-8' : 'h-8 min-w-[32px] px-2'
  }`
  const styles = active
    ? 'bg-primary text-primary-foreground border-primary'
    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'

  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={ariaLabel}
        className={`${base} bg-muted/40 text-muted-foreground/40 cursor-not-allowed`}
      >
        {children}
      </span>
    )
  }
  return (
    <Link href={href} aria-label={ariaLabel} aria-current={active ? 'page' : undefined} className={`${base} ${styles}`}>
      {children}
    </Link>
  )
}
