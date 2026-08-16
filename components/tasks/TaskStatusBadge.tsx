import { Badge } from '@/components/ui/badge'
import { TASK_PRIORITY_LABELS, TASK_WEIGHT_LABELS } from '@/lib/auth/permissions'
import type { TaskStatus, TaskPriority, TaskWeight } from '@/types'

type BadgeVariant = React.ComponentProps<typeof Badge>['variant']

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: BadgeVariant; className?: string }> = {
  todo: { label: 'To Do', variant: 'outline', className: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', variant: 'info' },
  problem: { label: 'Problem', variant: 'destructive' },
  submitted: { label: 'Review', variant: 'warning' },
  done: { label: 'Done', variant: 'success' },
  returned: { label: 'Dikembalikan', variant: 'destructive' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: BadgeVariant; className?: string }> = {
  high:   { label: TASK_PRIORITY_LABELS.high,   variant: 'destructive' },
  middle: { label: TASK_PRIORITY_LABELS.middle, variant: 'info' },
  low:    { label: TASK_PRIORITY_LABELS.low,    variant: 'outline', className: 'text-muted-foreground' },
}

const WEIGHT_CONFIG: Record<TaskWeight, { label: string; variant: BadgeVariant; className?: string }> = {
  hard:   { label: TASK_WEIGHT_LABELS.hard,   variant: 'outline', className: 'text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-800' },
  medium: { label: TASK_WEIGHT_LABELS.medium, variant: 'outline', className: 'text-muted-foreground' },
  easy:   { label: TASK_WEIGHT_LABELS.easy,   variant: 'outline', className: 'text-green-700 border-green-300 dark:text-green-300 dark:border-green-800' },
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority]
  if (!config) return null
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

export function TaskWeightBadge({ weight }: { weight: TaskWeight }) {
  const config = WEIGHT_CONFIG[weight]
  if (!config) return null
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
