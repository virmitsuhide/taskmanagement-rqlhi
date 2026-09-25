import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting, canDeleteMeeting, canViewMeeting, MEETING_TYPE_LABELS, AGENDA_TAG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { deleteMeetingAction } from '@/app/actions/meetings'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { PrintButton } from '@/components/rapat/PrintButton'
import { ArrowLeft, Calendar, CheckCircle2, CheckSquare, Circle, Edit, MapPin, Trash2, Users, ExternalLink, FileText } from 'lucide-react'
import { agendaTagStyle } from '@/lib/rapat/agenda-tags'
import { LABEL_STATUS_TUGAS, WARNA_STATUS_TUGAS } from '@/lib/rapat/papan'
import { getTugasPerPoin } from '@/lib/data/papan-rapat'
import { formatRupiah } from '@/lib/finance/period'
import type { Meeting, AgendaItem } from '@/types'

// Warna tag dipakai bersama form notulen — lihat lib/rapat/agenda-tags.ts

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
    .select('*, creator:users!created_by(id, display_name)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!meeting) notFound()
  if (!canViewMeeting(session.role, meeting.type)) redirect('/rapat')

  const { data: agendaItems } = await supabase
    .from('agenda_items')
    .select('*')
    .eq('meeting_id', id)
    .order('order_num')

  const items = (agendaItems ?? []) as AgendaItem[]
  const m = meeting as Meeting
  const tindakLanjut = items.filter(it => it.follow_up)
  const jumlahTindakLanjut = tindakLanjut.length
  const tugasPer = await getTugasPerPoin(tindakLanjut.map(it => it.id))
  /** Selesai = ditandai selesai di Papan Rapat, atau semua tugasnya sudah Selesai. */
  const tuntas = (it: AgendaItem) => {
    const tugas = tugasPer.get(it.id) ?? []
    return Boolean(it.selesai_at) || (tugas.length > 0 && tugas.every(t => t.status === 'done'))
  }
  const jumlahTuntas = tindakLanjut.filter(tuntas).length
  const hadir = m.participants ?? []
  const izin = m.peserta_izin ?? []

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title={m.subject}
        breadcrumbs={[{ label: 'Rapat & Notulen', href: '/rapat' }, { label: m.subject }]}
        ownH1
      />
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-7">
        <div className="flex items-center justify-between gap-2 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link href="/rapat"><ArrowLeft className="h-4 w-4 mr-1" />Kembali</Link>
          </Button>
          <div className="flex gap-2">
            <PrintButton />
            {canEditMeeting(session.role, m.type) && (
              <Button asChild>
                <Link href={`/rapat/${id}/edit`}><Edit className="h-4 w-4" />Sunting notulen</Link>
              </Button>
            )}
            {canDeleteMeeting(session.role, m.type) && (
              <form action={deleteMeetingAction.bind(null, id) as unknown as (fd: FormData) => void}>
                <Button variant="ghost" type="submit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />Hapus
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Kepala rapat: jenis, judul, lalu keterangan dalam satu baris. */}
        <header className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">
            Rapat &amp; notulen · {MEETING_TYPE_LABELS[m.type]}
          </p>
          <h1 className="text-3xl leading-tight md:text-[40px]">{m.subject}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="success">{MEETING_TYPE_LABELS[m.type]}</Badge>
            <InfoRow icon={<Calendar className="h-4 w-4" />} value={`${formatDate(m.date)}${m.start_time ? ` · ${m.start_time}${m.end_time ? `–${m.end_time}` : ''}` : ''}`} />
            {m.location && <InfoRow icon={<MapPin className="h-4 w-4" />} value={m.location} />}
            {m.mc && <InfoRow icon={<Users className="h-4 w-4" />} value={`MC: ${m.mc}`} />}
            {m.notulis && <InfoRow icon={<FileText className="h-4 w-4" />} value={`Notulis: ${m.notulis}`} />}
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* ── Notulen per poin ── */}
          <section className="rounded-2xl border bg-card p-5 md:p-6 lg:col-span-8">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary"><FileText className="h-4 w-4" /></span>
              <div>
                <h2 className="font-heading text-xl font-medium leading-tight">Notulen</h2>
                <p className="text-[13px] text-muted-foreground">{items.length} poin{jumlahTindakLanjut > 0 && ` · ${jumlahTindakLanjut} tindak lanjut`}</p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed py-12 text-center bg-muted/30">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Belum ada poin notulen.</p>
              </div>
            ) : (
              <ol>
                {items.map((item, idx) => {
                  const style = agendaTagStyle(item.tag)
                  const label = AGENDA_TAG_LABELS[item.tag] ?? 'Lainnya'
                  return (
                    <li key={item.id} className="flex gap-4 border-t py-5 first:mt-3">
                      <span className="w-7 shrink-0 font-heading text-3xl leading-none text-accent-warm tabular-nums">{idx + 1}</span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <Badge variant="outline" className={`text-[11px] ${style.badge}`}>{label}</Badge>
                        <Markdown content={item.discussion} className="text-[15px] leading-relaxed text-foreground/90" />
                        {item.tag === 'approval' && (
                          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-4 py-3 text-sm ${
                            item.approval_status === 'disetujui' ? 'bg-success-wash text-success'
                              : item.approval_status === 'ditolak' ? 'bg-destructive-wash text-destructive'
                              : 'bg-warning-wash text-warning'}`}>
                            <b>{item.approval_status === 'disetujui' ? 'Disetujui' : item.approval_status === 'ditolak' ? 'Ditolak' : 'Menunggu keputusan'}</b>
                            {item.butuh_biaya && <span>· {item.biaya != null ? `biaya ${formatRupiah(item.biaya)}` : 'butuh biaya'}</span>}
                            <Link href="/rapat/papan" className="font-semibold underline-offset-2 hover:underline print:hidden">· Papan Rapat →</Link>
                          </div>
                        )}
                        {item.follow_up && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-warning">Tindak lanjut:</span> {item.follow_up}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          {/* ── Kolom samping: tindak lanjut & peserta ── */}
          <div className="min-w-0 space-y-6 lg:col-span-4">
            <section className="rounded-2xl border bg-card p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary"><CheckSquare className="h-4 w-4" /></span>
                <div>
                  <h2 className="font-heading text-xl font-medium leading-tight">Tindak lanjut</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {jumlahTindakLanjut > 0
                      ? `${jumlahTuntas} dari ${jumlahTindakLanjut} selesai`
                      : 'Jadikan tugas supaya terpantau di Papan Tugas'}
                  </p>
                </div>
              </div>
              {jumlahTindakLanjut === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada tindak lanjut tercatat.</p>
              ) : (
                <ul className="space-y-3">
                  {tindakLanjut.map(item => {
                    const tugas = tugasPer.get(item.id) ?? []
                    const selesai = tuntas(item)
                    return (
                      <li key={item.id} className={`rounded-xl border p-3.5 ${selesai ? 'bg-success-wash/40' : ''}`}>
                        <div className="flex items-start gap-2">
                          {selesai
                            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Selesai" />
                            : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="Belum selesai" />}
                          <p className={`text-sm font-semibold leading-snug ${selesai ? 'text-muted-foreground line-through decoration-1' : ''}`}>
                            {item.follow_up}
                          </p>
                        </div>

                        {tugas.length > 0 ? (
                          // Sudah jadi tugas: status dan PIC diambil dari tugasnya.
                          <ul className="mt-2 space-y-1.5 pl-6">
                            {tugas.map(t => (
                              <li key={t.id}>
                                <Link href={`/tasks/${t.id}`} className="group flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                    style={{ color: WARNA_STATUS_TUGAS[t.status], background: `color-mix(in oklab, ${WARNA_STATUS_TUGAS[t.status]} 12%, transparent)` }}
                                  >
                                    {LABEL_STATUS_TUGAS[t.status]}
                                  </span>
                                  <span className="text-muted-foreground group-hover:text-foreground group-hover:underline">
                                    {t.pic ?? 'Tanpa PIC'}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : selesai ? (
                          <p className="mt-1.5 pl-6 text-[12px] text-success">Ditandai selesai di Papan Rapat</p>
                        ) : (
                          <Link
                            href={`/tasks/baru?meeting_id=${id}&agenda_id=${item.id}&title=${encodeURIComponent(item.follow_up!)}`}
                            className="mt-2 ml-6 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline print:hidden"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />Jadikan tugas
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {(hadir.length > 0 || izin.length > 0) && (
              <section className="rounded-2xl border bg-card p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-primary"><Users className="h-4 w-4" /></span>
                  <div>
                    <h2 className="font-heading text-xl font-medium leading-tight">Peserta</h2>
                    <p className="text-[13px] text-muted-foreground">
                      {hadir.length} hadir{izin.length > 0 && ` · ${izin.length} izin`}
                    </p>
                  </div>
                </div>
                <ul className="divide-y">
                  {[...hadir.map(nama => ({ nama, izin: false })), ...izin.map(nama => ({ nama, izin: true }))].map((p, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 py-2 text-[13px]">
                      <span
                        aria-hidden
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${p.izin ? 'bg-muted text-muted-foreground' : 'bg-primary-wash text-primary'}`}
                      >
                        {inisial(p.nama)}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-medium ${p.izin ? 'text-muted-foreground' : ''}`}>{p.nama}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.izin ? 'bg-warning-wash text-warning' : 'bg-success-wash text-success'}`}>
                        {p.izin ? 'Izin' : 'Hadir'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Dua huruf awal nama, tanpa gelar Ust./Ustadzah di depannya. */
function inisial(nama: string): string {
  return nama.replace(/^(Ust(adz|adzah|zh)?\.?)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="shrink-0">{icon}</span>
      <span>{value}</span>
    </span>
  )
}
