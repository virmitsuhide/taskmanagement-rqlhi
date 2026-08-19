'use client'

import { useState, useTransition, useActionState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Copy, Plus, Trash2, X } from 'lucide-react'
import {
  copyHalaqohToTermAction, createTermAction, deleteTermAction, setCurrentTermAction,
} from '@/app/actions/terms'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatTerm } from '@/lib/data/terms'
import type { AcademicTerm } from '@/types'
import type { TermStats } from '@/lib/data/terms'

interface Props {
  terms: AcademicTerm[]
  stats: Record<string, TermStats>
  canManage: boolean
}

export function TermManager({ terms, stats, canManage }: Props) {
  const [adding, setAdding] = useState(false)
  const current = terms.find(t => t.is_current) ?? null

  return (
    <div className="space-y-4">
      {canManage && !adding && (
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />Tahun Ajaran Baru
        </Button>
      )}

      {canManage && adding && <TermForm onDone={() => setAdding(false)} />}

      <div className="space-y-2">
        {terms.map(term => (
          <TermRow
            key={term.id}
            term={term}
            stats={stats[term.id]}
            currentTerm={current}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  )
}

function TermRow({
  term, stats, currentTerm, canManage,
}: {
  term: AcademicTerm
  stats?: TermStats
  currentTerm: AcademicTerm | null
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()

  const halaqohCount = stats?.halaqohCount ?? 0
  const isEmpty = halaqohCount === 0

  function activate() {
    startTransition(async () => {
      const result = await setCurrentTermAction(term.id)
      if (result?.error) toast.error(result.error)
      else toast.success(`${formatTerm(term)} kini semester berjalan`)
    })
  }

  function remove() {
    if (!confirm(`Hapus ${formatTerm(term)}?`)) return
    startTransition(async () => {
      const result = await deleteTermAction(term.id)
      if (result?.error) toast.error(result.error)
      else toast.success('Tahun ajaran dihapus')
    })
  }

  // Menyalin hanya masuk akal dari semester yang sudah punya halaqoh ke
  // semester yang masih kosong — persis alur menyiapkan semester berikutnya.
  const canCopyHere = canManage && isEmpty && currentTerm && currentTerm.id !== term.id
    && (stats?.halaqohCount ?? 0) === 0

  function copyFromCurrent() {
    if (!currentTerm) return
    if (!confirm(
      `Salin kerangka halaqoh dari ${formatTerm(currentTerm)} ke ${formatTerm(term)}?\n\n` +
      'Yang disalin hanya nama, jenjang, dan jadwal sesi. Santri, wali, dan ' +
      'pengampu tidak ikut — keduanya memang diacak ulang tiap semester.',
    )) return

    startTransition(async () => {
      const result = await copyHalaqohToTermAction(currentTerm.id, term.id)
      if (result?.error) toast.error(result.error)
      else toast.success('Kerangka halaqoh disalin')
    })
  }

  return (
    <Card className={term.is_current ? 'border-primary' : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{formatTerm(term)}</p>
            {term.is_current && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                Berjalan
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {term.start_date} → {term.end_date}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEmpty
              ? 'Belum ada halaqoh'
              : `${halaqohCount} halaqoh · ${stats?.studentCount ?? 0} santri · ${stats?.teacherCount ?? 0} guru`}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {canCopyHere && (
              <Button size="sm" variant="outline" disabled={pending} onClick={copyFromCurrent}>
                <Copy className="mr-1 h-3.5 w-3.5" />Salin kerangka
              </Button>
            )}
            {!term.is_current && (
              <Button size="sm" variant="outline" disabled={pending} onClick={activate}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Jadikan berjalan
              </Button>
            )}
            {!term.is_current && isEmpty && (
              <Button
                size="sm" variant="ghost" disabled={pending} onClick={remove}
                className="h-8 w-8 p-0 text-destructive" aria-label="Hapus tahun ajaran"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TermForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await createTermAction(prev, formData)
      if (result.success) {
        toast.success('Tahun ajaran dibuat')
        onDone()
      }
      return result
    },
    null,
  )

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tahun Ajaran Baru</h2>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form action={action} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="year_label">Tahun ajaran</Label>
              <Input id="year_label" name="year_label" required placeholder="2026/2027" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester">Semester</Label>
              <select
                id="semester" name="semester" defaultValue="ganjil"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Mulai</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Selesai</Label>
              <Input id="end_date" name="end_date" type="date" required />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Semester baru dibuat dalam keadaan belum berjalan. Setelah halaqohnya siap,
            barulah dijadikan berjalan — supaya penyusunan tidak mengganggu semester aktif.
          </p>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Menyimpan…' : 'Buat'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
