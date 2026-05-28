import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare, Clock, AlertCircle, CheckCircle2, LayoutGrid } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import type { Task, TaskStatus } from '@/types'

const PAGE_SIZE = 20

type Tab = 'active' | 'delegated' | 'done'

interface PageProps {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const query = (params.q ?? '').trim()
  const activeTab: Tab = (params.tab === 'delegated' || params.tab === 'done') ? params.tab : 'active'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const supabase = createServerClient()
  const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'returned']

  function countActive() {
    let q = supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', session!.userId)
      .in('status', ACTIVE_STATUSES)
    if (query) q = q.ilike('title', `%${query}%`)
    return q
  }
  function countDone() {
    let q = supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', session!.userId)
      .eq('status', 'done')
    if (query) q = q.ilike('title', `%${query}%`)
    return q
  }
  function countDelegated() {
    let q = supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_by', session!.userId)
      .neq('assigned_to', session!.userId)
    if (query) q = q.ilike('title', `%${query}%`)
    return q
  }

  const [activeCount, doneCount, delegatedCount] = await Promise.all([
    countActive(), countDone(), countDelegated(),
  ])

  // Total for currently visible tab
  const totalForTab = activeTab === 'active' ? (activeCount.count ?? 0)
    : activeTab === 'done' ? (doneCount.count ?? 0)
    : (delegatedCount.count ?? 0)

  const totalPages = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Fetch only the active tab's rows
  let listQuery
  if (activeTab === 'delegated') {
    listQuery = supabase
      .from('tasks')
      .select('*, assignee:users!tasks_assigned_to_fkey(id, display_name, role)')
      .eq('assigned_by', session.userId)
      .neq('assigned_to', session.userId)
      .order('created_at', { ascending: false })
  } else if (activeTab === 'done') {
    listQuery = supabase
      .from('tasks')
      .select('*, assigner:users!tasks_assigned_by_fkey(id, display_name, role)')
      .eq('assigned_to', session.userId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })
  } else {
    listQuery = supabase
      .from('tasks')
      .select('*, assigner:users!tasks_assigned_by_fkey(id, display_name, role)')
      .eq('assigned_to', session.userId)
      .in('status', ACTIVE_STATUSES)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
  }
  if (query) listQuery = listQuery.ilike('title', `%${query}%`)
  const { data } = await listQuery.range(from, to)
  const tasks = (data ?? []) as Task[]

  // Overdue badge (full count for active tab via separate cheap query)
  let overdueCount = 0
  if (!query) {
    const todayIso = new Date().toISOString().slice(0, 10)
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', session.userId)
      .in('status', ACTIVE_STATUSES)
      .lt('due_date', todayIso)
    overdueCount = count ?? 0
  }

  const totalActive = activeCount.count ?? 0
  const totalDone = doneCount.count ?? 0
  const totalDelegated = delegatedCount.count ?? 0
  const showDelegated = canAssignAnyTask(session.role)

  function tabHref(tab: Tab): string {
    const p = new URLSearchParams()
    if (tab !== 'active') p.set('tab', tab)
    if (query) p.set('q', query)
    const qs = p.toString()
    return qs ? `/tasks?${qs}` : '/tasks'
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Task" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <p className="text-2xl font-bold leading-tight">Task Saya</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelola tugas yang ditugaskan kepada Anda
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks/board"><LayoutGrid className="h-4 w-4 mr-1" />Papan</Link>
            </Button>
            {canAssignAnyTask(session.role) && (
              <Button asChild size="sm">
                <Link href="/tasks/baru"><Plus className="h-4 w-4 mr-1" />Buat Task</Link>
              </Button>
            )}
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
          <SearchInput placeholder="Cari task berdasarkan judul…" />
          {query && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Menampilkan hasil untuk <span className="font-medium">&ldquo;{query}&rdquo;</span>
            </p>
          )}
        </div>

        {/* Tab nav (URL-driven) */}
        <div className="flex gap-1 border-b mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabLink href={tabHref('active')} active={activeTab === 'active'} count={totalActive}>
            Aktif
          </TabLink>
          {showDelegated && (
            <TabLink href={tabHref('delegated')} active={activeTab === 'delegated'} count={totalDelegated}>
              Ditugaskan
            </TabLink>
          )}
          <TabLink href={tabHref('done')} active={activeTab === 'done'} count={totalDone}>
            Selesai
          </TabLink>
        </div>

        {/* Tab content */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={activeTab === 'active' ? <CheckCircle2 className="h-8 w-8" /> : <CheckSquare className="h-8 w-8" />}
            title={
              activeTab === 'active' ? 'Tidak ada task aktif'
              : activeTab === 'delegated' ? 'Belum ada task yang ditugaskan'
              : 'Belum ada task selesai'
            }
            subtitle={
              activeTab === 'active' ? 'Saatnya beristirahat sejenak ☕'
              : activeTab === 'delegated' ? "Klik 'Buat Task' untuk mendelegasikan tugas"
              : 'Mulai kerjakan tugas Anda'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {tasks.map(task =>
                activeTab === 'delegated' ? (
                  <TaskCard key={task.id} task={task} showAssignee showAssigner={false} />
                ) : (
                  <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />
                )
              )}
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={totalForTab}
              basePath="/tasks"
              searchParams={{ tab: activeTab !== 'active' ? activeTab : undefined, q: query || undefined }}
            />
          </>
        )}
      </div>
    </div>
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
