import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDivisiBoard, getBoardDivisions, canAssignAnyTask, canViewTasks, ROLE_LABELS } from '@/lib/auth/permissions'
import { getBoardTasks, type BoardScope } from '@/lib/data/board'
import { getGanttPeople } from '@/lib/data/gantt'
import { getPetaDependensi, ringkasDependensi } from '@/lib/data/dependensi'
import { getTugasSprint } from '@/lib/data/sprint'
import { getRingkasKartu } from '@/lib/data/ringkas-kartu'
import { labelPeriode, periodeDari } from '@/lib/tasks/sprint'
import { today } from '@/lib/tasks/gantt'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { NewTaskMenu } from '@/components/tasks/NewTaskMenu'
import { GanttNavMenu } from '@/components/tasks/GanttNavMenu'
import { KanbanBoard } from './KanbanBoard'
import { LayoutGrid, List, Target } from 'lucide-react'
import type { UserRole } from '@/types'

interface PageProps {
  searchParams: Promise<{ scope?: string; divisi?: string; sprint?: string }>
}

export default async function TaskBoardPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Amanah BPA & BPI tidak melewati modul tugas; tanpa baris ini alamatnya
  // tetap terbuka walau menunya sudah disembunyikan.
  if (!canViewTasks(session.role)) redirect('/rapat')

  const params = await searchParams
  const canDivisi = canViewDivisiBoard(session.role)
  const scope: BoardScope = params.scope === 'divisi' && canDivisi ? 'divisi' : 'personal'

  const divisions = getBoardDivisions(session.role)
  const divisiFilter = (params.divisi && divisions.includes(params.divisi as UserRole))
    ? (params.divisi as UserRole)
    : null

  // Papan dan Gantt memakai izin yang sama (getBoardDivisions), jadi daftar
  // orang untuk navigasi garis waktu bisa diambil berbarengan di sini.
  const hanyaSprint = params.sprint === '1'
  const periodeSprint = periodeDari(today())
  const [semuaKolom, ganttPeople, tugasSprint] = await Promise.all([
    getBoardTasks({ session, scope, divisi: divisiFilter }),
    getGanttPeople(session),
    getTugasSprint(periodeSprint),
  ])
  // Saringan sprint hanya menyempitkan kartu yang sudah boleh dilihat — tidak
  // pernah menambah kartu dari luar cakupan papan ini.
  const columns = hanyaSprint
    ? semuaKolom.map(c => ({ ...c, tasks: c.tasks.filter(t => tugasSprint.has(t.id)) }))
    : semuaKolom
  const idKartu = columns.flatMap(c => c.tasks.map(t => t.id))
  const [petaDependensi, ringkasKartu] = await Promise.all([
    getPetaDependensi(idKartu, session),
    getRingkasKartu(idKartu),
  ])
  const dependensi = ringkasDependensi(petaDependensi)

  function scopeHref(s: BoardScope): string {
    const p = new URLSearchParams()
    if (s === 'divisi') p.set('scope', 'divisi')
    if (hanyaSprint) p.set('sprint', '1')
    const qs = p.toString()
    return qs ? `/tasks/board?${qs}` : '/tasks/board'
  }
  function divisiHref(d: UserRole | null): string {
    const p = new URLSearchParams()
    p.set('scope', 'divisi')
    if (d) p.set('divisi', d)
    if (hanyaSprint) p.set('sprint', '1')
    return `/tasks/board?${p.toString()}`
  }
  function sprintHref(): string {
    const p = new URLSearchParams()
    if (scope === 'divisi') p.set('scope', 'divisi')
    if (divisiFilter) p.set('divisi', divisiFilter)
    if (!hanyaSprint) p.set('sprint', '1')
    const qs = p.toString()
    return qs ? `/tasks/board?${qs}` : '/tasks/board'
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Papan Tugas" showBack ownH1 />
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Tugas · {scope === 'divisi' ? (divisiFilter ? ROLE_LABELS[divisiFilter] : 'Seluruh divisi') : 'Pribadi'}
            </p>
            <h1 className="text-3xl leading-tight mt-1">
              {scope === 'divisi' ? 'Papan tugas seluruh divisi' : 'Papan tugas saya'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Tarik kartu antar kolom untuk mengubah status. Hanya pelaksana, pemberi tugas,
              dan Kepala RQ yang bisa memindahkan kartu.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-full border bg-card">
              <Link href="/tasks" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground">
                <List className="h-3.5 w-3.5" />Daftar
              </Link>
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold bg-primary text-primary-foreground" aria-current="page">
                <LayoutGrid className="h-3.5 w-3.5" />Papan
              </span>
              <Link href="/tasks/sprint" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground">
                <Target className="h-3.5 w-3.5" />Sprint
              </Link>
            </div>
            <GanttNavMenu people={ganttPeople} selfLabel={ROLE_LABELS[session.role]} />
            {/*
              Menu yang sama dengan tampilan list. Tautan polos ke /tasks/baru
              tidak cukup: halaman itu menolak role yang tidak boleh
              mendelegasi, jadi Humas & Bendahara terlempar balik ke /tasks
              tanpa penjelasan — padahal mereka tetap berhak membuat tugas
              untuk diri sendiri lewat ?personal=1.
            */}
            <NewTaskMenu canDelegate={canAssignAnyTask(session.role)} />
          </div>
        </div>

        {/* Scope toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex p-1 rounded-full bg-muted">
            <Link
              href={scopeHref('personal')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${scope === 'personal' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Personal
            </Link>
            {canDivisi && (
              <Link
                href={scopeHref('divisi')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${scope === 'divisi' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Divisi
              </Link>
            )}
          </div>
          <FilterChip href={sprintHref()} active={hanyaSprint}>
            Hanya sprint {labelPeriode(periodeSprint)}
          </FilterChip>
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

        <KanbanBoard columns={columns} currentUserId={session.userId} currentRole={session.role} dependensi={dependensi} ringkas={ringkasKartu} />

        <p className="text-xs text-muted-foreground mt-4 md:hidden">
          Di HP, ketuk kartu untuk buka detail &amp; ubah status di sana. Tarik-lepas optimal di desktop.
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
