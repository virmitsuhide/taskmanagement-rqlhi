'use client'

import { useMemo, useState, useActionState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  deleteTransactionAction, saveTransactionAction, settleReceivableAction,
} from '@/app/actions/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatPeriod, formatRupiah, toPeriodKey } from '@/lib/finance/period'
import type { Receivable } from '@/lib/finance/report'
import type { FinanceAccount, FinanceTransaction } from '@/types'

type Tab = 'pemasukan' | 'pengeluaran' | 'piutang'

interface Props {
  period: string
  tab: Tab
  accounts: FinanceAccount[]
  /** Transaksi yang uangnya berpindah pada periode ini. */
  settled: FinanceTransaction[]
  receivables: Receivable[]
  canManage: boolean
}

export function TransactionManager({ period, tab, accounts, settled, receivables, canManage }: Props) {
  const [editing, setEditing] = useState<FinanceTransaction | null>(null)
  const [creatingFor, setCreatingFor] = useState<'pemasukan' | 'pengeluaran' | null>(null)

  const incomeAccounts = useMemo(() => accounts.filter(a => a.kind === 'pemasukan' && a.is_active), [accounts])
  const expenseAccounts = useMemo(() => accounts.filter(a => a.kind === 'pengeluaran' && a.is_active), [accounts])
  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const visible = tab === 'pemasukan' ? incomeAccounts : expenseAccounts

  function closeForm() {
    setEditing(null)
    setCreatingFor(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(['pemasukan', 'pengeluaran', 'piutang'] as Tab[]).map(t => (
          <Link
            key={t}
            href={`/keuangan/transaksi?periode=${period}&tab=${t}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm capitalize transition-colors',
              tab === t ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {t}
            {t === 'piutang' && receivables.length > 0 && (
              <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">{receivables.length}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === 'piutang' ? (
        <ReceivableList receivables={receivables} canManage={canManage} />
      ) : (
        <>
          {canManage && !editing && !creatingFor && (
            <Button size="sm" onClick={() => setCreatingFor(tab)}>
              <Plus className="mr-1 h-4 w-4" />
              Catat {tab === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
            </Button>
          )}

          {canManage && (editing || creatingFor) && (
            <TransactionForm
              key={editing?.id ?? 'baru'}
              period={period}
              transaction={editing}
              kind={editing ? (byId.get(editing.account_id)?.kind ?? 'pemasukan') : creatingFor!}
              accounts={editing ? (byId.get(editing.account_id)?.kind === 'pengeluaran' ? expenseAccounts : incomeAccounts) : visible}
              incomeAccounts={incomeAccounts}
              onDone={closeForm}
            />
          )}

          {/* Dikelompokkan per pos supaya bentuknya sama dengan tabel laporan. */}
          <div className="space-y-3">
            {visible.map(account => {
              const items = settled.filter(t => t.account_id === account.id)
              const total = items.reduce((sum, t) => sum + t.amount, 0)

              return (
                <Card key={account.id}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{account.name}</p>
                        {account.hint && (
                          <p className="truncate text-xs text-muted-foreground">{account.hint}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatRupiah(total)}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada transaksi bulan ini.</p>
                    ) : (
                      <ul className="divide-y">
                        {items.map(trx => (
                          <TransactionRow
                            key={trx.id}
                            trx={trx}
                            period={period}
                            canManage={canManage}
                            onEdit={() => { setCreatingFor(null); setEditing(trx) }}
                          />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function TransactionRow({
  trx, period, canManage, onEdit,
}: {
  trx: FinanceTransaction
  period: string
  canManage: boolean
  onEdit: () => void
}) {
  const [pending, setPending] = useState(false)
  // Tagihan bulan lain yang cair bulan ini — konteks yang hilang kalau hanya
  // nominalnya yang ditampilkan.
  const fromOtherPeriod = toPeriodKey(trx.period) !== period

  async function remove() {
    if (!confirm('Hapus transaksi ini?')) return
    setPending(true)
    const result = await deleteTransactionAction(trx.id)
    if (result.error) {
      alert(result.error)
      setPending(false)
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm">{trx.description || <span className="text-muted-foreground">Tanpa keterangan</span>}</p>
        <p className="text-xs text-muted-foreground">
          {trx.paid_at}
          {fromOtherPeriod && ` · tagihan ${formatPeriod(toPeriodKey(trx.period))}`}
          {(trx.funding?.length ?? 0) > 0 && ` · ${trx.funding!.length} sumber dana`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm tabular-nums">{formatRupiah(trx.amount)}</span>
        {canManage && (
          <>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit} aria-label="Sunting">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost" disabled={pending}
              className="h-7 w-7 p-0 text-destructive" onClick={remove} aria-label="Hapus"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function TransactionForm({
  period, transaction, kind, accounts, incomeAccounts, onDone,
}: {
  period: string
  transaction: FinanceTransaction | null
  kind: 'pemasukan' | 'pengeluaran'
  accounts: FinanceAccount[]
  incomeAccounts: FinanceAccount[]
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const result = await saveTransactionAction(prev, formData)
      if (result.success) onDone()
      return result
    },
    null,
  )

  const [status, setStatus] = useState(transaction?.status ?? 'lunas')
  const fundingOf = (slug: string) =>
    transaction?.funding?.find(f => f.source_slug === slug)?.amount ?? ''

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {transaction ? 'Sunting' : 'Catat'} {kind === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
          </h2>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDone} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={transaction?.id ?? ''} />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account_id">Pos</Label>
              <select
                id="account_id" name="account_id" required
                defaultValue={transaction?.account_id ?? ''}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="" disabled>Pilih pos…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Nominal (Rp)</Label>
              <Input
                id="amount" name="amount" required inputMode="numeric"
                defaultValue={transaction?.amount ?? ''}
                placeholder="36.380.000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan</Label>
            <Textarea
              id="description" name="description" rows={2}
              defaultValue={transaction?.description ?? ''}
              placeholder="MoU April SD"
            />
            <p className="text-xs text-muted-foreground">
              Keterangan tiap transaksi dirangkai jadi kolom Keterangan di tabel laporan.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period">Bulan tagihan</Label>
              <Input
                id="period" name="period" type="month" required
                defaultValue={transaction ? toPeriodKey(transaction.period) : period}
              />
              <p className="text-xs text-muted-foreground">Bulan yang ditagihkan, belum tentu bulan uangnya masuk.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paid_at">Tanggal uang berpindah</Label>
              <Input
                id="paid_at" name="paid_at" type="date"
                defaultValue={transaction?.paid_at ?? ''}
                disabled={status === 'piutang'}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={status === 'piutang'}
                  onChange={e => setStatus(e.target.checked ? 'piutang' : 'lunas')}
                  className="h-3.5 w-3.5"
                />
                Belum tertunaikan (piutang)
              </label>
            </div>
          </div>

          {/* Matriks dana sumber — hanya relevan untuk pengeluaran. */}
          {kind === 'pengeluaran' && (
            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-xs font-medium">Dana sumber (opsional)</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Isi kalau pengeluaran ini dibiayai pos pemasukan tertentu. Kalau diisi,
                totalnya harus sama persis dengan nominal di atas.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {incomeAccounts.map(a => (
                  <div key={a.slug} className="flex items-center gap-2">
                    <Label htmlFor={`funding_${a.slug}`} className="w-36 shrink-0 text-xs font-normal">
                      {a.name}
                    </Label>
                    <Input
                      id={`funding_${a.slug}`} name={`funding_${a.slug}`}
                      inputMode="numeric" defaultValue={fundingOf(a.slug)}
                      className="h-8" placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDone}>Batal</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ReceivableList({ receivables, canManage }: { receivables: Receivable[]; canManage: boolean }) {
  if (receivables.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Tidak ada piutang tertunggak. 🎉</p>
  }

  const total = receivables.reduce((sum, r) => sum + r.transaction.amount, 0)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Piutang Tertunggak</h2>
          <span className="text-sm font-semibold tabular-nums">{formatRupiah(total)}</span>
        </div>
        <ul className="divide-y">
          {receivables.map(r => (
            <ReceivableRow key={r.transaction.id} receivable={r} canManage={canManage} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ReceivableRow({ receivable, canManage }: { receivable: Receivable; canManage: boolean }) {
  const { transaction: trx, accountName } = receivable
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pending, setPending] = useState(false)

  async function settle() {
    setPending(true)
    const result = await settleReceivableAction(trx.id, date)
    if (result.error) {
      alert(result.error)
      setPending(false)
    }
  }

  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">
            {accountName}
            {trx.description && <span className="text-muted-foreground"> — {trx.description}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Tagihan {formatPeriod(toPeriodKey(trx.period))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="tabular-nums">{formatRupiah(trx.amount)}</Badge>
          {canManage && !open && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Lunas
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border p-2">
          <div className="space-y-1">
            <Label htmlFor={`paid-${trx.id}`} className="text-xs">Tanggal diterima</Label>
            <Input
              id={`paid-${trx.id}`} type="date" value={date}
              onChange={e => setDate(e.target.value)} className="h-8 w-40"
            />
          </div>
          <Button size="sm" className="h-8" disabled={pending} onClick={settle}>
            {pending ? 'Menyimpan…' : 'Tandai Lunas'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>Batal</Button>
          <p className="w-full text-xs text-muted-foreground">
            Pemasukan akan diakui di bulan tanggal ini, bulan tagihannya tetap {formatPeriod(toPeriodKey(trx.period))}.
          </p>
        </div>
      )}
    </li>
  )
}
