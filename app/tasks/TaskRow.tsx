import Link from 'next/link'
import { Check } from 'lucide-react'
import { TaskStatusBadge, TaskPriorityBadge, TaskWeightBadge } from '@/components/tasks/TaskStatusBadge'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

/** Selisih hari (kalender, waktu lokal) dari hari ini ke tanggal tenggat. */
export function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

function dueText(task: Task): { text: string; tone: 'danger' | 'strong' | 'muted' } | null {
  const days = daysUntil(task.due_date)
  if (days === null || !task.due_date) return null
  const d = new Date(task.due_date)
  if (task.status === 'done') {
    return { text: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), tone: 'muted' }
  }
  if (days < 0) return { text: `lewat ${-days} hari`, tone: 'danger' }
  if (days === 0) return { text: 'Hari ini', tone: 'strong' }
  if (days === 1) return { text: 'Besok', tone: 'strong' }
  if (days <= 7) return { text: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), tone: 'muted' }
  return { text: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }), tone: 'muted' }
}

interface Props {
  task: Task
  /** Baris keterangan asal/penerima tugas di bawah judul. */
  sourceLine?: string
}

/** Satu baris tugas bergaya daftar "Tugas saya" — seluruh baris menaut ke rincian tugas. */
export function TaskRow({ task, sourceLine }: Props) {
  const due = dueText(task)
  const done = task.status === 'done'
  const returned = task.status === 'returned' && task.return_notes
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1.5 border-t py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[22px_minmax(0,1fr)_auto_110px] sm:items-center"
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] sm:mt-0',
          done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card group-hover:border-primary/60',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm font-bold leading-snug', done && 'text-muted-foreground line-through decoration-1')}>
          {task.title}
        </span>
        {(sourceLine || returned) && (
          <span className="block truncate text-xs text-muted-foreground">
            {sourceLine}
            {returned && <>{sourceLine ? ' · ' : ''}dikembalikan: &ldquo;{task.return_notes}&rdquo;</>}
          </span>
        )}
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-auto sm:justify-end">
        <TaskStatusBadge status={task.status} />
        {task.priority === 'high' && <TaskPriorityBadge priority={task.priority} />}
        {task.weight !== 'medium' && <TaskWeightBadge weight={task.weight} />}
        {due && (
          <span className={cn('ml-auto text-xs font-bold sm:hidden',
            due.tone === 'danger' ? 'text-destructive' : due.tone === 'strong' ? 'text-foreground' : 'text-muted-foreground')}>
            {due.text}
          </span>
        )}
      </span>
      <span className={cn('hidden text-right text-[12.5px] font-bold sm:block',
        due?.tone === 'danger' ? 'text-destructive' : due?.tone === 'strong' ? 'text-foreground' : 'text-muted-foreground')}>
        {due?.text ?? '—'}
      </span>
    </Link>
  )
}
