'use client'

import { useActionState } from 'react'
import { CalendarDays, CalendarRange } from 'lucide-react'
import { createRoutineTaskAction } from '@/app/actions/rutin'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CADENCES, CADENCE_LABELS } from '@/lib/rutin/periode'
import type { RoutineCadence } from '@/types'

/**
 * Form tambah tugas rutin. Hanya dua isian — deskripsi dan iramanya — karena
 * memang cuma itu yang menentukan sebuah tugas rutin; tenggat dan penerima
 * tidak berlaku di sini (pekerjaannya berulang, dan pemiliknya sendiri yang
 * mengerjakan).
 */

const CADENCE_DESC: Record<RoutineCadence, string> = {
  pekanan: 'Dicentang ulang tiap Senin',
  bulanan: 'Dicentang ulang tiap tanggal 1',
}

const CADENCE_ICON: Record<RoutineCadence, React.ComponentType<{ className?: string }>> = {
  pekanan: CalendarDays,
  bulanan: CalendarRange,
}

export function RoutineForm({ defaultCadence }: { defaultCadence?: RoutineCadence }) {
  const [state, action, isPending] = useActionState(createRoutineTaskAction, null)

  return (
    <form action={action} className="space-y-5">
      <Card className="gap-0 border py-0 shadow-sm ring-0">
        <CardHeader className="border-b bg-muted/40 py-3.5">
          <CardTitle>Tugas Rutin Baru</CardTitle>
          <CardDescription>
            Pekerjaan yang Anda ulang tiap pekan atau tiap bulan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="description">Deskripsi Tugas</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              required
              maxLength={300}
              placeholder="mis. Rekap setoran hafalan seluruh halaqoh"
            />
            <p className="text-[11px] text-muted-foreground">
              Tulis sejelas mungkin — inilah yang akan Anda baca tiap pekan di daftar centang.
            </p>
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
                        {CADENCE_DESC[c]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {state?.error && (
          <p className="border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="p-4">
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Menyimpan…' : 'Tambahkan ke Checklist'}
          </Button>
        </div>
      </div>
    </form>
  )
}
