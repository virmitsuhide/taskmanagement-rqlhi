import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDivisiBoard, getBoardDivisions, ROLE_LABELS } from '@/lib/auth/permissions'
import { getBoardTasks, type BoardScope } from '@/lib/data/board'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KanbanBoard } from './KanbanBoard'
import { List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ scope?: string; divisi?: string }>
}

export default async function TaskBoardPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const canDivisi = canViewDivisiBoard(session.role)
  const scope: BoardScope = params.scope === 'divisi' && canDivisi ? 'divisi' : 'personal'

  const divisions = getBoardDivisions(session.role)
  const divisiFilter = (params.divisi && divisions.includes(params.divisi as UserRole))
    ? (params.divisi as UserRole)
    : null

  const columns = await getBoardTasks({ session, scope, divisi: divisiFilter })

  function scopeHref(s: BoardScope): string {
    return s === 'personal' ? '/tasks/board' : '/tasks/board?scope=divisi'
  }
  function divisiHref(d: UserRole | null): string {
    const p = new URLSearchParams()
    p.set('scope', 'divisi')
    if (d) p.set('divisi', d)
    return `/tasks/board?${p.toString()}`
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Papan Task" showBack />
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Papan Kanban</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tarik kartu antar kolom untuk ubah status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks"><List className="h-4 w-4 mr-1" />Tampilan List</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/tasks/baru"><Plus className="h-4 w-4 mr-1" />Buat Task</Link>
            </Button>
          </div>
        </div>

        {/* Scope toggle */}
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex p-0.5 rounded-lg bg-muted">
            <Link
              href={scopeHref('personal')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scope === 'personal' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Personal
            </Link>
            {canDivisi && (
              <Link
                href={scopeHref('divisi')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scope === 'divisi' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Divisi
              </Link>
            )}
          </div>
        </div>

        {/* Divisi filter chips (hanya di scope divisi & punya >1 divisi) */}
        {scope === 'divisi' && divisions.length > 1 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            <FilterChip href={divisiHref(null)} active={!divisiFilter}>Semua</FilterChip>
            {divisions.map(d => (
              <FilterChip key={d} href={divisiHref(d)} active={divisiFilter === d}>
                {ROLE_LABELS[d]}
              </FilterChip>
            ))}
          </div>
        )}

        <KanbanBoard columns={columns} />

        <p className="text-xs text-muted-foreground mt-4">
          💡 Di HP, ketuk kartu untuk buka detail &amp; ubah status di sana. Tarik-lepas optimal di desktop.
        </p>
      </div>
    </div>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:text-foreground border-border'
      }`}
    >
      {children}
    </Link>
  )
}
