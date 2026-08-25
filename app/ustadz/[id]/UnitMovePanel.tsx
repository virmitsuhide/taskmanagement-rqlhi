'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRightLeft } from 'lucide-react'
import { pindahUnitGuruAction } from '@/app/actions/teacher-unit'
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Jenjang, TeacherUnitMove } from '@/types'

interface Props {
  teacherId: string
  teacherName: string
  currentUnit: Jenjang | null
  riwayat: TeacherUnitMove[]
}

/** Unit yang bisa dipilih sebagai tujuan mutasi. */
const UNIT_PILIHAN: Jenjang[] = ['sd', 'sd_juara', 'smp', 'paud', 'sma']

const tanggal = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * Panel mutasi unit guru.
 *
 * Yang berpindah hanya penempatan guru MULAI SEKARANG. Nilai KPI bulan-bulan
 * lampau tetap tercatat di unit lamanya — tiap baris penilaian menyimpan
 * sendiri unit tempat guru berada saat itu, sehingga rubrik yang dipakai
 * membacanya juga tetap rubrik lama. Keterangan itu ditulis di layar, bukan
 * hanya di komentar, karena inilah pertanyaan pertama siapa pun yang akan
 * menekan tombol ini.
 */
export function UnitMovePanel({ teacherId, teacherName, currentUnit, riwayat }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [toUnit, setToUnit] = useState<string>('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  function submit() {
    if (!toUnit) return
    const label = JENJANG_LABELS[toUnit as Jenjang]
    if (!confirm(
      `Pindahkan ${teacherName} ke ${label}?\n\n` +
      'Penilaian KPI bulan-bulan sebelumnya TETAP tercatat di unit lama beserta ' +
      'rubrik lamanya, jadi nilainya tidak berubah. Yang berpindah hanya tempat ' +
      'ia dinilai mulai sekarang.',
    )) return

    startTransition(async () => {
      const res = await pindahUnitGuruAction(teacherId, toUnit, date, notes)
      if (res.error) { toast.error(res.error); return }
      toast.success(`${teacherName} dipindahkan ke ${label}`)
      setOpen(false)
      setToUnit('')
      setNotes('')
      router.refresh()
    })
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4" />
        Unit Penempatan
      </h2>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Saat ini di{' '}
            <b>{currentUnit ? JENJANG_LABELS[currentUnit] : 'belum ditentukan'}</b>
          </p>
          {!open && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />Pindahkan
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="to_unit">Unit tujuan</Label>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger id="to_unit" className="w-full">
                    <SelectValue placeholder="Pilih unit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_PILIHAN.filter(u => u !== currentUnit).map(u => (
                      <SelectItem key={u} value={u}>{JENJANG_LABELS[u]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eff_date">Berlaku sejak</Label>
                <Input id="eff_date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="move_notes">Catatan (opsional)</Label>
              <Input
                id="move_notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Alasan mutasi, nomor SK, atau kesepakatan..."
              />
            </div>

            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Nilai KPI bulan-bulan sebelumnya tetap tercatat di unit lama dan tetap dihitung
              dengan rubrik unit itu. SD menargetkan 3 juz (20 poin/juz), SMP 5 juz (12 poin/juz) —
              tanpa pemisahan ini, memindahkan guru akan mengubah nilai lamanya.
            </p>

            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending || !toUnit}>
                {pending ? 'Memindahkan...' : 'Pindahkan'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setToUnit('') }}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {riwayat.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Riwayat mutasi</p>
            <ul className="space-y-1.5">
              {riwayat.map(m => (
                <li key={m.id} className="text-xs text-muted-foreground">
                  <span className="tabular-nums">{tanggal(m.effective_date)}</span>
                  {' — '}
                  {m.from_unit ? JENJANG_LABELS[m.from_unit] : 'tanpa unit'}
                  {' → '}
                  <b className="text-foreground">{JENJANG_LABELS[m.to_unit]}</b>
                  {m.notes && <span className="block text-muted-foreground/80">{m.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
