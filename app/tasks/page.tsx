import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
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

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Task" />
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{myTasks.length} task total</p>
          {canAssignAnyTask(session.role) && (
            <Button asChild size="sm">
              <Link href="/tasks/baru"><Plus className="h-4 w-4 mr-1" />Buat Task</Link>
            </Button>
          )}
        </div>

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              Aktif {activeMy.length > 0 && `(${activeMy.length})`}
            </TabsTrigger>
            {canAssignAnyTask(session.role) && (
              <TabsTrigger value="delegated" className="flex-1">
                Ditugaskan {delegatedTasks.length > 0 && `(${delegatedTasks.length})`}
              </TabsTrigger>
            )}
            <TabsTrigger value="done" className="flex-1">Selesai</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-2">
            {activeMy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada task aktif.</p>
            ) : (
              activeMy.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)
            )}
          </TabsContent>

          {canAssignAnyTask(session.role) && (
            <TabsContent value="delegated" className="mt-4 space-y-2">
              {delegatedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Belum ada task yang ditugaskan.</p>
              ) : (
                delegatedTasks.map(task => <TaskCard key={task.id} task={task} showAssignee showAssigner={false} />)
              )}
            </TabsContent>
          )}

          <TabsContent value="done" className="mt-4 space-y-2">
            {doneMy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada task selesai.</p>
            ) : (
              doneMy.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
