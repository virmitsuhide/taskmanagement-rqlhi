import { Calendar, User } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ContentRequest } from '@/types'

interface Props {
  request: ContentRequest
}

const TYPE_LABELS: Record<string, string> = {
  flyer_ujian: 'Flyer Ujian',
  flyer_lain: 'Flyer Lainnya',
  video: 'Video',
  lain_lain: 'Lain-lain',
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: { label: 'Diminta', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  on_process: { label: 'Diproses', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  finish: { label: 'Selesai', className: 'bg-green-50 text-green-700 border-green-200' },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Rendah', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  medium: { label: 'Sedang', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'Tinggi', className: 'bg-red-50 text-red-700 border-red-200' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function ContentRequestCard({ request }: Props) {
  const statusConfig = STATUS_CONFIG[request.status]
  const priorityConfig = request.priority ? PRIORITY_CONFIG[request.priority] : null

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">
              {TYPE_LABELS[request.request_type]}
            </p>
            <p className="text-sm font-medium leading-snug line-clamp-2">
              {request.description}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
              {statusConfig.label}
            </Badge>
            {priorityConfig && (
              <Badge variant="outline" className={`text-xs ${priorityConfig.className}`}>
                {priorityConfig.label}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(request.requested_date)}
          </span>
          {request.requester && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {request.requester.display_name}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
