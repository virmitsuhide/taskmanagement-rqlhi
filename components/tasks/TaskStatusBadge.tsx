import { Badge } from '@/components/ui/badge'
import type { TaskStatus, TaskPriority } from '@/types'

type BadgeVariant = React.ComponentProps<typeof Badge>['variant']

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: BadgeVariant; className?: string }> = {
  todo: { label: 'To Do', variant: 'outline', className: 'text-muted-foreground' },
  in_progress: { label: 'Dikerjakan', variant: 'info' },
  submitted: { label: 'Menunggu Verifikasi', variant: 'warning' },
  done: { label: 'Selesai', variant: 'success' },
  returned: { label: 'Dikembalikan', variant: 'destructive' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; variant: BadgeVariant; className?: string }> = {
  normal: { label: 'Normal', variant: 'outline', className: 'text-muted-foreground' },
  mendesak: { label: 'Mendesak', variant: 'destructive' },
  jangka_panjang: { label: 'Jangka Panjang', variant: 'info' },
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
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
