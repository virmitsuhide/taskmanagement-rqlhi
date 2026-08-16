'use client'

import { useActionState } from 'react'
import { useAgendaItems } from '@/hooks/useMeetings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MEETING_TYPE_LABELS, AGENDA_TAG_LABELS } from '@/lib/auth/permissions'
import { agendaTagStyle } from '@/lib/rapat/agenda-tags'
import type { MeetingType, AgendaTag, Meeting, AgendaItem } from '@/types'

// Tag yang memunculkan kolom "Tindak Lanjut" — isinya bisa dijadikan task
// lewat tombol "Buat Task" di halaman detail rapat.
const TAGS_WITH_FOLLOW_UP: AgendaTag[] = ['tindak_lanjut']

// Placeholder isi diskusi disesuaikan tag — approval butuh detail objek yang disetujui.
const DISCUSSION_PLACEHOLDER: Record<AgendaTag, string> = {
  keputusan:     'Keputusan yang diambil dalam rapat...',
  informasi:     'Informasi yang disampaikan...',
  perlu_diskusi: 'Poin yang belum tuntas dan perlu dibahas di rapat berikutnya...',
  tindak_lanjut: 'Latar belakang tindak lanjut...',
  approval:      'Approval penggunaan anggaran / alokasi SDM / request pengurus — sebutkan nominal, pihak, dan hasil persetujuan...',
}

/** Kelompok field bertajuk, dipisah garis dari kelompok di atasnya. */
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

interface Props {
  allowedTypes: MeetingType[]
  action: (prev: unknown, formData: FormData) => Promise<{ error?: string } | undefined>
  defaultValues?: Meeting & { agenda_items?: AgendaItem[] }
  submitLabel?: string
}

export function MeetingForm({ allowedTypes, action, defaultValues, submitLabel = 'Simpan Rapat' }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const { items, add, remove, update } = useAgendaItems(
    defaultValues?.agenda_items?.map(a => ({
      tag: a.tag,
      discussion: a.discussion,
      follow_up: a.follow_up ?? '',
    }))
  )

  return (
    <form action={formAction} className="space-y-5">
      {defaultValues?.id && (
        <input type="hidden" name="meeting_id" value={defaultValues.id} />
      )}
      <input type="hidden" name="agenda_count" value={items.length} />
      {items.map((item, i) => (
        <input key={`tag-${i}`} type="hidden" name={`agenda_${i}_tag`} value={item.tag} />
      ))}

      {/* ── Detail rapat ─────────────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Detail Rapat</CardTitle>
          <CardDescription>Waktu, tempat, dan siapa saja yang hadir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <FieldGroup title="Identitas">
            {!defaultValues && (
              <div className="space-y-1.5">
                <Label htmlFor="type">Jenis Rapat</Label>
                <Select name="type" defaultValue={allowedTypes[0]} required>
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Pilih jenis rapat" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map(t => (
                      <SelectItem key={t} value={t}>{MEETING_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="subject">Subjek / Topik</Label>
              <Input id="subject" name="subject" defaultValue={defaultValues?.subject} required placeholder="Rapat bulanan divisi..." />
            </div>
          </FieldGroup>

          <FieldGroup title="Waktu & Tempat">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date">Tanggal</Label>
                <Input id="date" name="date" type="date" defaultValue={defaultValues?.date} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Tempat</Label>
                <Input id="location" name="location" defaultValue={defaultValues?.location ?? ''} placeholder="Ruang rapat..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start_time">Jam Mulai</Label>
                <Input id="start_time" name="start_time" type="time" defaultValue={defaultValues?.start_time ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_time">Jam Selesai</Label>
                <Input id="end_time" name="end_time" type="time" defaultValue={defaultValues?.end_time ?? ''} />
              </div>
            </div>
          </FieldGroup>

          <FieldGroup title="Peran & Peserta">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mc">MC</Label>
                <Input id="mc" name="mc" defaultValue={defaultValues?.mc ?? ''} placeholder="Nama pembawa acara..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notulis">Notulis</Label>
                <Input id="notulis" name="notulis" defaultValue={defaultValues?.notulis ?? ''} placeholder="Nama pencatat..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participants">Peserta</Label>
              <Textarea
                id="participants"
                name="participants"
                rows={4}
                defaultValue={defaultValues?.participants?.join('\n') ?? ''}
                placeholder="Nama peserta&#10;Nama peserta lain..."
              />
              <p className="text-xs text-muted-foreground">Tulis satu nama per baris.</p>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* ── Poin notulen ─────────────────────────────────────────────────── */}
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Poin Notulen</CardTitle>
          <CardDescription>
            {items.length} poin — warna di tepi kartu mengikuti tagnya.
          </CardDescription>
          <CardAction>
            <Button type="button" size="sm" variant="outline" onClick={add}>
              <Plus className="mr-1 h-3 w-3" />Tambah Poin
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-3 py-5">
          {items.map((item, i) => {
            const style = agendaTagStyle(item.tag)
            return (
              <div key={i} className="relative overflow-hidden rounded-lg border bg-background">
                <span className={cn('absolute inset-y-0 left-0 w-1', style.bar)} aria-hidden />

                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 py-2 pl-4 pr-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground/10 text-[11px] font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    Poin {i + 1}
                  </span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(i)}
                      aria-label={`Hapus poin ${i + 1}`}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div className="space-y-1.5">
                    <Label>Tag</Label>
                    <Select value={item.tag} onValueChange={v => update(i, 'tag', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(AGENDA_TAG_LABELS) as [AgendaTag, string][]).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            <span className="flex items-center gap-2">
                              <span className={cn('h-2 w-2 rounded-full', agendaTagStyle(val).bar)} aria-hidden />
                              {label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Diskusi / Isi</Label>
                    <RichTextEditor
                      value={item.discussion}
                      onChange={v => update(i, 'discussion', v)}
                      name={`agenda_${i}_discussion`}
                      rows={3}
                      placeholder={`${DISCUSSION_PLACEHOLDER[item.tag as AgendaTag] ?? 'Isi diskusi, keputusan, atau catatan...'} Gunakan **tebal**, *miring*, atau emoji 😊`}
                      required
                    />
                  </div>

                  {TAGS_WITH_FOLLOW_UP.includes(item.tag as AgendaTag) && (
                    <div className="space-y-1.5">
                      <Label>Tindak Lanjut</Label>
                      <Input
                        value={item.follow_up}
                        onChange={e => update(i, 'follow_up', e.target.value)}
                        name={`agenda_${i}_follow_up`}
                        placeholder="Apa yang perlu dilakukan?"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Aksi ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Menyimpan...' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
