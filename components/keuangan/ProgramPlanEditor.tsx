'use client'

import { useState, useActionState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { deleteProgramPlanAction, saveProgramPlanAction } from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatAngka, formatRupiah } from '@/lib/finance/period'
import type { FinanceProgramPlan } from '@/types'

interface Props {
  /** Bulan yang direncanakan — laporan April memuat rencana Mei. */
  period: string
  plans: FinanceProgramPlan[]
  canManage: boolean
}

export function ProgramPlanEditor({ period, plans, canManage }: Props) {
  const [adding, setAdding] = useState(false)
  const total = plans.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-2">
      <table className="report-table">
        <thead>
          <tr>
            <th>Program</th>
            <th>Sumber Dana</th>
            <th className="num-cell">Jumlah (Rp)</th>
            {/* Kolom aksi tidak ikut tercetak — lebar nol saat print. */}
            {canManage && <th className="w-8 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {plans.map(plan => (
            <tr key={plan.id}>
              <td>{plan.name}</td>
              <td>{plan.funding_source || '-'}</td>
              <td className="num-cell">{formatAngka(plan.amount)}</td>
              {canManage && (
                <td className="print:hidden" style={{ textAlign: 'right' }}>
                  <DeletePlanButton id={plan.id} />
                </td>
              )}
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={canManage ? 4 : 3}>Belum ada rencana program.</td>
            </tr>
          )}
          <tr className="total">
            <td colSpan={2}>TOTAL PROGRAM</td>
            <td className="num-cell">{formatAngka(total)}</td>
            {canManage && <td className="print:hidden" />}
          </tr>
        </tbody>
      </table>

      {canManage && !adding && (
        <Button size="sm" variant="outline" className="h-8 print:hidden" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />Tambah Rencana
        </Button>
      )}

      {canManage && adding && <PlanForm period={period} onDone={() => setAdding(false)} />}

      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          Total rencana {formatRupiah(total)}. Setelah terealisasi, catat sebagai pengeluaran pos Program.
        </p>
      )}
    </div>
  )
}

function DeletePlanButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false)

  async function remove() {
    if (!confirm('Hapus rencana ini?')) return
    setPending(true)
    const result = await deleteProgramPlanAction(id)
    if (result.error) {
      alert(result.error)
      setPending(false)
    }
  }

  return (
    <Button
      size="sm" variant="ghost" disabled={pending}
      className="h-7 w-7 p-0 text-destructive print:hidden" onClick={remove} aria-label="Hapus rencana"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}

function PlanForm({ period, onDone }: { period: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveProgramPlanAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    null,
  )

  return (
    <form action={action} className="space-y-3 rounded-md border p-3 print:hidden">
      <input type="hidden" name="period" value={period} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Rencana program baru</p>
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="plan-name" className="text-xs">Program</Label>
          <Input id="plan-name" name="name" required className="h-8" placeholder="Video pembelajaran SD" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plan-source" className="text-xs">Sumber dana</Label>
          <Input id="plan-source" name="funding_source" className="h-8" placeholder="RQ (dari iuran SD)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="plan-amount" className="text-xs">Jumlah (Rp)</Label>
          <Input id="plan-amount" name="amount" inputMode="numeric" className="h-8" placeholder="967.000" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}
