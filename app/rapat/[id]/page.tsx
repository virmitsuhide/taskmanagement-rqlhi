import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting, canDeleteMeeting, canViewMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { deleteMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Calendar, Clock, Edit, MapPin, Trash2, Users, ExternalLink } from 'lucide-react'
import type { Meeting, AgendaItem } from '@/types'

const TAG_CONFIG = {
  keputusan: { label: 'Keputusan', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  informasi: { label: 'Informasi', className: 'bg-green-50 text-green-700 border-green-200' },
  hasil_diskusi: { label: 'Hasil Diskusi', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  tindak_lanjut: { label: 'Tindak Lanjut', className: 'bg-orange-50 text-orange-700 border-orange-200' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function RapatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*, creator:users!meetings_created_by_fkey(id, display_name)')
    .eq('id', id)
    .single()

  if (!meeting) notFound()
  if (!canViewMeeting(session.role, meeting.type)) redirect('/rapat')

  const { data: agendaItems } = await supabase
    .from('agenda_items')
    .select('*')
    .eq('meeting_id', id)
    .order('order_num')

  const items = (agendaItems ?? []) as AgendaItem[]
  const m = meeting as Meeting

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} />
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/rapat"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <div className="flex gap-2">
            {canEditMeeting(session.role, m.type) && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/rapat/${id}/edit`}><Edit className="h-4 w-4 mr-1" />Edit</Link>
              </Button>
            )}
            {canDeleteMeeting(session.role, m.type) && (
              <form action={deleteMeetingAction.bind(null, id) as unknown as (fd: FormData) => void}>
                <Button size="sm" variant="destructive" type="submit">
                  <Trash2 className="h-4 w-4 mr-1" />Hapus
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Meeting header */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <Badge variant="outline" className={`shrink-0 ${Object.values(TAG_CONFIG)[0].className}`}>
              {MEETING_TYPE_LABELS[m.type]}
            </Badge>
          </div>
          <h1 className="text-xl font-bold">{m.subject}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />{formatDate(m.date)}
            </span>
            {m.start_time && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {m.start_time}{m.end_time ? ` – ${m.end_time}` : ''}
              </span>
            )}
            {m.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />{m.location}
              </span>
            )}
          </div>
          {(m.mc || m.notulis) && (
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              {m.mc && <span>MC: <strong>{m.mc}</strong></span>}
              {m.notulis && <span>Notulis: <strong>{m.notulis}</strong></span>}
            </div>
          )}
          {m.participants && m.participants.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{m.participants.join(', ')}</span>
            </div>
          )}
        </div>

        <Separator className="mb-6" />

        {/* Agenda items */}
        <div>
          <h2 className="font-semibold mb-4">Notulen Rapat</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada poin notulen.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => {
                const tagConfig = TAG_CONFIG[item.tag]
                return (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
                      <Badge variant="outline" className={`text-xs ${tagConfig.className}`}>
                        {tagConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm whitespace-pre-line">{item.discussion}</p>
                    {item.follow_up && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tindak Lanjut:</p>
                        <p className="text-sm text-orange-700">{item.follow_up}</p>
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link href={`/tasks/baru?meeting_id=${id}&agenda_id=${item.id}&title=${encodeURIComponent(item.follow_up)}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />Buat Task
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
