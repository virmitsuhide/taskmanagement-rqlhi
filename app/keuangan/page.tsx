import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, ClipboardList, FileText, PiggyBank, Wallet } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { currentPeriod, formatJuta, formatPeriod, formatRupiah, isValidPeriod, percentOf } from '@/lib/finance/period'
import { buildBudgetRows, buildReceivables, buildRows, buildTrustFunds, settledIn } from '@/lib/finance/report'
import { cn } from '@/lib/utils'

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

  // Anggaran vs realisasi — dari baris anggaran yang sudah dihitung di atas.
  const posAnggaran = budgetExpense.rows.filter(r => r.budget > 0 || r.actual > 0)
  const melebihi = posAnggaran.filter(r => r.budget > 0 && r.actual > r.budget)
  const realisasiPct = budgetExpense.totalBudget ? percentOf(expense.total, budgetExpense.totalBudget) : null
  const namaPos = new Map(data.accounts.map(a => [a.id, { name: a.name, kind: a.kind }]))
  const transaksiTerbaru = settledIn(data.transactions, period)
    .sort((a, b) => (b.paid_at ?? b.created_at).localeCompare(a.paid_at ?? a.created_at))
    .slice(0, 6)
  const totalTitipan = trust.reduce((t, f) => t + f.closing, 0)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Keuangan"
        showBack
      />

      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Keuangan · {formatPeriod(period)}
            </p>
            <h1 className="mt-1 text-3xl leading-tight">Ke mana dana program mengalir bulan ini?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pencatatan, rekap, dan laporan bulanan untuk BPH.
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        {/* 1.1 Ringkasan Keuangan */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <SummaryCard
            label="Realisasi anggaran"
            value={realisasiPct !== null ? `${realisasiPct}%` : '—'}
            hint={melebihi.length > 0
              ? `${melebihi.length} pos melebihi anggaran`
              : realisasiPct !== null ? 'pengeluaran vs anggaran bulan ini' : 'Anggaran belum diisi'}
            tone={melebihi.length > 0 ? 'danger' : 'neutral'}
          />
        </section>

        {/* Anggaran vs realisasi per pos pengeluaran + transaksi terbaru */}
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-medium">Anggaran vs realisasi</h2>
                  <p className="text-xs text-muted-foreground">Pos pengeluaran · {formatPeriod(period)}</p>
                </div>
                <Link href={`/keuangan/anggaran?periode=${period}`} className="text-xs text-primary hover:underline">
                  Atur anggaran →
                </Link>
              </div>
              {posAnggaran.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Belum ada anggaran atau pengeluaran bulan ini.</p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {posAnggaran.map(r => {
                    const lebih = r.budget > 0 && r.actual > r.budget
                    const pct = r.budget > 0 ? Math.round((r.actual / r.budget) * 100) : null
                    return (
                      <li key={r.slug}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className={cn('min-w-0 truncate', lebih && 'font-semibold text-destructive')}>
                            {lebih && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />}
                            {r.name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            <span className={cn('font-semibold', lebih ? 'text-destructive' : 'text-foreground')}>
                              {pct !== null ? `${pct}%` : 'tanpa anggaran'}
                            </span>
                            {' · '}{formatRupiah(r.actual)}{r.budget > 0 ? ` / ${formatRupiah(r.budget)}` : ''}
                          </span>
                        </div>
                        <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('absolute inset-y-0 left-0 rounded-full', lebih ? 'bg-destructive' : pct === null ? 'bg-warning' : 'bg-primary')}
                            style={{ width: `${pct === null ? 100 : Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-end justify-between gap-2">
                <h2 className="font-heading text-xl font-medium">Transaksi terbaru</h2>
                <Link href={`/keuangan/transaksi?periode=${period}`} className="text-xs text-primary hover:underline">
                  Semua transaksi →
                </Link>
              </div>
              {transaksiTerbaru.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Belum ada transaksi lunas bulan ini.</p>
              ) : (
                <ul className="mt-3 divide-y">
                  {transaksiTerbaru.map(t => {
                    const pos = namaPos.get(t.account_id)
                    const masuk = pos?.kind === 'pemasukan'
                    return (
                      <li key={t.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-12 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {t.paid_at ? new Date(`${t.paid_at}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }) : '—'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{t.description || pos?.name || 'Transaksi'}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{pos?.name}</span>
                        </span>
                        <span className={cn('shrink-0 text-sm font-semibold tabular-nums', masuk ? 'text-success' : 'text-foreground')}>
                          {masuk ? '+' : '−'}{formatRupiah(t.amount)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Hal yang perlu ditindaklanjuti sebelum laporan dikirim ke BPH. */}
        {(receivables.length > 0 || unallocated > 0) && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-medium">Perlu Ditindaklanjuti</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {receivables.length > 0 && (
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
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
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-info" />
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

        {trust.length > 0 && (
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-heading text-xl font-medium">Dana titipan</h2>
            <span className="text-sm text-muted-foreground">
              Total <span className="font-semibold text-foreground tabular-nums">{formatRupiah(totalTitipan)}</span>
              {' · '}<Link href={`/keuangan/titipan?periode=${period}`} className="text-primary hover:underline">Buku titipan →</Link>
            </span>
          </div>
        )}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trust.map(fund => (
            <Card key={fund.slug}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{fund.name}</p>
                </div>
                <p className="mt-2 font-heading text-2xl font-medium tabular-nums">{formatRupiah(fund.closing)}</p>
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
    tone === 'danger' ? 'text-destructive' : tone === 'good' ? 'text-success' : ''

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className={`mt-2 font-heading text-3xl font-medium leading-none tabular-nums ${toneClass}`}>{value}</p>
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
          <h2 className="font-heading text-lg font-medium">{title}</h2>
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
