import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, ClipboardList, FileText, PiggyBank, Wallet } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { currentPeriod, formatJuta, formatPeriod, formatRupiah, isValidPeriod, percentOf } from '@/lib/finance/period'
import { buildBudgetRows, buildReceivables, buildRows, buildTrustFunds } from '@/lib/finance/report'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

export default async function KeuanganPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const data = await getFinanceData(period)
  const income = buildRows(data, period, 'pemasukan')
  const expense = buildRows(data, period, 'pengeluaran')
  const budgetIncome = buildBudgetRows(data, period, 'pemasukan')
  const budgetExpense = buildBudgetRows(data, period, 'pengeluaran')
  const trust = buildTrustFunds(data, period)
  const receivables = buildReceivables(data, period)

  const balance = income.total - expense.total
  const receivableTotal = receivables.reduce((t, r) => t + r.transaction.amount, 0)
  const unallocated = budgetExpense.rows.reduce((t, r) => t + r.unallocated, 0)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Keuangan"
        showBack
      />

      <div className="p-4 md:p-6 space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Keuangan Rumah Qur&apos;an</h1>
            <p className="text-sm text-muted-foreground">
              Pencatatan, rekap, dan laporan bulanan untuk BPH.
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        {/* 1.1 Ringkasan Keuangan */}
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Total Pemasukan"
            value={formatJuta(income.total)}
            hint={
              budgetIncome.totalBudget
                ? `${percentOf(income.total, budgetIncome.totalBudget)}% vs anggaran`
                : 'Anggaran belum diisi'
            }
          />
          <SummaryCard
            label="Total Pengeluaran"
            value={formatJuta(expense.total)}
            hint={
              budgetExpense.totalBudget
                ? `Anggaran ${formatJuta(budgetExpense.totalBudget)}`
                : 'Anggaran belum diisi'
            }
          />
          <SummaryCard
            label={balance === 0 ? 'Balance' : balance > 0 ? 'Surplus' : 'Defisit'}
            value={balance === 0 ? 'Seimbang' : formatJuta(Math.abs(balance))}
            hint={balance === 0 ? 'Pengeluaran = pemasukan' : 'Selisih pemasukan − pengeluaran'}
            tone={balance < 0 ? 'danger' : balance > 0 ? 'good' : 'neutral'}
          />
        </section>

        {/* Hal yang perlu ditindaklanjuti sebelum laporan dikirim ke BPH. */}
        {(receivables.length > 0 || unallocated > 0) && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Perlu Ditindaklanjuti</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {receivables.length > 0 && (
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {receivables.length} piutang belum tertunaikan
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total {formatRupiah(receivableTotal)} — s.d. {formatPeriod(period)}.
                      </p>
                      <Link
                        href={`/keuangan/transaksi?periode=${period}&tab=piutang`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Lihat daftar piutang <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
              {unallocated > 0 && (
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Dana sumber belum lengkap</p>
                      <p className="text-sm text-muted-foreground">
                        {formatRupiah(unallocated)} pengeluaran belum ditandai sumber dananya —
                        kolom matriks tabel 1.5 akan kosong sebagian.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Ringkas per pos, tanpa detail — detailnya ada di tab Transaksi. */}
        <section className="grid gap-4 md:grid-cols-2">
          <PostSummary title="Pemasukan" rows={income.rows} total={income.total} />
          <PostSummary title="Pengeluaran" rows={expense.rows} total={expense.total} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {trust.map(fund => (
            <Card key={fund.slug}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{fund.name}</p>
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatRupiah(fund.closing)}</p>
                <p className="text-xs text-muted-foreground">
                  Saldo akhir {formatPeriod(period)} · {fund.entries.length} mutasi bulan ini
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        {canManageFinance(session.role) && (
          <Link
            href={`/keuangan/laporan?periode=${period}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            Buka Laporan BPH {formatPeriod(period)}
          </Link>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, hint, tone = 'neutral',
}: {
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'good' | 'danger'
}) {
  const toneClass =
    tone === 'danger' ? 'text-destructive' : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : ''

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function PostSummary({
  title, rows, total,
}: {
  title: string
  rows: { slug: string; name: string; amount: number; percent: number }[]
  total: number
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-sm font-semibold tabular-nums">{formatRupiah(total)}</span>
        </div>
        <ul className="space-y-1.5">
          {rows.map(row => (
            <li key={row.slug} className="flex items-center justify-between gap-2 text-sm">
              <span className={row.amount ? '' : 'text-muted-foreground'}>{row.name}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{row.amount ? formatRupiah(row.amount) : '—'}</span>
                {row.amount > 0 && (
                  <Badge variant="secondary" className="tabular-nums">{row.percent}%</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
