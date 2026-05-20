import Link from 'next/link'
import { Calendar, Clock, MapPin, Users } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

const MEETING_COLORS: Record<string, string> = {
  manajemen: 'bg-blue-50 text-blue-700 border-blue-200',
  kumik: 'bg-green-50 text-green-700 border-green-200',
  new_squad: 'bg-purple-50 text-purple-700 border-purple-200',
  koor_sd: 'bg-orange-50 text-orange-700 border-orange-200',
  koor_smp: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

export function MeetingCard({ meeting }: Props) {
  return (
    <Link href={`/rapat/${meeting.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug flex-1">{meeting.subject}</h3>
            <Badge variant="outline" className={`shrink-0 text-xs ${MEETING_COLORS[meeting.type] ?? ''}`}>
              {MEETING_TYPE_LABELS[meeting.type]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(meeting.date)}
            </span>
            {meeting.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {meeting.start_time}
                {meeting.end_time ? ` – ${meeting.end_time}` : ''}
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
        </CardContent>
      </Card>
    </Link>
  )
}
