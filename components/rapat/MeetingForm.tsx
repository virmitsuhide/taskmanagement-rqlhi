'use client'

import { useActionState } from 'react'
import { useAgendaItems } from '@/hooks/useMeetings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Plus, Trash2 } from 'lucide-react'
import { MEETING_TYPE_LABELS } from '@/lib/auth/permissions'
import type { MeetingType, AgendaTag, Meeting, AgendaItem } from '@/types'

const AGENDA_TAG_LABELS: Record<AgendaTag, string> = {
  keputusan: 'Keputusan',
  informasi: 'Informasi',
  hasil_diskusi: 'Hasil Diskusi',
  tindak_lanjut: 'Tindak Lanjut',
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
    <form action={formAction} className="space-y-6">
      {defaultValues?.id && (
        <input type="hidden" name="meeting_id" value={defaultValues.id} />
      )}
      <input type="hidden" name="agenda_count" value={items.length} />
      {items.map((item, i) => (
        <input key={`tag-${i}`} type="hidden" name={`agenda_${i}_tag`} value={item.tag} />
      ))}

      {/* Meeting metadata */}
      <div className="grid gap-4">
        {!defaultValues && (
          <div className="space-y-1.5">
            <Label htmlFor="type">Jenis Rapat</Label>
            <Select name="type" defaultValue={allowedTypes[0]} required>
              <SelectTrigger>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Tanggal</Label>
            <Input id="date" name="date" type="date" defaultValue={defaultValues?.date} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Tempat</Label>
            <Input id="location" name="location" defaultValue={defaultValues?.location ?? ''} placeholder="Ruang rapat..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start_time">Jam Mulai</Label>
            <Input id="start_time" name="start_time" type="time" defaultValue={defaultValues?.start_time ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_time">Jam Selesai</Label>
            <Input id="end_time" name="end_time" type="time" defaultValue={defaultValues?.end_time ?? ''} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mc">MC</Label>
            <Input id="mc" name="mc" defaultValue={defaultValues?.mc ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notulis">Notulis</Label>
            <Input id="notulis" name="notulis" defaultValue={defaultValues?.notulis ?? ''} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="participants">Peserta (satu per baris)</Label>
          <Textarea
            id="participants"
            name="participants"
            rows={4}
            defaultValue={defaultValues?.participants?.join('\n') ?? ''}
            placeholder="Nama peserta&#10;Nama peserta lain..."
          />
        </div>
      </div>

      <Separator />

      {/* Agenda items */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Poin Notulen</h3>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-3 w-3 mr-1" />Tambah Poin
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">Poin {i + 1}</span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(i)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Tag</Label>
                <Select
                  value={item.tag}
                  onValueChange={v => update(i, 'tag', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(AGENDA_TAG_LABELS) as [AgendaTag, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
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
                  placeholder="Isi diskusi, keputusan, atau catatan... Gunakan **tebal**, *miring*, atau emoji 😊"
                  required
                />
              </div>

              {item.tag === 'tindak_lanjut' && (
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
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Menyimpan...' : submitLabel}
      </Button>
    </form>
  )
}
