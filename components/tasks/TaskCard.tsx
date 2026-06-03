import Link from 'next/link'
import { Calendar, User, AlertCircle, ChevronRight } from 'lucide-react'
import { TaskStatusBadge, TaskPriorityBadge } from './TaskStatusBadge'
import type { Task } from '@/types'

interface Props {
  task: Task
  showAssignee?: boolean
  showAssigner?: boolean
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

const STATUS_BAR: Record<string, string> = {
  todo: 'bg-muted-foreground/30',
  in_progress: 'bg-info',
  submitted: 'bg-warning',
  done: 'bg-success',
  returned: 'bg-destructive',
}

export function TaskCard({ task, showAssignee = true, showAssigner = false }: Props) {
  const days = daysUntil(task.due_date)
  const overdue = days !== null && days < 0 && task.status !== 'done'
  const dueSoon = days !== null && days >= 0 && days <= 2 && task.status !== 'done'

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group relative block rounded-xl border bg-card p-4 transition hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${STATUS_BAR[task.status] ?? 'bg-muted-foreground/30'}`}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2 mb-1.5 pl-2">
        <h3 className={`font-medium text-sm leading-snug flex-1 ${task.status === 'done' ? 'text-muted-foreground line-through decoration-1' : ''}`}>
          {task.title}
        </h3>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <TaskStatusBadge status={task.status} />
          {task.priority !== 'normal' && <TaskPriorityBadge priority={task.priority} />}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 pl-2">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-2 text-xs text-muted-foreground">
        {task.due_date && (
          <span
            className={`flex items-center gap-1 ${
              overdue ? 'text-destructive font-medium' : dueSoon ? 'text-warning font-medium' : ''
            }`}
          >
            {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {overdue
              ? `Terlambat ${-days!} hari`
              : days === 0
              ? 'Jatuh tempo hari ini'
              : days === 1
              ? 'Jatuh tempo besok'
              : formatDate(task.due_date)}
          </span>
        )}
        {showAssignee && task.assignee && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assignee.display_name}
          </span>
        )}
        {showAssigner && task.assigner && (
          <span className="text-muted-foreground/70">
            dari {task.assigner.display_name}
          </span>
        )}
      </div>

      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  )
}
