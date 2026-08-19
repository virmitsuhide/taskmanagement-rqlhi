'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CornerDownRight, Pencil, X } from 'lucide-react'
import { carryOverMonthlyAction, saveStudentMonthlyAction } from '@/app/actions/student-monthly'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatPeriod, shiftPeriod } from '@/lib/finance/period'
import type { StudentMonthly } from '@/types'

interface Student {
  id: string
  full_name: string
  kelas: string | null
  level_awal: string
}

interface Props {
  period: string
  previousPeriod: string
  halaqohList: { id: string; name: string }[]
  activeHalaqohId: string
  students: Student[]
  monthly: Record<string, StudentMonthly>
}

export function StudentMonthBoard({
  period, previousPeriod, halaqohList, activeHalaqohId, students, monthly,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Student | null>(null)
  const [pending, startTransition] = useTransition()

  function go(next: { periode?: string; halaqoh?: string }) {
    const params = new URLSearchParams({
      periode: next.periode ?? period,
      halaqoh: next.halaqoh ?? activeHalaqohId,
    })
    router.push(`/guru/capaian?${params.toString()}`)
  }

  function carryOver() {
    if (!confirm(
      `Salin capaian akhir ${formatPeriod(previousPeriod)} menjadi capaian awal ${formatPeriod(period)}?\n\n` +
      'Hanya kolom AWAL yang diisi; kolom akhir dibiarkan kosong agar terlihat mana yang belum dinilai bulan ini.',
    )) return

    startTransition(async () => {
      const result = await carryOverMonthlyAction(activeHalaqohId, period, previousPeriod)
      if (result?.error) toast.error(result.error)
      else toast.success('Capaian awal terisi dari bulan lalu')
    })
  }

  const terisi = students.filter(s => monthly[s.id]?.halaman_akhir_tahsin).length

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={activeHalaqohId}
            onChange={e => go({ halaqoh: e.target.value })}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {halaqohList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0"
              onClick={() => go({ periode: shiftPeriod(period, -1) })} aria-label="Bulan sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">{formatPeriod(period)}</span>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0"
              onClick={() => go({ periode: shiftPeriod(period, 1) })} aria-label="Bulan berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button size="sm" variant="outline" disabled={pending || students.length === 0} onClick={carryOver}>
          <CornerDownRight className="mr-1 h-3.5 w-3.5" />
          Isi awal dari {formatPeriod(previousPeriod)}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {students.length} siswa · {terisi} sudah punya capaian akhir bulan ini
      </p>

      {editing && (
        <MonthlyForm
          key={editing.id}
          period={period}
          student={editing}
          record={monthly[editing.id]}
          onDone={() => setEditing(null)}
        />
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 px-3 font-medium">Nama</th>
              <th className="py-2 px-2 font-medium">Level</th>
              <th className="py-2 px-2 font-medium">Tahsin awal → akhir</th>
              <th className="py-2 px-2 font-medium">Tahfidz awal → akhir</th>
              <th className="py-2 px-2 text-right font-medium">Hal.</th>
              <th className="py-2 px-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              const row = monthly[student.id]
              return (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="py-2 px-3">
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{student.kelas ?? '—'}</p>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {row?.level || student.level_awal || '—'}
                  </td>
                  <td className="py-2 px-2">
                    <Arrow from={row?.halaman_awal_tahsin} to={row?.halaman_akhir_tahsin} />
                  </td>
                  <td className="py-2 px-2">
                    <Arrow from={row?.tahfidz_awal} to={row?.tahfidz_akhir} />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{row?.capaian_halaman || '—'}</td>
                  <td className="py-2 px-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => setEditing(student)} aria-label={`Isi capaian ${student.full_name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {students.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Belum ada siswa di halaqoh ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Titik awal → titik akhir. Panah hanya muncul kalau keduanya terisi. */
function Arrow({ from, to }: { from?: string; to?: string }) {
  if (!from && !to) return <span className="text-muted-foreground">—</span>
  return (
    <span>
      {from || <span className="text-muted-foreground">?</span>}
      {to ? <> → <strong>{to}</strong></> : <span className="text-muted-foreground"> → belum</span>}
    </span>
  )
}

function MonthlyForm({
  period, student, record, onDone,
}: {
  period: string
  student: Student
  record?: StudentMonthly
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveStudentMonthlyAction(prev, formData)
      if (result.success) {
        toast.success(`Capaian ${student.full_name} tersimpan`)
        onDone()
      }
      return result
    },
    null,
  )

  return (
    <form action={action} className="rounded-xl border bg-white p-4 space-y-3">
      <input type="hidden" name="student_id" value={student.id} />
      <input type="hidden" name="period" value={period} />

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{student.full_name}</p>
          <p className="text-xs text-muted-foreground">{formatPeriod(period)}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="level">Level</Label>
          <Input id="level" name="level" defaultValue={record?.level ?? student.level_awal}
            placeholder="mis. Jilid 2 / Ghorib / Qur'an T1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capaian_halaman">Jumlah halaman bulan ini</Label>
          <Input id="capaian_halaman" name="capaian_halaman" inputMode="numeric"
            defaultValue={record?.capaian_halaman || ''} placeholder="0" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="halaman_awal_tahsin">Tahsin awal bulan</Label>
          <Input id="halaman_awal_tahsin" name="halaman_awal_tahsin"
            defaultValue={record?.halaman_awal_tahsin ?? ''} placeholder="mis. Jilid 2 hal 23" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="halaman_akhir_tahsin">Tahsin akhir bulan</Label>
          <Input id="halaman_akhir_tahsin" name="halaman_akhir_tahsin"
            defaultValue={record?.halaman_akhir_tahsin ?? ''} placeholder="mis. Jilid 3 hal 5" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tahfidz_awal">Tahfidz awal bulan</Label>
          <Input id="tahfidz_awal" name="tahfidz_awal"
            defaultValue={record?.tahfidz_awal ?? ''} placeholder="mis. An-Naba ayat 10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tahfidz_akhir">Tahfidz akhir bulan</Label>
          <Input id="tahfidz_akhir" name="tahfidz_akhir"
            defaultValue={record?.tahfidz_akhir ?? ''} placeholder="mis. An-Naba ayat 40" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catatan">Catatan</Label>
        <Textarea id="catatan" name="catatan" rows={2} defaultValue={record?.catatan ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan'}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>Batal</Button>
      </div>
    </form>
  )
}
