'use client'

import { useState, useActionState } from 'react'
import { Plus, Settings2, Trash2, X } from 'lucide-react'
import {
  deleteTrustEntryAction, saveTrustEntryAction, saveTrustOpeningAction,
} from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPeriod, formatRupiah } from '@/lib/finance/period'
import type { TrustFundReport } from '@/lib/finance/report'
import type { FinanceTrustFund } from '@/types'

interface Props {
  period: string
  funds: FinanceTrustFund[]
  reports: TrustFundReport[]
  canManage: boolean
}

export function TrustFundManager({ period, funds, reports, canManage }: Props) {
  return (
    <div className="space-y-4">
      {reports.map(report => {
        const fund = funds.find(f => f.slug === report.slug)
        if (!fund) return null
        return (
          <FundCard key={fund.id} period={period} fund={fund} report={report} canManage={canManage} />
        )
      })}
      {reports.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">Belum ada buku dana titipan.</p>
      )}
    </div>
  )
}

function FundCard({
  period, fund, report, canManage,
}: {
  period: string
  fund: FinanceTrustFund
  report: TrustFundReport
  canManage: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [editingOpening, setEditingOpening] = useState(false)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{fund.name}</h2>
          {canManage && (
            <div className="flex gap-1">
              <Button
                size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => setEditingOpening(v => !v)}
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" />Saldo awal buku
              </Button>
              {!adding && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Mutasi
                </Button>
              )}
            </div>
          )}
        </div>

        {editingOpening && canManage && (
          <OpeningForm fund={fund} onDone={() => setEditingOpening(false)} />
        )}

        {adding && canManage && (
          <EntryForm fund={fund} period={period} onDone={() => setAdding(false)} />
        )}

        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2">Saldo Awal {formatPeriod(period)}</td>
              <td className="py-2 text-right tabular-nums">{formatRupiah(report.opening)}</td>
              {canManage && <td className="w-8" />}
            </tr>
            {report.entries.map(entry => (
              <tr key={entry.id} className="border-b">
                <td className="py-1.5">
                  <span className="mr-1 text-muted-foreground">
                    ({entry.amount < 0 ? '−' : '+'})
                  </span>
                  {entry.description}
                  <span className="ml-1 text-xs text-muted-foreground">{entry.entry_date}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {entry.amount < 0 ? '−' : ''}{formatRupiah(Math.abs(entry.amount))}
                </td>
                {canManage && (
                  <td className="py-1.5 text-right">
                    <DeleteEntryButton id={entry.id} />
                  </td>
                )}
              </tr>
            ))}
            {report.entries.length === 0 && (
              <tr className="border-b">
                <td className="py-2 text-muted-foreground" colSpan={canManage ? 3 : 2}>
                  Tidak ada mutasi bulan ini.
                </td>
              </tr>
            )}
            <tr className="font-semibold">
              <td className="py-2">Saldo Akhir {formatPeriod(period)}</td>
              <td className="py-2 text-right tabular-nums">{formatRupiah(report.closing)}</td>
              {canManage && <td />}
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function DeleteEntryButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false)

  async function remove() {
    if (!confirm('Hapus mutasi ini?')) return
    setPending(true)
    const result = await deleteTrustEntryAction(id)
    if (result.error) {
      alert(result.error)
      setPending(false)
    }
  }

  return (
    <Button
      size="sm" variant="ghost" disabled={pending}
      className="h-7 w-7 p-0 text-destructive" onClick={remove} aria-label="Hapus mutasi"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}

function EntryForm({ fund, period, onDone }: { fund: FinanceTrustFund; period: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveTrustEntryAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    null,
  )

  return (
    <form action={action} className="mb-3 space-y-3 rounded-md border p-3">
      <input type="hidden" name="fund_id" value={fund.id} />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Mutasi baru</p>
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`date-${fund.id}`} className="text-xs">Tanggal</Label>
          <Input
            id={`date-${fund.id}`} name="entry_date" type="date" required
            defaultValue={`${period}-01`} className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dir-${fund.id}`} className="text-xs">Arah</Label>
          <select
            id={`dir-${fund.id}`} name="direction" defaultValue="keluar"
            className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="masuk">Dana masuk (+)</option>
            <option value="keluar">Dana diambil (−)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`amt-${fund.id}`} className="text-xs">Nominal (Rp)</Label>
          <Input id={`amt-${fund.id}`} name="amount" inputMode="numeric" required className="h-8" placeholder="30.000" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`desc-${fund.id}`} className="text-xs">Keterangan</Label>
        <Input
          id={`desc-${fund.id}`} name="description" required className="h-8"
          placeholder="pemateri pembinaan jumat 17/4"
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="sm" className="h-8" disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan Mutasi'}
      </Button>
    </form>
  )
}

/**
 * Saldo pembuka buku — bukan saldo awal bulan. Diisi sekali saat modul mulai
 * dipakai, untuk memindahkan saldo berjalan dari pembukuan sebelumnya.
 */
function OpeningForm({ fund, onDone }: { fund: FinanceTrustFund; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveTrustOpeningAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    null,
  )

  return (
    <form action={action} className="mb-3 space-y-3 rounded-md border border-dashed p-3">
      <input type="hidden" name="fund_id" value={fund.id} />
      <p className="text-xs text-muted-foreground">
        Saldo pembuka buku ini, dipakai sebagai titik nol perhitungan. Semua mutasi
        setelah tanggal ini ditumpuk di atasnya.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`open-date-${fund.id}`} className="text-xs">Berlaku sejak</Label>
          <Input
            id={`open-date-${fund.id}`} name="opening_date" type="date" required
            defaultValue={fund.opening_date} className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`open-amt-${fund.id}`} className="text-xs">Saldo awal (Rp)</Label>
          <Input
            id={`open-amt-${fund.id}`} name="opening_balance" inputMode="numeric"
            defaultValue={fund.opening_balance || ''} className="h-8" placeholder="10.427.230"
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-8" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Saldo Awal'}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDone}>Batal</Button>
      </div>
    </form>
  )
}
