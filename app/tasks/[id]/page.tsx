import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canChangeTaskStatus, ROLE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateTaskStatusFromFormAction } from '@/app/actions/tasks'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskStatusBadge, TaskPriorityBadge } from '@/components/tasks/TaskStatusBadge'
import { TaskComments } from '@/components/tasks/TaskComments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import type { Task, TaskHistory, TaskStatus, TaskComment } from '@/types'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const STATUS_FLOW: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['done', 'returned'],
  done: [],
  returned: ['in_progress'],
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const { data: taskData } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:users!tasks_assigned_to_fkey(id, display_name, role),
      assigner:users!tasks_assigned_by_fkey(id, display_name, role)
    `)
    .eq('id', id)
    .single()

  if (!taskData) notFound()
  const task = taskData as Task

  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId
  if (!isAssignee && !isAssigner && session.role !== 'kepala_rq') redirect('/tasks')

  const { data: historyData } = await supabase
    .from('task_history')
    .select('*, changer:users!task_history_changed_by_fkey(id, display_name)')
    .eq('task_id', id)
    .order('created_at', { ascending: false })

  const history = (historyData ?? []) as TaskHistory[]

  const { data: commentData } = await supabase
    .from('task_comments')
    .select('*, author:users!task_comments_author_id_fkey(id, display_name, role)')
    .eq('task_id', id)
    .order('created_at', { ascending: true })
  const comments = (commentData ?? []) as TaskComment[]

  // Peserta untuk quick-mention (assignee + assigner, tanpa duplikat)
  const participants = [task.assigner, task.assignee]
    .filter((u): u is NonNullable<typeof u> => !!u)
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)
    .map(u => ({ id: u.id, name: u.display_name }))

  const allowedNextStatuses = STATUS_FLOW[task.status].filter(next =>
    canChangeTaskStatus(session.role, task.status, next, isAssignee, isAssigner)
  )

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title={task.title}
        breadcrumbs={[{ label: 'Task', href: '/tasks' }, { label: task.title }]}
      />
      <div className="p-4 md:p-6 max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
        </Button>

        {/* Task header */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <TaskStatusBadge status={task.status} />
            {task.priority !== 'normal' && <TaskPriorityBadge priority={task.priority} />}
          </div>
          <h1 className="text-xl font-bold mb-3">{task.title}</h1>
          {task.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
            <span>Dari: <strong>{task.assigner?.display_name}</strong> ({task.assigner ? ROLE_LABELS[task.assigner.role] : ''})</span>
            <span>Kepada: <strong>{task.assignee?.display_name}</strong> ({task.assignee ? ROLE_LABELS[task.assignee.role] : ''})</span>
          </div>

          {task.due_date && (
            <div className="flex items-center gap-1.5 mt-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-destructive font-medium' : ''}>
                Deadline: {formatDate(task.due_date)}
              </span>
            </div>
          )}

          {task.return_notes && task.status === 'returned' && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-medium text-destructive mb-1">Catatan Pengembalian:</p>
              <p className="text-sm">{task.return_notes}</p>
            </div>
          )}
        </div>

        {/* Status change actions */}
        {allowedNextStatuses.length > 0 && (
          <>
            <Separator className="mb-6" />
            <div className="mb-6">
              <h2 className="font-semibold mb-3">Ubah Status</h2>
              {allowedNextStatuses.map(nextStatus => (
                <StatusChangeForm
                  key={nextStatus}
                  taskId={id}
                  nextStatus={nextStatus}
                  needsNotes={nextStatus === 'returned'}
                />
              ))}
            </div>
          </>
        )}

        <Separator className="mb-6" />

        {/* History */}
        <div>
          <h2 className="font-semibold mb-4">Riwayat</h2>
          <div className="space-y-3">
            {history.map(h => (
              <div key={h.id} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                <div>
                  <p className="text-sm">
                    <strong>{h.changer?.display_name}</strong>{' '}
                    {h.old_status ? (
                      <>mengubah status dari <Badge variant="outline" className="text-xs">{h.old_status}</Badge> ke <Badge variant="outline" className="text-xs">{h.new_status}</Badge></>
                    ) : (
                      <>membuat task</>
                    )}
                  </p>
                  {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{formatDateTime(h.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Diskusi / Komentar */}
        <TaskComments
          taskId={id}
          comments={comments}
          currentUserId={session.userId}
          isModerator={session.role === 'kepala_rq'}
          participants={participants}
        />
      </div>
    </div>
  )
}

function StatusChangeForm({ taskId, nextStatus, needsNotes }: {
  taskId: string
  nextStatus: TaskStatus
  needsNotes: boolean
}) {
  const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'Kembalikan ke To Do',
    in_progress: nextStatus === 'in_progress' ? 'Mulai Kerjakan' : 'Kerjakan Ulang',
    submitted: 'Tandai Selesai (Kirim Verifikasi)',
    done: 'Verifikasi Selesai ✓',
    returned: 'Kembalikan (Perlu Revisi)',
  }

  return (
    <form action={updateTaskStatusFromFormAction} className="mb-3">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="new_status" value={nextStatus} />
      {needsNotes && (
        <div className="space-y-1.5 mb-3">
          <Label htmlFor={`notes-${nextStatus}`}>Catatan Pengembalian</Label>
          <Textarea
            id={`notes-${nextStatus}`}
            name="notes"
            rows={2}
            placeholder="Jelaskan apa yang perlu direvisi..."
            required={nextStatus === 'returned'}
          />
        </div>
      )}
      <Button
        type="submit"
        size="sm"
        variant={nextStatus === 'done' ? 'default' : nextStatus === 'returned' ? 'destructive' : 'outline'}
      >
        {STATUS_LABELS[nextStatus]}
      </Button>
    </form>
  )
}
