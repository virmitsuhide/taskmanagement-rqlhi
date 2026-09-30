import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask, canViewTasks, ROLE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { getGanttPeople } from '@/lib/data/gantt'
import { getCompletedTasksByWeek, type CompletedWeek } from '@/lib/data/tasks-extra'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { NewTaskMenu } from '@/components/tasks/NewTaskMenu'
import { GanttNavMenu } from '@/components/tasks/GanttNavMenu'
import { Button } from '@/components/ui/button'
import { CheckSquare, CheckCircle2, LayoutGrid } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { TaskRow, daysUntil } from './TaskRow'
import type { Task, TaskStatus } from '@/types'
import { tanggalWIB } from '@/lib/rq/ujian'

const PAGE_SIZE = 20

type Tab = 'active' | 'delegated' | 'done'

interface PageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>
}

const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'returned']

type Origin = 'pribadi_pendek' | 'pribadi_panjang' | 'follow_up' | 'penugasan'

const ORIGIN_LABELS: Record<Origin, string> = {
  pribadi_pendek: 'Pribadi · jangka pendek',
  pribadi_panjang: 'Pribadi · jangka panjang',
  follow_up: 'Dari follow up rapat',
  penugasan: 'Dari penugasan atasan/rekan',
}

/** Klasifikasi task aktif ke bucket asal. Mengembalikan key bucket. */
function bucketOf(task: Task, selfUserId: string): Origin {
  const isSelf = task.assigned_by === selfUserId
  if (task.source_type === 'rapat') return 'follow_up'
  if (isSelf) return task.horizon === 'panjang' ? 'pribadi_panjang' : 'pribadi_pendek'
  return 'penugasan'
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Amanah BPA & BPI tidak melewati modul tugas; tanpa baris ini alamatnya
  // tetap terbuka walau menunya sudah disembunyikan.
  if (!canViewTasks(session.role)) redirect('/rapat')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const activeTab: Tab = (params.tab === 'delegated' || params.tab === 'done') ? params.tab : 'active'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const supabase = createServerClient()

  // ── Aktif: ambil SEMUA task aktif (tidak paginate, karena di-grup ke bucket)
  // Pagination dipakai untuk tab "Selesai" & "Didelegasikan"
  let activeTasks: Task[] = []
  if (activeTab === 'active') {
    let q = supabase
      .from('tasks')
      .select('*, assigner:users!assigned_by(id, display_name, role)')
      .eq('assigned_to', session.userId)
      .is('deleted_at', null)
      .in('status', ACTIVE_STATUSES)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (query) q = q.ilike('title', `%${query}%`)
    const { data } = await q
    activeTasks = (data ?? []) as Task[]
  }

  // Done / Delegated paginated
  let listTasks: Task[] = []
  let totalForTab = 0
  if (activeTab !== 'active') {
    let listQuery, countQuery
    if (activeTab === 'delegated') {
      listQuery = supabase
        .from('tasks')
        .select('*, assignee:users!assigned_to(id, display_name, role)')
        .eq('assigned_by', session.userId)
        .neq('assigned_to', session.userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('assigned_by', session.userId).neq('assigned_to', session.userId)
        .is('deleted_at', null)
    } else {
      listQuery = supabase
        .from('tasks')
        .select('*, assigner:users!assigned_by(id, display_name, role)')
        .eq('assigned_to', session.userId)
        .eq('status', 'done')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('assigned_to', session.userId).eq('status', 'done')
        .is('deleted_at', null)
    }
    if (query) { listQuery = listQuery.ilike('title', `%${query}%`); countQuery = countQuery.ilike('title', `%${query}%`) }
    const { count } = await countQuery
    totalForTab = count ?? 0
    const totalPages = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const from = (safePage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data } = await listQuery.range(from, to)
    listTasks = (data ?? []) as Task[]
  }

  // ── Hitungan untuk badge stat & tab counts ─────────────────────
  // Semua penghitung wajib menyaring deleted_at: tanpa itu angka di badge
  // menghitung tugas yang sudah dihapus dan tidak cocok dengan isi daftarnya.
  const countTasks = () =>
    supabase.from('tasks').select('*', { count: 'exact', head: true }).is('deleted_at', null)

  const [activeCountRes, doneCountRes, delegatedCountRes, overdueRes] = await Promise.all([
    countTasks().eq('assigned_to', session.userId).in('status', ACTIVE_STATUSES),
    countTasks().eq('assigned_to', session.userId).eq('status', 'done'),
    countTasks().eq('assigned_by', session.userId).neq('assigned_to', session.userId),
    countTasks().eq('assigned_to', session.userId).in('status', ACTIVE_STATUSES)
      .lt('due_date', tanggalWIB(new Date())),
  ])

  const totalActive = activeCountRes.count ?? 0
  const totalDone = doneCountRes.count ?? 0
  const totalDelegated = delegatedCountRes.count ?? 0
  const overdueCount = overdueRes.count ?? 0
  const showDelegated = canAssignAnyTask(session.role)
  const [ganttPeople, completedWeeks] = await Promise.all([
    getGanttPeople(session),
    getCompletedTasksByWeek(session.userId),
  ])

  // ── Asal tugas (untuk kartu samping & baris keterangan) ────────
  const origins: Record<Origin, number> = { pribadi_pendek: 0, pribadi_panjang: 0, follow_up: 0, penugasan: 0 }
  for (const t of activeTasks) origins[bucketOf(t, session.userId)]++

  function sourceLine(t: Task): string {
    const o = bucketOf(t, session!.userId)
    if (o === 'follow_up') return t.assigner && t.assigned_by !== session!.userId ? `Follow up rapat · dari ${t.assigner.display_name}` : 'Follow up rapat'
    if (o === 'penugasan') return t.assigner ? `Penugasan ${t.assigner.display_name}` : 'Penugasan atasan/rekan'
    return ORIGIN_LABELS[o]
  }

  // ── Kelompokkan tugas aktif menurut tenggat ────────────────────
  const deadline = { overdue: [] as Task[], soon: [] as Task[], week: [] as Task[], later: [] as Task[] }
  for (const t of activeTasks) {
    const d = daysUntil(t.due_date)
    if (d === null || d > 7) deadline.later.push(t)
    else if (d < 0) deadline.overdue.push(t)
    else if (d <= 1) deadline.soon.push(t)
    else deadline.week.push(t)
  }
  const nearCount = deadline.overdue.length + deadline.soon.length + deadline.week.length

  function tabHref(tab: Tab): string {
    const p = new URLSearchParams()
    if (tab !== 'active') p.set('tab', tab)
    if (query) p.set('q', query)
    const qs = p.toString()
    return qs ? `/tasks?${qs}` : '/tasks'
  }

  const safePage = Math.min(page, Math.max(1, Math.ceil(totalForTab / PAGE_SIZE)))

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader displayName={session.displayName} role={session.role} title="Tugas" ownH1 />
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Kolaborasi · tugas saya</p>
            <h1 className="mt-1 max-w-3xl font-heading text-3xl leading-tight md:text-[34px]">
              {totalActive === 0 ? (
                <>Tidak ada tugas aktif — <i>saatnya beristirahat sejenak.</i></>
              ) : (
                <>
                  {totalActive} tugas aktif
                  {(overdueCount > 0 || (!query && activeTab === 'active' && deadline.soon.length > 0)) && (
                    <> — <i>
                      {overdueCount > 0 && `${overdueCount} lewat tenggat`}
                      {overdueCount > 0 && !query && activeTab === 'active' && deadline.soon.length > 0 && ', '}
                      {!query && activeTab === 'active' && deadline.soon.length > 0 && `${deadline.soon.length} jatuh tempo hari ini & besok`}.
                    </i></>
                  )}
                </>
              )}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks/board"><LayoutGrid className="mr-1 h-4 w-4" />Papan</Link>
            </Button>
            <GanttNavMenu people={ganttPeople} selfLabel={ROLE_LABELS[session.role]} />
            <NewTaskMenu canDelegate={canAssignAnyTask(session.role)} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
          <section className="flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-4 md:px-[22px] md:py-[18px] lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <nav aria-label="Jenis tugas" className="flex flex-wrap gap-1.5">
                <TabChip href={tabHref('active')} active={activeTab === 'active'} count={totalActive}>Aktif</TabChip>
                {showDelegated && (
                  <TabChip href={tabHref('delegated')} active={activeTab === 'delegated'} count={totalDelegated}>Saya delegasikan</TabChip>
                )}
                <TabChip href={tabHref('done')} active={activeTab === 'done'} count={totalDone}>Selesai</TabChip>
              </nav>
              <div className="w-full sm:ml-auto sm:w-64">
                <SearchInput placeholder="Cari tugas" />
              </div>
            </div>
            {query && (
              <p className="-mt-1 text-xs text-muted-foreground">
                Menampilkan hasil untuk <span className="font-medium">&ldquo;{query}&rdquo;</span>
              </p>
            )}

            {activeTab === 'active' ? (
              activeTasks.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title={query ? 'Tidak ada tugas aktif yang cocok' : 'Tidak ada tugas aktif'} subtitle={query ? 'Coba kata kunci lain.' : 'Saatnya beristirahat sejenak ☕'} />
              ) : (
                <div className="flex flex-col gap-4">
                  <DeadlineGroup title="Lewat tenggat" tone="danger" tasks={deadline.overdue} sourceLine={sourceLine} />
                  <DeadlineGroup title="Hari ini & besok" tone="warm" tasks={deadline.soon} sourceLine={sourceLine} />
                  <DeadlineGroup title="Pekan ini" tasks={deadline.week} sourceLine={sourceLine} />
                  {deadline.later.length > 0 && (
                    <details className="group/later" open={nearCount === 0}>
                      <summary className="flex cursor-pointer list-none flex-col [&::-webkit-details-marker]:hidden">
                        <GroupHeading title="Nanti" count={deadline.later.length} />
                        <span className="pl-9 pt-2 text-[12.5px] font-semibold text-primary group-open/later:hidden">
                          Tampilkan {deadline.later.length} tugas berikutnya &amp; tanpa tenggat
                        </span>
                      </summary>
                      <div className="flex flex-col">
                        {deadline.later.map(t => <TaskRow key={t.id} task={t} sourceLine={sourceLine(t)} />)}
                      </div>
                    </details>
                  )}
                </div>
              )
            ) : listTasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-8 w-8" />}
                title={activeTab === 'delegated' ? 'Belum ada tugas yang Anda delegasikan' : 'Belum ada tugas selesai'}
                subtitle={activeTab === 'delegated' ? "Klik 'Buat Tugas' → Delegasikan" : 'Mulai kerjakan tugas Anda'}
              />
            ) : (
              <>
                <div className="flex flex-col">
                  <GroupHeading
                    title={activeTab === 'delegated' ? 'Terbaru dibuat di atas' : 'Terakhir selesai di atas'}
                    count={totalForTab}
                  />
                  {listTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      sourceLine={
                        activeTab === 'delegated'
                          ? (task.assignee ? `Untuk ${task.assignee.display_name}` : undefined)
                          : (task.assigner && task.assigned_by !== session.userId ? `dari ${task.assigner.display_name}` : 'Pribadi')
                      }
                    />
                  ))}
                </div>
                <Pagination
                  page={safePage}
                  pageSize={PAGE_SIZE}
                  total={totalForTab}
                  basePath="/tasks"
                  searchParams={{ tab: activeTab, q: query || undefined }}
                />
              </>
            )}
          </section>

          <aside className="flex flex-col gap-5 lg:col-span-4">
            {activeTab === 'active' && activeTasks.length > 0 && (
              <section className="flex flex-col gap-1 rounded-2xl border bg-card px-[22px] py-[18px]">
                <h2 className="font-heading text-[21px]">Asal tugas</h2>
                {(Object.keys(ORIGIN_LABELS) as Origin[]).map(o => (
                  <div key={o} className="flex items-center gap-2.5 border-t py-2.5">
                    <span className="flex-1 text-[13.5px]">{ORIGIN_LABELS[o]}</span>
                    <b className="font-heading text-xl font-medium tabular-nums">{origins[o]}</b>
                  </div>
                ))}
                {query && <p className="pt-1 text-xs text-muted-foreground">Menghitung hasil pencarian saja.</p>}
              </section>
            )}
            <section className="flex flex-col gap-3 rounded-2xl border bg-card px-[22px] py-[18px]">
              <h2 className="font-heading text-[21px]">Ringkasan</h2>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Total" value={totalActive + totalDone} />
                <StatTile label="Aktif" value={totalActive} />
                <StatTile label="Lewat tenggat" value={overdueCount} danger={overdueCount > 0} />
                <StatTile label="Selesai" value={totalDone} />
              </div>
            </section>
            <CompletedChart weeks={completedWeeks} />
          </aside>
        </div>
      </div>
    </div>
  )
}

function GroupHeading({ title, count, tone }: { title: string; count: number; tone?: 'danger' | 'warm' }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className={cn('text-[11.5px] font-bold uppercase tracking-[0.08em]',
        tone === 'danger' ? 'text-destructive' : tone === 'warm' ? 'text-accent-warm' : 'text-muted-foreground')}>
        {title}
      </span>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  )
}

function DeadlineGroup({
  title, tone, tasks, sourceLine,
}: {
  title: string; tone?: 'danger' | 'warm'; tasks: Task[]; sourceLine: (t: Task) => string
}) {
  if (tasks.length === 0) return null
  return (
    <div className="flex flex-col">
      <GroupHeading title={title} count={tasks.length} tone={tone} />
      {tasks.map(t => <TaskRow key={t.id} task={t} sourceLine={sourceLine(t)} />)}
    </div>
  )
}

function TabChip({
  href, active, count, children,
}: {
  href: string; active: boolean; count: number; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('inline-flex h-[34px] items-center gap-1 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
    >
      {children}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  )
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function weekLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${SHORT_MONTHS[m - 1]}`
}

function CompletedChart({ weeks }: { weeks: CompletedWeek[] }) {
  const max = Math.max(1, ...weeks.map(w => w.count))
  const current = weeks.find(w => w.isCurrent)?.count ?? 0
  const total = weeks.reduce((n, w) => n + w.count, 0)
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border bg-card px-[22px] py-[18px]">
      <h2 className="font-heading text-[21px]">Selesai 8 pekan terakhir</h2>
      <div
        role="img"
        aria-label={`Tugas selesai per pekan: ${weeks.map(w => `pekan ${weekLabel(w.weekStart)} ${w.count}`).join(', ')}`}
        className="flex h-[90px] items-end gap-1.5"
      >
        {weeks.map(w => (
          <span
            key={w.weekStart}
            title={`Pekan ${weekLabel(w.weekStart)}: ${w.count} tugas`}
            className={cn('flex-1 rounded-t', w.isCurrent ? 'bg-primary' : 'bg-primary/55', w.count === 0 && 'bg-muted')}
            style={{ height: w.count === 0 ? '3px' : `${Math.max(6, Math.round((w.count / max) * 100))}%` }}
          />
        ))}
      </div>
      <div className="flex gap-1.5 text-[10.5px] tabular-nums text-muted-foreground" aria-hidden>
        {weeks.map(w => (
          <span key={w.weekStart} className={cn('flex-1 truncate text-center', w.isCurrent && 'font-semibold text-primary')}>
            {w.isCurrent ? 'Ini' : w.weekStart.slice(8, 10).replace(/^0/, '') + '/' + Number(w.weekStart.slice(5, 7))}
          </span>
        ))}
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        <b className="font-semibold text-foreground">{current}</b> tugas selesai pekan ini
        {total > 0 && <> · {total} dalam 8 pekan</>}
      </p>
    </section>
  )
}

function StatTile({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', danger ? 'border-destructive/30 bg-destructive-wash' : 'bg-muted/40')}>
      <p className={cn('text-xs', danger ? 'text-destructive' : 'text-muted-foreground')}>{label}</p>
      <p className={cn('mt-0.5 font-heading text-2xl leading-none tabular-nums', danger && 'text-destructive')}>{value}</p>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center">
      <div className="mx-auto mb-3 inline-flex text-muted-foreground/40">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}
