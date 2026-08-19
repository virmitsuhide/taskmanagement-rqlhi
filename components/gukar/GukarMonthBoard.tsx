'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { saveGukarMonthlyAction, toggleHadirAction } from '@/app/actions/gukar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
import type { GukarMonthly, GukarParticipant } from '@/types'

interface Props {
  groupId: string
  period: string
  participants: GukarParticipant[]
  /** Catatan bulan ini, dipetakan berdasarkan id peserta. */
  monthly: Record<string, GukarMonthly>
}

const PEKAN = [1, 2, 3, 4, 5] as const

/**
 * Papan bulanan satu kelompok pembinaan.
 *
 * Lima kotak kehadiran bisa dicentang langsung dari baris tanpa membuka
 * formulir, karena itulah tindakan yang dilakukan pengampu tiap pekan.
 * Capaian tahsin/tahfidz — yang hanya diisi sekali di akhir bulan — baru
 * memerlukan formulir.
 */
export function GukarMonthBoard({ groupId, period, participants, monthly }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<GukarParticipant | null>(null)

  function goPeriod(next: string) {
    router.push(`/guru/gukar/${groupId}?periode=${next}`)
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => goPeriod(shiftPeriod(period, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{formatPeriod(period)}</span>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
            onClick={() => goPeriod(shiftPeriod(period, 1))} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Centang pekan saat pembinaan berlangsung</p>
      </div>

      {editing && (
        <CapaianForm
          key={editing.id}
          groupId={groupId}
          period={period}
          participant={editing}
          record={monthly[editing.id]}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              {PEKAN.map(p => (
                <th key={p} className="py-2 px-1 text-center font-medium w-10">P{p}</th>
              ))}
              <th className="py-2 px-3 font-medium">Capaian Tahsin</th>
              <th className="py-2 px-3 font-medium">Capaian Tahfidz</th>
              <th className="py-2 px-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {participants.map(participant => (
              <ParticipantRow
                key={participant.id}
                groupId={groupId}
                period={period}
                participant={participant}
                record={monthly[participant.id]}
                onEdit={() => setEditing(participant)}
              />
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted-foreground">
                  Belum ada peserta di kelompok ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParticipantRow({
  groupId, period, participant, record, onEdit,
}: {
  groupId: string
  period: string
  participant: GukarParticipant
  record?: GukarMonthly
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()

  function toggle(pekan: number, next: boolean) {
    startTransition(async () => {
      const result = await toggleHadirAction(groupId, participant.id, period, pekan, next)
      if (result?.error) toast.error(result.error)
    })
  }

  const hadir = (pekan: number) =>
    Boolean(record?.[`hadir_${pekan}` as 'hadir_1' | 'hadir_2' | 'hadir_3' | 'hadir_4' | 'hadir_5'])

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3">
        <p className="font-medium">{participant.full_name}</p>
        <p className="text-xs text-muted-foreground">
          {[participant.kind, participant.unit, participant.level_awal].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>
      {PEKAN.map(pekan => (
        <td key={pekan} className="py-2 px-1 text-center">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={hadir(pekan)}
            disabled={pending}
            onChange={e => toggle(pekan, e.target.checked)}
            aria-label={`Hadir pekan ${pekan} — ${participant.full_name}`}
          />
        </td>
      ))}
      <td className="py-2 px-3 text-muted-foreground">{record?.capaian_tahsin || '—'}</td>
      <td className="py-2 px-3 text-muted-foreground">{record?.capaian_tahfidz || '—'}</td>
      <td className="py-2 px-2 text-right">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Isi capaian">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}

function CapaianForm({
  groupId, period, participant, record, onDone,
}: {
  groupId: string
  period: string
  participant: GukarParticipant
  record?: GukarMonthly
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveGukarMonthlyAction(prev, formData)
      if (result.success) {
        toast.success(`Catatan ${participant.full_name} tersimpan`)
        onDone()
      }
      return result
    },
    null,
  )

  return (
    <form action={action} className="rounded-lg border p-4 space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="participant_id" value={participant.id} />
      <input type="hidden" name="period" value={period} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{participant.full_name}</p>
          <p className="text-xs text-muted-foreground">{formatPeriod(period)}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="capaian_tahsin">Capaian Tahsin</Label>
          <Input
            id="capaian_tahsin" name="capaian_tahsin"
            defaultValue={record?.capaian_tahsin ?? ''}
            placeholder="mis. Syajaroh 1 hal 32"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capaian_tahfidz">Capaian Tahfidz</Label>
          <Input
            id="capaian_tahfidz" name="capaian_tahfidz"
            defaultValue={record?.capaian_tahfidz ?? ''}
            placeholder="mis. An-Naba 1–20"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="jumlah_halaman">Jumlah halaman bulan ini</Label>
          <Input
            id="jumlah_halaman" name="jumlah_halaman" inputMode="numeric"
            defaultValue={record?.jumlah_halaman || ''} placeholder="0"
          />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Kehadiran</legend>
          <div className="flex gap-3">
            {PEKAN.map(pekan => (
              <label key={pekan} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox" name={`hadir_${pekan}`}
                  defaultChecked={Boolean(record?.[`hadir_${pekan}` as 'hadir_1'])}
                  className="h-4 w-4"
                />
                P{pekan}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={record?.catatan ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Batal</Button>
      </div>
    </form>
  )
}
