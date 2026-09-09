import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

import { getSession } from '@/lib/auth/session'
import { canPurgeMeeting, MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TrashRowActions } from '@/components/rapat/TrashRowActions'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/types'

const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatDate(d: string): string {
  const [y, mo, day] = d.split('-').map(Number)
  return `${day} ${MONTHS_LONG[mo - 1]} ${y}`
}

/** "8 September 2026, 14.57" — waktu pembuangan perlu jam, tanggal rapat tidak. */
function formatMoment(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ` +
    `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

type TrashedMeeting = Meeting & {
  deleted_at: string
  remover?: { display_name: string } | null
  agenda_items?: { count: number }[]
}

export default async function KeranjangSampahRapatPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Keranjang memuat rapat dari SEMUA jenis, termasuk yang jenisnya tidak boleh
  // dilihat peran lain — jadi penjaganya peran, bukan getViewableMeetingTypes.
  if (!canPurgeMeeting(session.role)) redirect('/rapat')

  const supabase = createServerClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, remover:users!deleted_by(display_name), agenda_items(count)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  const meetings = (data ?? []) as TrashedMeeting[]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Keranjang Sampah" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <div>
          <Button asChild size="sm" variant="ghost" className="-ml-2 mb-2">
            <Link href="/rapat"><ArrowLeft className="h-4 w-4" />Kembali ke daftar rapat</Link>
          </Button>
          <p className="text-2xl font-bold leading-tight">Keranjang Sampah Rapat</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meetings.length === 0
              ? 'Kosong'
              : `${meetings.length} rapat dibuang · hanya Anda yang bisa memulihkan atau menghapusnya permanen`}
          </p>
        </div>

        {meetings.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium">Keranjang sampah kosong.</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Rapat yang dihapus dari daftar akan mampir ke sini dulu, bukan langsung hilang.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => (
              <div key={m.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{m.subject}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {MEETING_TYPE_LABELS[m.type]} · {formatDate(m.date)}
                      {m.agenda_items?.[0]?.count
                        ? ` · ${m.agenda_items[0].count} butir agenda`
                        : ' · tanpa agenda'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    Dibuang {formatMoment(m.deleted_at)}
                    {m.remover?.display_name ? ` oleh ${m.remover.display_name}` : ''}
                  </p>
                </div>
                <TrashRowActions
                  meetingId={m.id}
                  subject={m.subject}
                  agendaCount={m.agenda_items?.[0]?.count ?? 0}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
