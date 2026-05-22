import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, CheckSquare, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Task } from '@/types'

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const [assignedToMe, assignedByMe] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, assigner:users!tasks_assigned_by_fkey(id, display_name, role)')
      .eq('assigned_to', session.userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*, assignee:users!tasks_assigned_to_fkey(id, display_name, role)')
      .eq('assigned_by', session.userId)
      .neq('assigned_to', session.userId)
      .order('created_at', { ascending: false }),
  ])

  const myTasks = (assignedToMe.data ?? []) as Task[]
  const delegatedTasks = (assignedByMe.data ?? []) as Task[]
  const activeMy = myTasks.filter(t => t.status !== 'done')
  const doneMy = myTasks.filter(t => t.status === 'done')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const overdueCount = activeMy.filter(t => t.due_date && new Date(t.due_date) < today).length

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
          {canAssignAnyTask(session.role) && (
            <Button asChild size="sm">
              <Link href="/tasks/baru"><Plus className="h-4 w-4 mr-1" />Buat Task</Link>
            </Button>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Total" value={myTasks.length} />
          <StatCard icon={<Clock className="h-4 w-4 text-blue-500" />} label="Aktif" value={activeMy.length} />
          <StatCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Terlambat" value={overdueCount} tone={overdueCount > 0 ? 'danger' : undefined} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Selesai" value={doneMy.length} />
        </div>

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              Aktif {activeMy.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({activeMy.length})</span>}
            </TabsTrigger>
            {canAssignAnyTask(session.role) && (
              <TabsTrigger value="delegated" className="flex-1">
                Ditugaskan {delegatedTasks.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({delegatedTasks.length})</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="done" className="flex-1">
              Selesai {doneMy.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({doneMy.length})</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-2">
            {activeMy.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Tidak ada task aktif" subtitle="Saatnya beristirahat sejenak ☕" />
            ) : (
              activeMy.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)
            )}
          </TabsContent>

          {canAssignAnyTask(session.role) && (
            <TabsContent value="delegated" className="mt-4 space-y-2">
              {delegatedTasks.length === 0 ? (
                <EmptyState icon={<CheckSquare className="h-8 w-8" />} title="Belum ada task yang ditugaskan" subtitle="Klik 'Buat Task' untuk mendelegasikan tugas" />
              ) : (
                delegatedTasks.map(task => <TaskCard key={task.id} task={task} showAssignee showAssigner={false} />)
              )}
            </TabsContent>
          )}

          <TabsContent value="done" className="mt-4 space-y-2">
            {doneMy.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8" />} title="Belum ada task selesai" subtitle="Mulai kerjakan tugas Anda" />
            ) : (
              doneMy.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
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
