import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canChangeTaskStatus, canEditTask, canDeleteTask, canManageSubtasks, isManagement,
  ROLE_LABELS, TASK_PROBLEM_LABELS,
} from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { updateTaskStatusFromFormAction } from '@/app/actions/tasks'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskStatusBadge, TaskPriorityBadge, TaskWeightBadge } from '@/components/tasks/TaskStatusBadge'
import { TaskComments } from '@/components/tasks/TaskComments'
import { SubtaskPanel } from '@/components/tasks/SubtaskPanel'
import { GanttChart, GanttLegend } from '@/components/tasks/GanttChart'
import { getSubtasks } from '@/lib/data/gantt'
import { taskRange, taskProgress, parseScale, GANTT_SCALES, shortDate } from '@/lib/tasks/gantt'
import { TaskRowActions } from '@/components/tasks/TaskRowActions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Calendar, Clock, GanttChartSquare, PlayCircle } from 'lucide-react'
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
  todo: ['in_progress', 'problem'],
  in_progress: ['submitted', 'problem'],
  problem: ['in_progress', 'submitted'],
  submitted: ['done', 'returned'],
  done: [],
  returned: ['in_progress', 'problem'],
}

export default async function TaskDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ skala?: string }>
}) {
  const { id } = await params
  const { skala } = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const { data: taskData } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:users!assigned_to(id, display_name, role),
      assigner:users!assigned_by(id, display_name, role)
    `)
    .eq('id', id)
    .single()

  if (!taskData) notFound()
  const task = taskData as Task

  const isAssignee = task.assigned_to === session.userId
  const isAssigner = task.assigned_by === session.userId
  if (!isAssignee && !isAssigner && session.role !== 'kepala_rq') redirect('/tasks')

  // Tugas terhapus hanya terbuka bagi manajemen — merekalah yang bisa
  // memulihkannya. Bagi orang lain tugas itu memang sudah tidak ada.
  const isDeleted = !!task.deleted_at
  if (isDeleted && !isManagement(session.role)) notFound()

  const mayEdit = !isDeleted && canEditTask(session.role, isAssignee, isAssigner)
  const mayDelete = !isDeleted && canDeleteTask(session.role, isAssignee, isAssigner)

  const { data: historyData } = await supabase
    .from('task_history')
    .select('*, changer:users!changed_by(id, display_name)')
    .eq('task_id', id)
    .order('created_at', { ascending: false })

  const history = (historyData ?? []) as TaskHistory[]

  const { data: commentData } = await supabase
    .from('task_comments')
    .select('*, author:users!task_comments_author_id_fkey(id, display_name, role)')
    .eq('task_id', id)
    .order('created_at', { ascending: true })
  const comments = (commentData ?? []) as TaskComment[]

  // Rincian tugas — sumber batang anak pada mini-Gantt di bawah.
  const subtasks = await getSubtasks(id)
  const mayManageSubtasks = !isDeleted && canManageSubtasks(session.role, isAssignee, isAssigner)
  const ganttScale = parseScale(skala)
  const range = taskRange(task, subtasks)
  const progress = taskProgress(task, subtasks)

  // Peserta untuk quick-mention (assignee + assigner, tanpa duplikat)
  const participants = [task.assigner, task.assignee]
    .filter((u): u is NonNullable<typeof u> => !!u)
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)
    .map(u => ({ id: u.id, name: u.display_name }))

  // Tugas terhapus tidak bisa digerakkan lagi — memindahkannya antar kolom
  // hanya akan membingungkan, karena kartunya sendiri tidak ada di papan.
  const allowedNextStatuses = isDeleted
    ? []
    : STATUS_FLOW[task.status].filter(next =>
        canChangeTaskStatus(session.role, task.status, next, isAssignee, isAssigner)
      )

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title={task.title}
        breadcrumbs={[{ label: 'Task', href: '/tasks' }, { label: task.title }]}
        ownH1
      />
      <div className="flex-1 bg-muted/50 dark:bg-background">
      <div className="p-4 md:p-6 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap -mb-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <TaskRowActions
            taskId={id}
            title={task.title}
            canEdit={mayEdit}
            canDelete={mayDelete}
            isDeleted={isDeleted}
            canRestore={isManagement(session.role)}
          />
        </div>

        {isDeleted && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">Tugas ini sudah dihapus.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hanya manajemen yang masih bisa membukanya. Riwayat & diskusinya utuh,
              dan tugas dapat dikembalikan ke daftar lewat tombol Pulihkan.
            </p>
          </div>
        )}

        {/* Task header */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap gap-2 mb-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <TaskWeightBadge weight={task.weight} />
            {task.status === 'problem' && task.problem_type && (
              <Badge variant="outline" className="text-destructive border-destructive/40">
                Hambatan: {TASK_PROBLEM_LABELS[task.problem_type]}
              </Badge>
            )}
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

          {task.start_date && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <PlayCircle className="h-4 w-4" />
              <span>Mulai: {formatDate(task.start_date)}</span>
            </div>
          )}

          {/* Bilah kemajuan hanya muncul kalau tugas benar-benar dirinci —
              persentase yang ditebak dari status kanban (lihat taskProgress)
              tidak layak ditampilkan seakurat angka hasil hitungan. */}
          {!progress.fromStatus && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Kemajuan rincian</span>
                <span className="tabular-nums font-medium">{progress.percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {progress.done} dari {progress.total} langkah selesai
                {' · '}rentang {shortDate(range.start)} – {shortDate(range.end)}
              </p>
            </div>
          )}

          {task.return_notes && task.status === 'returned' && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-medium text-destructive mb-1">Catatan Pengembalian:</p>
              <p className="text-sm">{task.return_notes}</p>
            </div>
          )}
        </div>

        <SubtaskPanel taskId={id} subtasks={subtasks} canManage={mayManageSubtasks} />

        {/* Garis waktu tugas ini saja. Sengaja dipasang tepat di bawah daftar
            rincian: itulah tempat orang baru saja mengetik tanggal, dan akibat
            dari tanggal itu harus terlihat tanpa berpindah halaman. */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-3">
            <GanttChartSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Gantt Chart Tugas Ini</h2>
            <div className="ml-auto flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-background p-0.5">
                {GANTT_SCALES.map(sc => (
                  <Link
                    key={sc.key}
                    href={sc.key === 'hari' ? `/tasks/${id}` : `/tasks/${id}?skala=${sc.key}`}
                    scroll={false}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      ganttScale === sc.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sc.label}
                  </Link>
                ))}
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7">
                <Link href="/tasks/gantt">Semua tugas saya</Link>
              </Button>
            </div>
          </div>
          <div className="p-4">
            <GanttChart
              rows={[{ task, subtasks, range, progress }]}
              scale={ganttScale}
              linkTasks={false}
              emptyLabel="Tugas ini belum punya tanggal apa pun."
            />
            <div className="mt-3">
              <GanttLegend hasOverdue={!!task.due_date && task.status !== 'done'} />
            </div>
          </div>
        </div>

        {/* Status change actions */}
        {allowedNextStatuses.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <h2 className="border-b bg-muted/40 px-5 py-3 text-sm font-semibold">Ubah Status</h2>
            <div className="p-5 pb-2">
              {allowedNextStatuses.map(nextStatus => (
                <StatusChangeForm
                  key={nextStatus}
                  taskId={id}
                  nextStatus={nextStatus}
                  needsNotes={nextStatus === 'returned'}
                />
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <h2 className="border-b bg-muted/40 px-5 py-3 text-sm font-semibold">Riwayat</h2>
          <div className="space-y-3 p-5">
            {history.map(h => (
              <div key={h.id} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                <div>
                  <p className="text-sm">
                    <strong>{h.changer?.display_name}</strong>{' '}
                    <HistoryVerb entry={h} />
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

        {/* Diskusi / Komentar */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <TaskComments
            taskId={id}
            taskTitle={task.title}
            comments={comments}
            currentUserId={session.userId}
            isModerator={session.role === 'kepala_rq'}
            participants={participants}
          />
        </div>
      </div>
      </div>
    </div>
  )
}

/**
 * Kalimat riwayat sesuai jenis peristiwanya.
 *
 * Sejak migrasi 0018 tidak semua baris riwayat adalah perpindahan status:
 * sunting/hapus/pulih menyimpan new_status yang sama dengan old_status, jadi
 * membacanya sebagai perubahan status akan menghasilkan "dari todo ke todo".
 * Baris lama (sebelum migrasi) tidak punya kolom action — diperlakukan
 * sebagai 'status', sesuai artinya selama ini.
 */
function HistoryVerb({ entry }: { entry: TaskHistory }) {
  switch (entry.action ?? 'status') {
    case 'edited':
      return <>menyunting isi tugas</>
    case 'deleted':
      return <>menghapus tugas</>
    case 'restored':
      return <>memulihkan tugas</>
    default:
      if (!entry.old_status) return <>membuat task</>
      return (
        <>
          mengubah status dari <Badge variant="outline" className="text-xs">{entry.old_status}</Badge>
          {' '}ke <Badge variant="outline" className="text-xs">{entry.new_status}</Badge>
        </>
      )
  }
}

function StatusChangeForm({ taskId, nextStatus, needsNotes }: {
  taskId: string
  nextStatus: TaskStatus
  needsNotes: boolean
}) {
  const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'Kembalikan ke To Do',
    in_progress: nextStatus === 'in_progress' ? 'Mulai Kerjakan' : 'Kerjakan Ulang',
    problem: 'Tandai Bermasalah',
    submitted: 'Kirim untuk Review',
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
