import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting, canDeleteMeeting, canViewMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { deleteMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { PrintButton } from '@/components/rapat/PrintButton'
import { ArrowLeft, Calendar, Clock, Edit, MapPin, Trash2, Users, ExternalLink, FileText } from 'lucide-react'
import type { Meeting, AgendaItem } from '@/types'

const TAG_CONFIG = {
  keputusan:     { label: 'Keputusan',     badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',       bar: 'bg-blue-500' },
  informasi:     { label: 'Informasi',     badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900', bar: 'bg-green-500' },
  hasil_diskusi: { label: 'Hasil Diskusi', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900', bar: 'bg-purple-500' },
  tindak_lanjut: { label: 'Tindak Lanjut', badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900', bar: 'bg-orange-500' },
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
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link href="/rapat"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <div className="flex gap-1.5">
            {canEditMeeting(session.role, m.type) && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/rapat/${id}/edit`}><Edit className="h-3.5 w-3.5 mr-1" />Edit</Link>
              </Button>
            )}
            {canDeleteMeeting(session.role, m.type) && (
              <form action={deleteMeetingAction.bind(null, id) as unknown as (fd: FormData) => void}>
                <Button size="sm" variant="ghost" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Hapus
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Meeting header card */}
        <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">
          <Badge variant="outline" className="mb-3 text-[10px] font-medium uppercase tracking-wide">
            {MEETING_TYPE_LABELS[m.type]}
          </Badge>
          <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight">{m.subject}</h1>

          <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6 mt-4 text-sm">
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Tanggal" value={formatDate(m.date)} />
            {m.start_time && (
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Waktu"
                value={`${m.start_time}${m.end_time ? ` – ${m.end_time}` : ''}`}
              />
            )}
            {m.location && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Tempat" value={m.location} />}
            {m.mc && <InfoRow icon={<Users className="h-4 w-4" />} label="MC" value={m.mc} />}
            {m.notulis && <InfoRow icon={<FileText className="h-4 w-4" />} label="Notulis" value={m.notulis} />}
          </div>

          {m.participants && m.participants.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Peserta ({m.participants.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {m.participants.map((p, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agenda items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">
              Notulen Rapat
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({items.length} poin)
              </span>
            </h2>
            <PrintButton />
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada poin notulen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const cfg = TAG_CONFIG[item.tag]
                return (
                  <div key={item.id} className="relative rounded-xl border bg-card p-4 pl-5 overflow-hidden">
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar}`} aria-hidden />
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs text-muted-foreground font-medium">Poin #{idx + 1}</span>
                      <Badge variant="outline" className={`text-[10px] font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <Markdown content={item.discussion} className="text-sm text-foreground/90" />
                    {item.follow_up && (
                      <div className="mt-3 pt-3 border-t flex items-start gap-2 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400 mb-1">
                            Tindak Lanjut
                          </p>
                          <p className="text-sm">{item.follow_up}</p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="print:hidden">
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 font-medium">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  )
}
