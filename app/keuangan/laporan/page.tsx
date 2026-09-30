import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData, getFinanceNotes } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { NarrativeEditor } from '@/components/keuangan/NarrativeEditor'
import { ProgramPlanEditor } from '@/components/keuangan/ProgramPlanEditor'
import { PrintButton } from '@/components/keuangan/PrintButton'
import { CashflowChart } from '@/components/keuangan/ReportCharts'
import {
  currentPeriod, formatAngka, formatPeriod, formatRupiah,
  isValidPeriod, monthName, percentOf, shiftPeriod,
} from '@/lib/finance/period'
import {
  buildBudgetRows, buildProgramPlans, buildRecap, buildRows, buildTrend, buildTrustFunds,
  type BudgetRow, type ReportRow,
} from '@/lib/finance/report'
import { KPI_STATUS_LABEL, buildKpi, type KpiStatus } from '@/lib/finance/kpi'
import { cn } from '@/lib/utils'
import { ReportSheet } from './ReportSheet'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Laporan Keuangan bulanan untuk BPH.
 *
 * Di layar: dokumen bernomor bergaya Teduh (daftar isi menempel di kiri,
 * judul bab + satu kalimat pertanyaan). Saat dicetak / disimpan PDF: lembar
 * Laporan Eksekutif RQ yang lama (ReportSheet, kelas `.report-*`) — layar
 * disembunyikan dengan `print:hidden`, lembar cetak dengan `hidden print:block`.
 */
export default async function LaporanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()
  const canManage = canManageFinance(session.role)

  const [data, notes] = await Promise.all([getFinanceData(period), getFinanceNotes(period)])

  const income = buildRows(data, period, 'pemasukan')
  const expense = buildRows(data, period, 'pengeluaran')
  const budgetIncome = buildBudgetRows(data, period, 'pemasukan')
  const budgetExpense = buildBudgetRows(data, period, 'pengeluaran')
  const trust = buildTrustFunds(data, period)
  const recapIncome = buildRecap(data, period, 'pemasukan')
  const recapExpense = buildRecap(data, period, 'pengeluaran')
  const trend = buildTrend(data, period)
  const kpi = buildKpi(data, period)

  const nextPeriod = shiftPeriod(period, 1)
  const plans = buildProgramPlans(data, nextPeriod)

  const incomeSources = data.accounts
    .filter(a => a.kind === 'pemasukan')
    .sort((a, b) => a.display_order - b.display_order)

  const balance = income.total - expense.total
  const unallocated = budgetExpense.rows.reduce((sum, r) => sum + r.unallocated, 0)
  const trustClosing = trust.reduce((sum, f) => sum + f.closing, 0)
  const overBudget = budgetExpense.rows.filter(r => r.budget > 0 && r.actual > r.budget)
  const totalSubsidi = trend.reduce((t, r) => t + r.subsidi, 0)
  const totalTrendIncome = trend.reduce((t, r) => t + r.income, 0)
  const bulan = monthName(period)
  const tahun = period.slice(0, 4)

  const toc: { id: string; no: string; label: string }[] = [
    { id: 'ringkasan', no: '1.1', label: 'Ringkasan' },
    { id: 'pemasukan', no: '1.2', label: 'Pemasukan' },
    { id: 'pengeluaran', no: '1.3', label: 'Pengeluaran' },
    { id: 'dana-titipan', no: '1.4', label: 'Dana titipan' },
    { id: 'anggaran', no: '1.5', label: 'Anggaran vs realisasi' },
    { id: 'rekap', no: '1.6', label: `Rekap Jan – ${bulan.slice(0, 3)}` },
    { id: 'indikator', no: '1.7', label: 'Indikator (KPI)' },
    { id: 'tren', no: '1.8', label: 'Tren bulanan' },
    { id: 'arus-kas', no: '1.9', label: 'Arus kas' },
    { id: 'rencana', no: '2.1', label: `Rencana ${monthName(nextPeriod)}` },
  ]

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Laporan BPH"
        breadcrumbs={[{ label: 'Keuangan', href: `/keuangan?periode=${period}` }, { label: 'Laporan BPH' }]}
        showBack
        ownH1
      />

      {/* ── Tampilan layar ── */}
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Keuangan · Laporan BPH
            </p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">
              Laporan keuangan <em>{formatPeriod(period)}</em>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Siap dibahas di rapat BPH — tombol Cetak menghasilkan lembar Laporan Eksekutif RQ (PDF).
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        {unallocated > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-wash px-4 py-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {formatRupiah(unallocated)} pengeluaran belum ditandai sumber dananya — matriks 1.5
              akan tercetak dengan kolom kosong. Lengkapi di tab Transaksi.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
          {/* Daftar isi */}
          <aside className="rounded-2xl border bg-card p-3 lg:sticky lg:top-4">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Isi laporan
            </p>
            <nav className="grid grid-cols-2 gap-0.5 sm:grid-cols-3 lg:grid-cols-1">
              {toc.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-primary-wash"
                >
                  <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-accent-warm">{item.no}</span>
                  <span className="min-w-0">{item.label}</span>
                </a>
              ))}
            </nav>
            <div className="mt-3 border-t pt-3 [&_button]:h-9 [&_button]:w-full [&_button]:rounded-xl">
              <PrintButton />
              <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
                Pilih &ldquo;Simpan sebagai PDF&rdquo; di jendela cetak untuk mengunduh.
              </p>
            </div>
          </aside>

          <div className="min-w-0 space-y-10">
            {/* 1.1 */}
            <Section id="ringkasan" no="1.1" title="Ringkasan" question="Sekilas untuk rapat BPH">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Tile
                  label="Pemasukan"
                  value={jt(income.total)}
                  hint={budgetIncome.totalBudget
                    ? `juta · ${percentOf(income.total, budgetIncome.totalBudget)}% anggaran`
                    : 'juta · anggaran belum diisi'}
                />
                <Tile
                  label="Pengeluaran"
                  value={jt(expense.total)}
                  hint={budgetExpense.totalBudget
                    ? `juta · anggaran ${formatRupiah(budgetExpense.totalBudget)}`
                    : 'juta · anggaran belum diisi'}
                />
                <Tile
                  label={balance === 0 ? 'Seimbang' : balance > 0 ? 'Surplus' : 'Defisit'}
                  value={balance === 0 ? 'BALANCE' : jt(Math.abs(balance))}
                  hint={balance === 0
                    ? 'Pengeluaran = Pemasukan'
                    : balance > 0 ? 'juta · pemasukan > pengeluaran' : 'juta · pengeluaran > pemasukan'}
                  tone={balance < 0 ? 'bad' : 'good'}
                />
                <Tile
                  label="Dana titipan"
                  value={jt(trustClosing)}
                  hint={`juta · saldo akhir ${trust.length} dana`}
                />
              </div>
              {overBudget.length > 0 && (
                <p className="mt-3 rounded-2xl border bg-card px-5 py-4 font-heading text-lg leading-relaxed">
                  <span className="text-accent-warm">
                    {overBudget.length} pos perlu dipantau:
                  </span>{' '}
                  {overBudget.map(r => `${r.name} (${r.percent}% anggaran)`).join(', ')}.
                </p>
              )}
            </Section>

            {/* 1.2 */}
            <Section id="pemasukan" no="1.2" title="Pemasukan" question="Dari mana uang bulan ini datang">
              <FlowCard rows={income.rows} total={income.total} totalLabel="Total pemasukan" />
              <NarrativeEditor
                period={period} section="catatan_pemasukan" title="Catatan"
                content={notes.catatan_pemasukan ?? ''} canManage={canManage}
              />
            </Section>

            {/* 1.3 */}
            <Section id="pengeluaran" no="1.3" title="Pengeluaran" question="Ke mana uang bulan ini pergi">
              <FlowCard rows={expense.rows} total={expense.total} totalLabel="Total pengeluaran" />
              <NarrativeEditor
                period={period} section="catatan_pengeluaran" title="Catatan"
                content={notes.catatan_pengeluaran ?? ''} canManage={canManage}
              />
            </Section>

            {/* 1.4 */}
            <Section id="dana-titipan" no="1.4" title="Dana titipan" question="Uang amanah yang kita pegang">
              {trust.length === 0 ? (
                <Empty>Belum ada dana titipan.</Empty>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {trust.map((fund, i) => (
                    <div key={fund.slug} className="overflow-hidden rounded-2xl border bg-card">
                      <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
                        <p className="text-sm font-bold">
                          <span className="mr-2 text-xs text-accent-warm">1.4.{i + 1}</span>{fund.name}
                        </p>
                        <p className="font-heading text-lg tabular-nums">{formatRupiah(fund.closing)}</p>
                      </div>
                      <ul className="divide-y text-sm">
                        <li className="flex justify-between gap-3 px-4 py-2 text-muted-foreground">
                          <span>Saldo awal {formatPeriod(period)}</span>
                          <span className="tabular-nums">{formatAngka(fund.opening)}</span>
                        </li>
                        {fund.entries.map(entry => (
                          <li key={entry.id} className="flex justify-between gap-3 px-4 py-2">
                            <span className="min-w-0">({entry.amount < 0 ? '−' : '+'}) {entry.description}</span>
                            <span className={cn('shrink-0 tabular-nums', entry.amount < 0 && 'text-destructive')}>
                              {entry.amount < 0 ? '− ' : ''}{formatAngka(Math.abs(entry.amount))}
                            </span>
                          </li>
                        ))}
                        <li className="flex justify-between gap-3 bg-muted/40 px-4 py-2 font-bold">
                          <span>Saldo akhir {formatPeriod(period)}</span>
                          <span className="tabular-nums">{formatAngka(fund.closing)}</span>
                        </li>
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 1.5 */}
            <Section id="anggaran" no="1.5" title="Anggaran vs realisasi" question="Pos mana yang melampaui rencana">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">1.5.1 Pemasukan</p>
              <BudgetCard rows={budgetIncome.rows} totalBudget={budgetIncome.totalBudget} totalActual={budgetIncome.totalActual} head="Sumber pemasukan" />

              <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">1.5.2 Pengeluaran</p>
              <BudgetCard rows={budgetExpense.rows} totalBudget={budgetExpense.totalBudget} totalActual={budgetExpense.totalActual} head="Pos pengeluaran" overIsBad />

              {incomeSources.length > 0 && (
                <details className="mt-3 rounded-2xl border bg-card">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                    Rincian dana sumber tiap pos pengeluaran
                  </summary>
                  <div className="overflow-x-auto border-t">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                          <th className="px-4 py-2 font-bold">Pos</th>
                          {incomeSources.map(source => (
                            <th key={source.slug} className="px-3 py-2 text-right font-bold">{source.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {budgetExpense.rows.map(row => (
                          <tr key={row.slug}>
                            <td className="px-4 py-2 font-semibold">{row.name}</td>
                            {incomeSources.map(source => (
                              <td key={source.slug} className="px-3 py-2 text-right tabular-nums">
                                {row.funding[source.slug] ? formatAngka(row.funding[source.slug]) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="bg-muted/40 font-bold">
                          <td className="px-4 py-2">Total</td>
                          {incomeSources.map(source => (
                            <td key={source.slug} className="px-3 py-2 text-right tabular-nums">
                              {formatAngka(budgetExpense.rows.reduce((sum, r) => sum + (r.funding[source.slug] ?? 0), 0))}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              <div className="mt-3">
                <NarrativeEditor
                  period={period} section="evaluasi_anggaran"
                  title={`💡 Evaluasi Anggaran ${formatPeriod(period)}`}
                  content={notes.evaluasi_anggaran ?? ''} canManage={canManage} gold
                />
              </div>
            </Section>

            {/* 1.6 */}
            <Section
              id="rekap" no="1.6" title={`Rekap Januari – ${bulan} ${tahun}`}
              question="Bagaimana uang bergerak sepanjang tahun"
            >
              <RecapCard caption="Pemasukan" recap={recapIncome} />
              <div className="mt-3"><RecapCard caption="Pengeluaran" recap={recapExpense} /></div>
            </Section>

            {/* 1.7 */}
            <Section
              id="indikator" no="1.7" title="Indikator keuangan" question="Sehat, dipantau, atau perlu tindakan"
              aside={`${kpi.length} indikator · akumulasi Jan – ${bulan.slice(0, 3)}`}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {kpi.map(metric => (
                  <div key={metric.id} className="flex flex-col rounded-2xl border bg-card p-4">
                    <p className="text-[13px] leading-snug text-muted-foreground">{metric.label}</p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <p className="min-w-0 break-words font-heading text-2xl leading-none tabular-nums">{metric.display}</p>
                      <StatusChip status={metric.status} />
                    </div>
                    {metric.note && <p className="mt-2 text-[11px] text-muted-foreground">{metric.note}</p>}
                  </div>
                ))}
              </div>
            </Section>

            {/* 1.8 */}
            <Section id="tren" no="1.8" title="Tren bulanan" question={`Januari sampai ${bulan} ${tahun}`}>
              <TrendBars trend={trend} />
              <div className="mt-3 overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="px-4 py-2.5 font-bold">Bulan</th>
                      <th className="px-3 py-2.5 text-right font-bold">Total pemasukan</th>
                      <th className="px-3 py-2.5 text-right font-bold">Pendapatan mandiri</th>
                      <th className="px-3 py-2.5 text-right font-bold">Subsidi Yayasan</th>
                      <th className="px-4 py-2.5 text-right font-bold">% Subsidi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trend.map(row => (
                      <tr key={row.period}>
                        <td className="px-4 py-2 font-semibold">{monthName(row.period)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAngka(row.income)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAngka(row.mandiri)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatAngka(row.subsidi)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.subsidiPercent.toLocaleString('id-ID')}%</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-bold">
                      <td className="px-4 py-2">Total / rata-rata</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAngka(totalTrendIncome)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAngka(trend.reduce((t, r) => t + r.mandiri, 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatAngka(totalSubsidi)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{percentOf(totalSubsidi, totalTrendIncome)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 1.9 */}
            <Section id="arus-kas" no="1.9" title="Arus kas" question="Seberapa mandiri keuangan kita">
              <div className="overflow-x-auto rounded-2xl border bg-white p-4 text-[#1b2a4a]">
                <CashflowChart
                  months={trend.map(row => ({
                    label: monthName(row.period).slice(0, 3),
                    income: row.income,
                    expense: row.expense,
                    subsidi: row.subsidi,
                  }))}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Rata-rata kebutuhan pemasukan subsidi/bulan{' '}
                <b className="text-foreground">{formatRupiah(trend.length ? totalSubsidi / trend.length : 0)}</b>
                {' '}({percentOf(totalSubsidi, totalTrendIncome)}%)
              </p>
              <div className="mt-2">
                <NarrativeEditor
                  period={period} section="analisis_kemandirian"
                  title="Analisis Kemandirian Finansial — Rumah Qur'an LHI"
                  content={notes.analisis_kemandirian ?? ''} canManage={canManage}
                />
              </div>
            </Section>

            {/* 2.1 */}
            <Section
              id="rencana" no="2.1" title={`Rencana ${formatPeriod(nextPeriod)}`}
              question="Program apa yang akan dibiayai bulan depan"
            >
              <div className="overflow-x-auto rounded-2xl border bg-card p-4">
                <ProgramPlanEditor period={nextPeriod} plans={plans} canManage={canManage} />
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* ── Lembar cetak (hanya saat mencetak) ── */}
      <div className="hidden print:block">
        <ReportSheet
          period={period} nextPeriod={nextPeriod} notes={notes}
          income={income} expense={expense} budgetIncome={budgetIncome} budgetExpense={budgetExpense}
          trust={trust} recapIncome={recapIncome} recapExpense={recapExpense} trend={trend} kpi={kpi}
          plans={plans} incomeSources={incomeSources} balance={balance}
        />
      </div>
    </div>
  )
}

/** 86400000 → '86,4' (juta). */
function jt(amount: number): string {
  return (amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

const DONUT_COLORS = [
  'var(--primary)', 'var(--chart-2)', 'var(--accent-warm)', 'var(--chart-4)',
  'var(--chart-3)', 'var(--chart-5)', 'var(--muted-foreground)',
]

function Section({
  id, no, title, question, aside, children,
}: { id: string; no: string; title: string; question: string; aside?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-4">
          <span className="font-heading text-4xl leading-none tabular-nums text-accent-warm md:text-5xl">{no}</span>
          <div>
            <h2 className="font-heading text-2xl leading-tight md:text-[28px]">{title}</h2>
            <p className="font-heading text-[15px] italic text-primary">{question}</p>
          </div>
        </div>
        {aside && <p className="text-xs text-muted-foreground">{aside}</p>}
      </div>
      {children}
    </section>
  )
}

function Tile({
  label, value, hint, tone,
}: { label: string; value: string; hint: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-1 font-heading text-3xl leading-none tabular-nums md:text-[34px]',
        tone === 'good' && 'text-primary',
        tone === 'bad' && 'text-destructive',
      )}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">{children}</p>
}

const STATUS_CLASS: Record<KpiStatus, string> = {
  info: 'bg-muted text-muted-foreground',
  aman: 'bg-success-wash text-success',
  pantau: 'bg-accent-warm-wash text-accent-warm',
  perlu_naik: 'bg-info-wash text-info',
  kritis: 'bg-destructive-wash text-destructive',
}

function StatusChip({ status }: { status: KpiStatus }) {
  return (
    <span className={cn('shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.04em]', STATUS_CLASS[status])}>
      {KPI_STATUS_LABEL[status]}
    </span>
  )
}

/** Donat + daftar pos (1.2 / 1.3). Keterangan tiap pos tampil di bawah namanya. */
function FlowCard({ rows, total, totalLabel }: { rows: ReportRow[]; total: number; totalLabel: string }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  let consumed = 0
  const arcs = rows
    .map((row, i) => ({ row, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
    .filter(a => a.row.amount > 0)
    .map(a => {
      const length = total ? (a.row.amount / total) * circumference : 0
      const arc = { ...a, length, offset: -consumed }
      consumed += length
      return arc
    })

  return (
    <div className="mb-3 rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="relative mx-auto h-[150px] w-[150px] shrink-0">
          <svg viewBox="0 0 150 150" className="h-full w-full" role="img" aria-label={totalLabel}>
            <circle cx={75} cy={75} r={radius} fill="none" stroke="var(--muted)" strokeWidth={24} />
            <g transform="rotate(-90 75 75)">
              {arcs.map(arc => (
                <circle
                  key={arc.row.slug} cx={75} cy={75} r={radius} fill="none"
                  stroke={arc.color} strokeWidth={24}
                  strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                  strokeDashoffset={arc.offset}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-xl tabular-nums">{jt(total)} jt</span>
            <span className="text-[10px] text-muted-foreground">total</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 divide-y border-t">
          {rows.map((row, i) => (
            <li key={row.slug} className="flex items-start gap-3 py-2.5">
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: row.amount > 0 ? DONUT_COLORS[i % DONUT_COLORS.length] : 'var(--border)' }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{row.name}</p>
                {row.details.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                    {row.details.map((detail, j) => <li key={j}>{detail}</li>)}
                  </ul>
                )}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">{row.amount ? formatRupiah(row.amount) : '-'}</span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {row.amount ? `${row.percent}%` : '0%'}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-3 py-2.5 font-bold">
            <span className="h-2.5 w-2.5 shrink-0" />
            <span className="flex-1 text-sm">{totalLabel}</span>
            <span className="text-sm tabular-nums">{formatRupiah(total)}</span>
            <span className="w-10 text-right text-xs tabular-nums">100%</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function BudgetCard({
  rows, totalBudget, totalActual, head, overIsBad,
}: { rows: BudgetRow[]; totalBudget: number; totalActual: number; head: string; overIsBad?: boolean }) {
  const over = overIsBad ? rows.filter(r => r.budget > 0 && r.actual > r.budget) : []
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-4 py-2.5 font-bold">{head}</th>
              <th className="px-3 py-2.5 text-right font-bold">Anggaran</th>
              <th className="px-3 py-2.5 text-right font-bold">Realisasi</th>
              <th className="w-[34%] px-4 py-2.5 font-bold">Serapan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(row => {
              const isOver = overIsBad && row.budget > 0 && row.actual > row.budget
              return (
                <tr key={row.slug}>
                  <td className="px-4 py-2.5 font-semibold">{row.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{row.budget ? formatAngka(row.budget) : '-'}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">{row.actual ? formatAngka(row.actual) : '-'}</td>
                  <td className="px-4 py-2.5">
                    {row.budget ? (
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', isOver ? 'bg-destructive' : 'bg-primary')}
                            style={{ width: `${Math.min(100, row.percent)}%` }}
                          />
                        </div>
                        <span className={cn('w-12 text-right text-xs font-bold tabular-nums', isOver ? 'text-destructive' : 'text-primary')}>
                          {row.percent}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Anggaran belum diisi</span>
                    )}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-muted/40 font-bold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(totalBudget)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatAngka(totalActual)}</td>
              <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                {totalBudget ? `${percentOf(totalActual, totalBudget)}%` : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {over.length > 0 && (
        <p className="border-t bg-destructive-wash px-4 py-2.5 text-sm text-destructive">
          <b>Melampaui anggaran:</b>{' '}
          {over.map(r => `${r.name} lewat ${r.percent - 100}%`).join(' · ')}
        </p>
      )}
    </div>
  )
}

function RecapCard({ caption, recap }: { caption: string; recap: ReturnType<typeof buildRecap> }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <p className="border-b px-4 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{caption}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="sticky left-0 bg-card px-4 py-2 font-bold">Pos</th>
              {recap.periods.map(p => <th key={p} className="px-2 py-2 text-right font-bold">{monthName(p).slice(0, 3)}</th>)}
              <th className="px-2 py-2 text-right font-bold">Total</th>
              <th className="px-4 py-2 text-right font-bold">%</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {recap.rows.map(row => (
              <tr key={row.slug}>
                <td className="sticky left-0 bg-card px-4 py-2 font-semibold">{row.name}</td>
                {recap.periods.map(p => (
                  <td key={p} className="px-2 py-2 text-right tabular-nums">{row.perMonth[p] ? formatAngka(row.perMonth[p]) : '-'}</td>
                ))}
                <td className="px-2 py-2 text-right font-bold tabular-nums">{row.total ? formatAngka(row.total) : '-'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {row.total ? `${row.percent.toLocaleString('id-ID')}%` : '-'}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-bold">
              <td className="sticky left-0 bg-muted px-4 py-2">Total</td>
              {recap.periods.map(p => <td key={p} className="px-2 py-2 text-right tabular-nums">{formatAngka(recap.totals[p])}</td>)}
              <td className="px-2 py-2 text-right tabular-nums">{formatAngka(recap.grandTotal)}</td>
              <td className="px-4 py-2 text-right tabular-nums">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Batang berpasangan pemasukan vs pengeluaran per bulan (1.8). */
function TrendBars({ trend }: { trend: ReturnType<typeof buildTrend> }) {
  const peak = Math.max(1, ...trend.flatMap(r => [r.income, r.expense]))
  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Pemasukan</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent-warm" />Pengeluaran</span>
      </div>
      <div className="flex h-44 items-end justify-around gap-1">
        {trend.map(row => (
          <div key={row.period} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-2.5 rounded-t-sm bg-primary sm:w-3.5"
                style={{ height: `${(row.income / peak) * 100}%` }}
                title={`Pemasukan ${monthName(row.period)}: ${formatRupiah(row.income)}`}
              />
              <div
                className="w-2.5 rounded-t-sm bg-accent-warm sm:w-3.5"
                style={{ height: `${(row.expense / peak) * 100}%` }}
                title={`Pengeluaran ${monthName(row.period)}: ${formatRupiah(row.expense)}`}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{monthName(row.period).slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
