'use client'

import { useActionState } from 'react'
import { CalendarDays, CalendarRange, CalendarClock, CalendarCheck2 } from 'lucide-react'
import { createRoutineTaskAction } from '@/app/actions/rutin'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DeskripsiMention } from '@/components/rutin/DeskripsiMention'
import type { PengurusMention } from '@/lib/rutin/bersama'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CADENCES, CADENCE_LABELS, CADENCE_RESET_LABELS } from '@/lib/rutin/periode'
import type { RoutineCadence } from '@/types'

/**
 * Form tambah tugas rutin. Hanya dua isian — deskripsi dan iramanya — karena
 * memang cuma itu yang menentukan sebuah tugas rutin; tenggat dan penerima
 * tidak berlaku di sini (pekerjaannya berulang). Rekan untuk tugas bersama
 * disebut langsung di deskripsinya dengan @jabatan (0073).
 */

const CADENCE_ICON: Record<RoutineCadence, React.ComponentType<{ className?: string }>> = {
  pekanan: CalendarDays,
  bulanan: CalendarRange,
  semesteran: CalendarClock,
  tahunan: CalendarCheck2,
}

export function RoutineForm({ defaultCadence, pengurus }: { defaultCadence?: RoutineCadence; pengurus: PengurusMention[] }) {
  const [state, action, isPending] = useActionState(createRoutineTaskAction, null)

  return (
    <form action={action} className="space-y-5">
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Tugas Rutin Baru</CardTitle>
          <CardDescription>
            Pekerjaan yang Anda ulang menurut kalender — tiap pekan, bulan, semester, atau tahun ajaran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="description">Deskripsi Tugas</Label>
            <DeskripsiMention
              id="description"
              name="description"
              rows={3}
              required
              maxLength={300}
              pengurus={pengurus}
              placeholder="mis. Rekap setoran hafalan seluruh halaqoh — atau: Rekrutmen guru Qur'an bersama @SDM"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Irama Pengulangan</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CADENCES.map(c => {
                const Icon = CADENCE_ICON[c]
                return (
                  <label
                    key={c}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="cadence"
                      value={c}
                      defaultChecked={c === (defaultCadence ?? 'pekanan')}
                      className="mt-1 accent-primary"
                      required
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {CADENCE_LABELS[c]}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {CADENCE_RESET_LABELS[c]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Menyimpan…' : 'Tambahkan ke Daftar Rutin'}
          </Button>
        </div>
      </div>
    </form>
  )
}
