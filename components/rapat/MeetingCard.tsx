import Link from 'next/link'
import { Calendar, Clock, MapPin, Users, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function relativeDate(dateStr: string): string | null {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'
  if (diff === -1) return 'Kemarin'
  if (diff > 1 && diff <= 7) return `${diff} hari lagi`
  if (diff < -1 && diff >= -7) return `${-diff} hari lalu`
  return null
}

const MEETING_COLORS: Record<string, { dot: string; badge: string }> = {
  manajemen:   { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900' },
  kumik:       { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900' },
  new_squad:   { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900' },
  koor_sd:     { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900' },
  koor_smp:    { dot: 'bg-cyan-500',   badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900' },
}

export function MeetingCard({ meeting }: Props) {
  const colors = MEETING_COLORS[meeting.type] ?? { dot: 'bg-muted-foreground', badge: '' }
  const rel = relativeDate(meeting.date)

  return (
    <Link
      href={`/rapat/${meeting.id}`}
      className="group relative block rounded-xl border bg-card p-4 transition hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${colors.dot}`} aria-hidden />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-snug pl-2 group-hover:text-foreground">
            {meeting.subject}
          </h3>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] font-medium ${colors.badge}`}>
          {MEETING_TYPE_LABELS[meeting.type]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(meeting.date)}
          {rel && <span className="ml-1 text-foreground/70 font-medium">· {rel}</span>}
        </span>
        {meeting.start_time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {meeting.start_time}
            {meeting.end_time ? `–${meeting.end_time}` : ''}
          </span>
        )}
        {meeting.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {meeting.location}
          </span>
        )}
        {meeting.participants && meeting.participants.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {meeting.participants.length} peserta
          </span>
        )}
      </div>

      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  )
}
