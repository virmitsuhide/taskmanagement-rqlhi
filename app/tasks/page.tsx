import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask, canViewAnalytics } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { NewTaskMenu } from '@/components/tasks/NewTaskMenu'
import { Button } from '@/components/ui/button'
import { CheckSquare, Clock, AlertCircle, CheckCircle2, LayoutGrid, Zap, Target, Users, ClipboardList, Table2 } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import type { Task, TaskStatus, TaskSource, TaskPriority } from '@/types'

const PAGE_SIZE = 20

type Tab = 'active' | 'delegated' | 'done'

interface PageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>
}

const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'returned']

/** Klasifikasi task aktif ke bucket. Mengembalikan key bucket. */
function bucketOf(task: Task, selfUserId: string): 'pribadi_pendek' | 'pribadi_panjang' | 'follow_up' | 'penugasan' {
  const isSelf = task.assigned_by === selfUserId
  if (task.source_type === 'rapat') return 'follow_up'
  if (isSelf) return task.priority === 'jangka_panjang' ? 'pribadi_panjang' : 'pribadi_pendek'
  return 'penugasan'
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

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
        .order('created_at', { ascending: false })
      countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('assigned_by', session.userId).neq('assigned_to', session.userId)
    } else {
      listQuery = supabase
        .from('tasks')
        .select('*, assigner:users!assigned_by(id, display_name, role)')
        .eq('assigned_to', session.userId)
        .eq('status', 'done')
        .order('updated_at', { ascending: false })
      countQuery = supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('assigned_to', session.userId).eq('status', 'done')
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
  const [activeCountRes, doneCountRes, delegatedCountRes, overdueRes] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', session.userId).in('status', ACTIVE_STATUSES),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', session.userId).eq('status', 'done'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_by', session.userId).neq('assigned_to', session.userId),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('assigned_to', session.userId).in('status', ACTIVE_STATUSES)
      .lt('due_date', new Date().toISOString().slice(0, 10)),
  ])

  const totalActive = activeCountRes.count ?? 0
  const totalDone = doneCountRes.count ?? 0
  const totalDelegated = delegatedCountRes.count ?? 0
  const overdueCount = overdueRes.count ?? 0
  const showDelegated = canAssignAnyTask(session.role)
  const showMatrix = canViewAnalytics(session.role)

  // ── Bagi tugas aktif ke bucket ─────────────────────────────────
  const buckets = {
    pribadi_pendek: [] as Task[],
    pribadi_panjang: [] as Task[],
    follow_up: [] as Task[],
    penugasan: [] as Task[],
  }
  for (const t of activeTasks) {
    buckets[bucketOf(t, session.userId)].push(t)
  }
  const inProgressCount = activeTasks.filter(t => t.status === 'in_progress').length

  function tabHref(tab: Tab): string {
    const p = new URLSearchParams()
    if (tab !== 'active') p.set('tab', tab)
    if (query) p.set('q', query)
    const qs = p.toString()
    return qs ? `/tasks?${qs}` : '/tasks'
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Tugas" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <p className="text-2xl font-bold leading-tight">Tugas Saya</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pribadi, follow up rapat, &amp; penugasan atasan
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showMatrix && (
              <Button asChild size="sm" variant="outline">
                <Link href="/tasks/matrix"><Table2 className="h-4 w-4 mr-1" />PR Manajemen</Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks/board"><LayoutGrid className="h-4 w-4 mr-1" />Papan</Link>
            </Button>
            <NewTaskMenu canDelegate={canAssignAnyTask(session.role)} />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Total" value={totalActive + totalDone} />
          <StatCard icon={<Clock className="h-4 w-4 text-blue-500" />} label="Aktif" value={totalActive} />
          <StatCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Terlambat" value={overdueCount} tone={overdueCount > 0 ? 'danger' : undefined} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Selesai" value={totalDone} />
        </div>

        <div className="mb-4">
          <SearchInput placeholder="Cari tugas berdasarkan judul…" />
          {query && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Menampilkan hasil untuk <span className="font-medium">&ldquo;{query}&rdquo;</span>
            </p>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b mb-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabLink href={tabHref('active')} active={activeTab === 'active'} count={totalActive}>Aktif</TabLink>
          {showDelegated && (
            <TabLink href={tabHref('delegated')} active={activeTab === 'delegated'} count={totalDelegated}>Saya Delegasikan</TabLink>
          )}
          <TabLink href={tabHref('done')} active={activeTab === 'done'} count={totalDone}>Selesai</TabLink>
        </div>

        {/* Content */}
        {activeTab === 'active' ? (
          activeTasks.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Tidak ada tugas aktif" subtitle="Saatnya beristirahat sejenak ☕" />
          ) : (
            <div className="space-y-6">
              {inProgressCount > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm flex items-center justify-between">
                  <span className="text-blue-700">
                    <Clock className="h-4 w-4 inline mr-1.5" />
                    Anda sedang mengerjakan <strong>{inProgressCount} tugas</strong>.
                  </span>
                </div>
              )}
              <BucketSection
                icon={<Zap className="h-4 w-4 text-blue-600" />}
                title="Tugas Pribadi · Jangka Pendek"
                emptyHint="Belum ada. Buat lewat menu '+ Buat Tugas' di atas."
                tasks={buckets.pribadi_pendek}
                showAssigner={false}
              />
              <BucketSection
                icon={<Target className="h-4 w-4 text-amber-600" />}
                title="Tugas Pribadi · Jangka Panjang"
                emptyHint="Belum ada target jangka panjang."
                tasks={buckets.pribadi_panjang}
                showAssigner={false}
              />
              <BucketSection
                icon={<ClipboardList className="h-4 w-4 text-violet-600" />}
                title="Dari Follow Up Rapat"
                emptyHint="Tidak ada tindak lanjut dari rapat."
                tasks={buckets.follow_up}
                showAssigner
              />
              <BucketSection
                icon={<Users className="h-4 w-4 text-emerald-600" />}
                title="Dari Penugasan Atasan/Rekan"
                emptyHint="Tidak ada penugasan dari orang lain."
                tasks={buckets.penugasan}
                showAssigner
              />
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
            <div className="space-y-2">
              {listTasks.map(task =>
                activeTab === 'delegated' ? (
                  <TaskCard key={task.id} task={task} showAssignee showAssigner={false} />
                ) : (
                  <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />
                )
              )}
            </div>
            <Pagination
              page={Math.min(page, Math.max(1, Math.ceil(totalForTab / PAGE_SIZE)))}
              pageSize={PAGE_SIZE}
              total={totalForTab}
              basePath="/tasks"
              searchParams={{ tab: activeTab, q: query || undefined }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function BucketSection({
  icon, title, emptyHint, tasks, showAssigner,
}: {
  icon: React.ReactNode; title: string; emptyHint: string; tasks: Task[]; showAssigner: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2 px-3 rounded border border-dashed">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} showAssignee={false} showAssigner={showAssigner} />
          ))}
        </div>
      )}
    </section>
  )
}

function TabLink({
  href, active, count, children,
}: {
  href: string; active: boolean; count: number; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {count > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>}
      {active && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />}
    </Link>
  )
}

function StatCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'danger'
}) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${tone === 'danger' ? 'border-destructive/30 bg-destructive/5' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold mt-1 leading-none">{value}</p>
    </div>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center">
      <div className="text-muted-foreground/40 mx-auto mb-3 inline-flex">{icon}</div>
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

// Unused but kept for clarity:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = TaskSource | TaskPriority
