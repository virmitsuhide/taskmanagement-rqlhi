import { Badge } from '@/components/ui/badge'
import type { TaskStatus, TaskPriority } from '@/types'

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  todo: { label: 'To Do', variant: 'outline', className: 'text-muted-foreground' },
  in_progress: { label: 'Dikerjakan', variant: 'default', className: 'bg-blue-500 hover:bg-blue-500' },
  submitted: { label: 'Menunggu Verifikasi', variant: 'default', className: 'bg-amber-500 hover:bg-amber-500' },
  done: { label: 'Selesai', variant: 'default', className: 'bg-green-600 hover:bg-green-600' },
  returned: { label: 'Dikembalikan', variant: 'destructive', className: '' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'border-border text-muted-foreground' },
  mendesak: { label: 'Mendesak', className: 'border-red-300 text-red-600 bg-red-50' },
  jangka_panjang: { label: 'Jangka Panjang', className: 'border-purple-300 text-purple-600 bg-purple-50' },
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
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
