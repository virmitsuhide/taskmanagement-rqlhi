import Link from 'next/link'
import { Calendar, User } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'done') return false
  return new Date(dueDate) < new Date()
}

export function TaskCard({ task, showAssignee = true, showAssigner = false }: Props) {
  const overdue = isOverdue(task.due_date, task.status)

  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug flex-1">{task.title}</h3>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <TaskStatusBadge status={task.status} />
              {task.priority !== 'normal' && (
                <TaskPriorityBadge priority={task.priority} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {task.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-medium' : ''}`}>
                <Calendar className="h-3 w-3" />
                {overdue ? 'Terlambat · ' : ''}{formatDate(task.due_date)}
              </span>
            )}
            {showAssignee && task.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignee.display_name}
              </span>
            )}
            {showAssigner && task.assigner && (
              <span className="flex items-center gap-1 text-muted-foreground/70">
                dari {task.assigner.display_name}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
