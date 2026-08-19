'use client'

import { useState, useActionState } from 'react'
import { Copy } from 'lucide-react'
import { copyBudgetsAction, saveBudgetsAction } from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatPeriod, formatRupiah } from '@/lib/finance/period'
import type { BudgetRow } from '@/lib/finance/report'
import type { FinanceAccount } from '@/types'

interface Props {
  period: string
  accounts: FinanceAccount[]
  incomeRows: BudgetRow[]
  expenseRows: BudgetRow[]
  /** Bulan sebelumnya, hanya kalau anggarannya sudah ada. */
  previousPeriod: string | null
  canManage: boolean
}

/**
 * Anggaran satu bulan disunting sebagai satu form untuk semua pos — bukan
 * baris per baris. Penyusunan anggaran memang dikerjakan sekali duduk, dan
 * menyimpannya sekaligus mencegah periode yang setengah terisi.
 */
export function BudgetForm({ period, accounts, incomeRows, expenseRows, previousPeriod, canManage }: Props) {
  const [state, action, pending] = useActionState(saveBudgetsAction, null)
  const [copying, setCopying] = useState(false)

  const slugToId = new Map(accounts.map(a => [`${a.kind}:${a.slug}`, a.id]))

  async function copyFromPrevious() {
    if (!previousPeriod) return
    setCopying(true)
    const result = await copyBudgetsAction(previousPeriod, period)
    if (result.error) alert(result.error)
    setCopying(false)
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="period" value={period} />

      {canManage && previousPeriod && (
        <Button type="button" size="sm" variant="outline" disabled={copying} onClick={copyFromPrevious}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {copying ? 'Menyalin…' : `Salin anggaran ${formatPeriod(previousPeriod)}`}
        </Button>
      )}

      <BudgetTable
        title="Anggaran Pemasukan"
        rows={incomeRows}
        kind="pemasukan"
        slugToId={slugToId}
        canManage={canManage}
      />
      <BudgetTable
        title="Anggaran Pengeluaran"
        rows={expenseRows}
        kind="pengeluaran"
        slugToId={slugToId}
        canManage={canManage}
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600 dark:text-emerald-400">Anggaran tersimpan.</p>}

      {canManage && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Anggaran'}
        </Button>
      )}
    </form>
  )
}

function BudgetTable({
  title, rows, kind, slugToId, canManage,
}: {
  title: string
  rows: BudgetRow[]
  kind: 'pemasukan' | 'pengeluaran'
  slugToId: Map<string, string>
  canManage: boolean
}) {
  const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0)
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0)

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 text-sm font-semibold">{title}</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Pos</th>
                <th className="py-2 px-2 text-right font-medium">Anggaran (Rp)</th>
                <th className="py-2 px-2 text-right font-medium">Realisasi</th>
                <th className="py-2 pl-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const id = slugToId.get(`${kind}:${row.slug}`)
                return (
                  <tr key={row.slug} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{row.name}</td>
                    <td className="py-1.5 px-2 text-right">
                      {canManage && id ? (
                        <Input
                          name={`budget_${id}`}
                          inputMode="numeric"
                          defaultValue={row.budget || ''}
                          placeholder="0"
                          className="h-8 w-36 text-right tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums">{row.budget ? formatRupiah(row.budget) : '—'}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                      {row.actual ? formatRupiah(row.actual) : '—'}
                    </td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">
                      {row.budget ? `${row.percent}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              <tr className="font-semibold">
                <td className="py-2 pr-2">TOTAL</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatRupiah(totalBudget)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatRupiah(totalActual)}</td>
                <td className="py-2 pl-2 text-right tabular-nums">
                  {totalBudget ? `${Math.round((totalActual / totalBudget) * 100)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
