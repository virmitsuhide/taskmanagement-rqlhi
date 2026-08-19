'use client'

import { useState, useTransition, useActionState } from 'react'
import { toast } from 'sonner'
import { Clock, Plus, Trash2, X } from 'lucide-react'
import { deleteSessionAction, saveSessionAction } from '@/app/actions/terms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DAY_LABELS, type HalaqohSession } from '@/types'

interface Props {
  halaqohId: string
  sessions: HalaqohSession[]
  canManage: boolean
}

/**
 * Jadwal sesi sebuah halaqoh.
 *
 * Sesi menempel pada halaqoh, bukan pada guru — jadwal kelompok relatif tetap
 * sementara pengampunya bisa berganti tiap semester. Beban mengajar guru OS
 * ("2 sesi" / "3 sesi") dihitung dari sesi halaqoh yang diampunya, jadi
 * mengisi jadwal di sini sekaligus menegakkan dasar perhitungan Gaji OS.
 */
export function SessionEditor({ halaqohId, sessions, canManage }: Props) {
  const [adding, setAdding] = useState(false)

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />Jadwal Sesi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length === 0
              ? 'Belum ada sesi — beban mengajar guru belum bisa dihitung.'
              : `${sessions.length} sesi per pekan`}
          </p>
        </div>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />Tambah Sesi
          </Button>
        )}
      </div>

      {canManage && adding && (
        <SessionForm halaqohId={halaqohId} onDone={() => setAdding(false)} />
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Belum ada jadwal sesi.
        </div>
      ) : (
        <ul className="rounded-lg border divide-y bg-card">
          {sessions.map(session => (
            <li key={session.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {DAY_LABELS[session.day_of_week] ?? `Hari ${session.day_of_week}`}
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    {session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}
                  </span>
                </p>
                {session.note && <p className="text-xs text-muted-foreground">{session.note}</p>}
              </div>
              {canManage && (
                <DeleteSessionButton id={session.id} halaqohId={halaqohId} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DeleteSessionButton({ id, halaqohId }: { id: string; halaqohId: string }) {
  const [pending, startTransition] = useTransition()

  function remove() {
    if (!confirm('Hapus sesi ini?')) return
    startTransition(async () => {
      const result = await deleteSessionAction(id, halaqohId)
      if (result?.error) toast.error(result.error)
      else toast.success('Sesi dihapus')
    })
  }

  return (
    <Button
      size="sm" variant="ghost" disabled={pending} onClick={remove}
      className="h-7 w-7 p-0 text-destructive" aria-label="Hapus sesi"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}

function SessionForm({ halaqohId, onDone }: { halaqohId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveSessionAction(prev, formData)
      if (result.success) {
        toast.success('Sesi ditambahkan')
        onDone()
      }
      return result
    },
    null,
  )

  return (
    <form action={action} className="mb-3 space-y-3 rounded-md border p-3">
      <input type="hidden" name="halaqoh_id" value={halaqohId} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Sesi baru</p>
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="day_of_week" className="text-xs">Hari</Label>
          <select
            id="day_of_week" name="day_of_week" defaultValue="1"
            className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            {Object.entries(DAY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="start_time" className="text-xs">Mulai</Label>
          <Input id="start_time" name="start_time" type="time" required defaultValue="07:30" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end_time" className="text-xs">Selesai</Label>
          <Input id="end_time" name="end_time" type="time" required defaultValue="08:30" className="h-8" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="note" className="text-xs">Keterangan (opsional)</Label>
        <Input id="note" name="note" className="h-8" placeholder="mis. sesi tahfidz" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan Sesi'}
      </Button>
    </form>
  )
}
