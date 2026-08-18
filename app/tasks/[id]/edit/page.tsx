import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditTask } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskEditForm } from '@/components/tasks/TaskEditForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Task } from '@/types'

export default async function TaskEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const task = data as Task
  if (task.deleted_at) notFound()

  // Gerbang yang sama dipasang ulang di updateTaskAction — halaman ini hanya
  // menyembunyikan form, server yang menolak permintaannya.
  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId
  if (!canEditTask(session.role, isAssignee, isAssigner)) redirect(`/tasks/${id}`)

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Sunting Tugas"
        breadcrumbs={[
          { label: 'Task', href: '/tasks' },
          { label: task.title, href: `/tasks/${id}` },
          { label: 'Sunting' },
        ]}
        ownH1
      />
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="p-4 md:p-6 max-w-3xl space-y-5">
          <Button asChild variant="ghost" size="sm" className="-mb-1">
            <Link href={`/tasks/${id}`}><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <TaskEditForm task={task} />
        </div>
      </div>
    </div>
  )
}
