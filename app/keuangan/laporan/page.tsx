import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData, getFinanceNotes } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { NarrativeEditor } from '@/components/keuangan/NarrativeEditor'
import { ProgramPlanEditor } from '@/components/keuangan/ProgramPlanEditor'
import { PrintButton } from '@/components/keuangan/PrintButton'
import { CashflowChart, DonutChart } from '@/components/keuangan/ReportCharts'
import {
  currentPeriod, formatAngka, formatJuta, formatPeriod, formatRupiah,
  isValidPeriod, monthName, percentOf, shiftPeriod,
} from '@/lib/finance/period'
import {
  buildBudgetRows, buildProgramPlans, buildRecap, buildRows, buildTrend, buildTrustFunds,
  type BudgetRow, type ReportRow,
} from '@/lib/finance/report'
import { KPI_STATUS_LABEL, buildKpi } from '@/lib/finance/kpi'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Laporan Keuangan bulanan dalam tata letak Laporan Eksekutif RQ.
 *
 * Halaman ini sengaja tidak memakai komponen UI aplikasi (Card, Badge, dsb.)
 * melainkan kelas `.report-*` di globals.css. Alasannya: lembar ini harus
 * tampil identik di layar terang, layar gelap, dan di atas kertas — sedangkan
 * komponen aplikasi memang dirancang berganti warna mengikuti tema.
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

      <div className="p-4 md:p-6 space-y-4 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-lg font-semibold">Laporan Keuangan {formatPeriod(period)}</h1>
            <p className="text-sm text-muted-foreground">
              Tata letaknya mengikuti Laporan Eksekutif RQ — siap dicetak atau disimpan sebagai PDF.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodPicker period={period} />
            <PrintButton />
          </div>
        </div>

        <div className="print:hidden"><FinanceNav period={period} /></div>

        {unallocated > 0 && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 print:hidden">
            {formatRupiah(unallocated)} pengeluaran belum ditandai sumber dananya — matriks 1.5
            akan tercetak dengan kolom kosong. Lengkapi di tab Transaksi.
          </p>
        )}

        {/* ── Lembar laporan ── */}
        <div className="report-sheet mx-auto max-w-[900px] border shadow-sm print:max-w-none print:border-0 print:shadow-none">
          <div className="report-cover">
            <div className="brand">Yayasan Pionir Pendidikan Indonesia</div>
            <div className="tagline">
              Rumah Qur&apos;an LHI — Membumikan Al-Qur&apos;an, Menanamkan Adab, Membangun Peradaban
            </div>
            <div className="doc-title">LAPORAN KEUANGAN</div>
            <div className="doc-sub">Periode: {formatPeriod(period)}</div>
          </div>

          <div className="p-5 print:p-0 print:pt-4">
            <table className="report-meta">
              <tbody>
                <tr><td>Disampaikan kepada</td><td>Badan Pengurus Harian (BPH)</td></tr>
                <tr><td>Disampaikan oleh</td><td>Kepala Rumah Qur&apos;an</td></tr>
                <tr><td>Isi Laporan</td><td>Keuangan — pemasukan, pengeluaran, dana titipan, anggaran, KPI</td></tr>
                <tr><td>Periode Pelaporan</td><td>{formatPeriod(period)}</td></tr>
                <tr><td>Klasifikasi</td><td>TERBATAS</td></tr>
              </tbody>
            </table>

            <div className="report-band">
              <div className="num">01</div>
              <div className="title">
                <strong>LAPORAN KEUANGAN</strong>
                <em>Financial Performance Report — {formatPeriod(period)}</em>
              </div>
            </div>

            {/* ── 1.1 ── */}
            <Heading no="1.1" title={`Ringkasan Keuangan Bulan ${formatPeriod(period)}`} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                value={formatJuta(income.total)}
                label="Total Pemasukan"
                hint={budgetIncome.totalBudget
                  ? `↑ ${percentOf(income.total, budgetIncome.totalBudget)} % vs Anggaran`
                  : 'Anggaran belum diisi'}
              />
              <Stat
                value={formatJuta(expense.total)}
                label="Total Pengeluaran"
                hint={budgetExpense.totalBudget
                  ? `Anggaran: ${formatRupiah(budgetExpense.totalBudget)}`
                  : 'Anggaran belum diisi'}
              />
              <Stat
                value={balance === 0 ? 'BALANCE' : formatJuta(Math.abs(balance))}
                label="Surplus / Defisit"
                hint={balance === 0
                  ? 'Pengeluaran = Pemasukan'
                  : balance > 0 ? 'Pemasukan > Pengeluaran' : 'Pengeluaran > Pemasukan'}
              />
            </div>

            {/* ── 1.2 ── */}
            <Heading no="1.2" title="Pemasukan" />
            <Heading no="1.2.1" title="Tabel Pemasukan" small />
            <FlowTable rows={income.rows} total={income.total} head="Sumber Pemasukan" totalLabel="TOTAL PEMASUKAN" />

            <Heading no="1.2.2" title="Diagram Pemasukan" small />
            <DonutChart title="Komposisi pemasukan" slices={income.rows.map(r => ({ label: r.name, value: r.amount }))} />
            <NarrativeEditor
              period={period} section="catatan_pemasukan" title="Catatan"
              content={notes.catatan_pemasukan ?? ''} canManage={canManage}
            />

            {/* ── 1.3 ── */}
            <Heading no="1.3" title="Pengeluaran" />
            <Heading no="1.3.1" title="Tabel Pengeluaran" small />
            <FlowTable rows={expense.rows} total={expense.total} head="Pos Pengeluaran" totalLabel="TOTAL PENGELUARAN" />

            <Heading no="1.3.2" title="Diagram Pengeluaran" small />
            <DonutChart title="Komposisi pengeluaran" slices={expense.rows.map(r => ({ label: r.name, value: r.amount }))} />
            <NarrativeEditor
              period={period} section="catatan_pengeluaran" title="Catatan"
              content={notes.catatan_pengeluaran ?? ''} canManage={canManage}
            />

            {/* ── 1.4 ── */}
            <Heading no="1.4" title="Dana Titipan" />
            {trust.map((fund, i) => (
              <div key={fund.slug} className="mb-3">
                <Heading no={`1.4.${i + 1}`} title={fund.name} small />
                <table className="report-table">
                  <thead>
                    <tr><th>Keterangan</th><th className="num-cell">Jumlah</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Saldo Awal {formatPeriod(period)}</td>
                      <td className="num-cell">{formatAngka(fund.opening)}</td>
                    </tr>
                    {fund.entries.map(entry => (
                      <tr key={entry.id}>
                        <td>({entry.amount < 0 ? '−' : '+'}) {entry.description}</td>
                        <td className="num-cell">
                          {entry.amount < 0 ? '− ' : ''}{formatAngka(Math.abs(entry.amount))}
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td>Saldo Akhir {formatPeriod(period)}</td>
                      <td className="num-cell">{formatAngka(fund.closing)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            {/* ── 1.5 ── */}
            <Heading no="1.5" title="Anggaran vs Realisasi" />
            <Heading no="1.5.1" title="Anggaran vs Realisasi Pemasukan" small />
            <table className="report-table">
              <thead>
                <tr>
                  <th>Sumber Pemasukan</th>
                  <th className="num-cell">Anggaran (Rp)</th>
                  <th className="num-cell">Realisasi (Rp)</th>
                  <th className="num-cell">%</th>
                </tr>
              </thead>
              <tbody>
                {budgetIncome.rows.map(row => <BudgetRowCells key={row.slug} row={row} />)}
                <tr className="total">
                  <td>TOTAL</td>
                  <td className="num-cell">{formatAngka(budgetIncome.totalBudget)}</td>
                  <td className="num-cell">{formatAngka(budgetIncome.totalActual)}</td>
                  <td className="num-cell">
                    {budgetIncome.totalBudget
                      ? `${percentOf(budgetIncome.totalActual, budgetIncome.totalBudget)}%`
                      : '-'}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="print-landscape">
              <Heading no="1.5.2" title="Anggaran vs Realisasi Pengeluaran" small />
              <table className="report-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Pos Pengeluaran</th>
                    <th className="num-cell" rowSpan={2}>Anggaran (Rp)</th>
                    <th className="num-cell" rowSpan={2}>Realisasi (Rp)</th>
                    <th className="num-cell" colSpan={incomeSources.length}>Dana Sumber</th>
                  </tr>
                  <tr>
                    {incomeSources.map(source => (
                      <th key={source.slug} className="num-cell">{source.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgetExpense.rows.map(row => (
                    <tr key={row.slug}>
                      <td>{row.name}</td>
                      <td className="num-cell">{row.budget ? formatAngka(row.budget) : '-'}</td>
                      <td className="num-cell">{row.actual ? formatAngka(row.actual) : '-'}</td>
                      {incomeSources.map(source => (
                        <td key={source.slug} className="num-cell">
                          {row.funding[source.slug] ? formatAngka(row.funding[source.slug]) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total">
                    <td>TOTAL</td>
                    <td className="num-cell">{formatAngka(budgetExpense.totalBudget)}</td>
                    <td className="num-cell">{formatAngka(budgetExpense.totalActual)}</td>
                    {incomeSources.map(source => (
                      <td key={source.slug} className="num-cell">
                        {formatAngka(budgetExpense.rows.reduce((sum, r) => sum + (r.funding[source.slug] ?? 0), 0))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <NarrativeEditor
                period={period} section="evaluasi_anggaran"
                title={`💡 Evaluasi Anggaran ${formatPeriod(period)}`}
                content={notes.evaluasi_anggaran ?? ''} canManage={canManage} gold
              />
            </div>

            {/* ── 1.6 ── */}
            <div className="print-landscape">
              <Heading
                no="1.6"
                title={`Rekapitulasi Pemasukan & Pengeluaran Januari s.d. ${monthName(period)} ${period.slice(0, 4)}`}
              />
              <RecapTable caption="PEMASUKAN" recap={recapIncome} />
              <div className="mt-3">
                <RecapTable caption="PENGELUARAN" recap={recapExpense} />
              </div>
            </div>

            {/* ── 1.7 ── */}
            <Heading
              no="1.7"
              title={`Analisis Keuangan Key Performance Indicator (KPI) — Januari s.d. ${monthName(period)}`}
            />
            <table className="report-table">
              <thead>
                <tr>
                  <th>Indikator</th>
                  <th className="num-cell">Nilai</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {kpi.map(metric => (
                  <tr key={metric.id}>
                    <td>{metric.label}</td>
                    <td className="num-cell">{metric.display}</td>
                    <td>{metric.note}</td>
                    <td>
                      <span className="report-badge" data-status={metric.status}>
                        {KPI_STATUS_LABEL[metric.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── 1.8 ── */}
            <Heading no="1.8" title="Tren Bulanan — Detail Breakdown" />
            <table className="report-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th className="num-cell">Total Pemasukan</th>
                  <th className="num-cell">Pendapatan Mandiri</th>
                  <th className="num-cell">Subsidi Yayasan</th>
                  <th className="num-cell">% Subsidi</th>
                </tr>
              </thead>
              <tbody>
                {trend.map(row => (
                  <tr key={row.period}>
                    <td>{monthName(row.period)}</td>
                    <td className="num-cell">{formatAngka(row.income)}</td>
                    <td className="num-cell">{formatAngka(row.mandiri)}</td>
                    <td className="num-cell">{formatAngka(row.subsidi)}</td>
                    <td className="num-cell">{row.subsidiPercent.toLocaleString('id-ID')}%</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>TOTAL / RATA-RATA</td>
                  <td className="num-cell">{formatAngka(trend.reduce((t, r) => t + r.income, 0))}</td>
                  <td className="num-cell">{formatAngka(trend.reduce((t, r) => t + r.mandiri, 0))}</td>
                  <td className="num-cell">{formatAngka(trend.reduce((t, r) => t + r.subsidi, 0))}</td>
                  <td className="num-cell">
                    {percentOf(
                      trend.reduce((t, r) => t + r.subsidi, 0),
                      trend.reduce((t, r) => t + r.income, 0),
                    )}%
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── 1.9 ── */}
            <Heading
              no="1.9"
              title={`Diagram Cashflow Januari s.d. ${monthName(period)} ${period.slice(0, 4)}`}
            />
            <CashflowChart
              months={trend.map(row => ({
                label: monthName(row.period).slice(0, 3),
                income: row.income,
                expense: row.expense,
                subsidi: row.subsidi,
              }))}
            />
            <p className="mt-1 text-[11px]" style={{ color: '#6b7280' }}>
              Rata-rata kebutuhan pemasukan subsidi/bulan{' '}
              {formatRupiah(trend.length ? trend.reduce((t, r) => t + r.subsidi, 0) / trend.length : 0)}
              {' '}({percentOf(
                trend.reduce((t, r) => t + r.subsidi, 0),
                trend.reduce((t, r) => t + r.income, 0),
              )}%)
            </p>
            <div className="mt-2">
              <NarrativeEditor
                period={period} section="analisis_kemandirian"
                title="Analisis Kemandirian Finansial — Rumah Qur'an LHI"
                content={notes.analisis_kemandirian ?? ''} canManage={canManage}
              />
            </div>

            {/* ── 2.1 ── */}
            <Heading no="2.1" title={`Rencana Pengeluaran Program ${formatPeriod(nextPeriod)}`} />
            <ProgramPlanEditor period={nextPeriod} plans={plans} canManage={canManage} />

            <div className="report-footer">
              © Yayasan Pionir Pendidikan Indonesia | Rumah Qur&apos;an LHI — Laporan Keuangan {formatPeriod(period)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Heading({ no, title, small }: { no: string; title: string; small?: boolean }) {
  return (
    <p className="report-h" style={small ? { fontSize: '11.5px', marginTop: '10px' } : undefined}>
      {no} <span className={small ? 'sub' : undefined}>{title}</span>
    </p>
  )
}

function Stat({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="report-stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      <div className="hint">{hint}</div>
    </div>
  )
}

/** Tabel 1.2.1 / 1.3.1 — keterangan dirangkai dari tiap transaksi pos itu. */
function FlowTable({
  rows, total, head, totalLabel,
}: {
  rows: ReportRow[]
  total: number
  head: string
  totalLabel: string
}) {
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th style={{ width: '20%' }}>{head}</th>
          <th>Keterangan</th>
          <th className="num-cell">Jumlah (Rp)</th>
          <th className="num-cell">Persentase (%)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.slug}>
            <td>{row.name}</td>
            <td>
              {row.details.length === 0 ? (
                '-'
              ) : row.details.length === 1 ? (
                row.details[0]
              ) : (
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {row.details.map((detail, i) => <li key={i}>{detail}</li>)}
                </ul>
              )}
            </td>
            <td className="num-cell">{row.amount ? formatAngka(row.amount) : '-'}</td>
            <td className="num-cell">{row.amount ? row.percent : '0'}</td>
          </tr>
        ))}
        <tr className="total">
          <td colSpan={2}>{totalLabel}</td>
          <td className="num-cell">{formatAngka(total)}</td>
          <td className="num-cell">100</td>
        </tr>
      </tbody>
    </table>
  )
}

function BudgetRowCells({ row }: { row: BudgetRow }) {
  return (
    <tr>
      <td>{row.name}</td>
      <td className="num-cell">{row.budget ? formatAngka(row.budget) : '-'}</td>
      <td className="num-cell">{row.actual ? formatAngka(row.actual) : '-'}</td>
      <td className="num-cell">{row.budget ? `${row.percent}%` : '-'}</td>
    </tr>
  )
}

function RecapTable({ caption, recap }: { caption: string; recap: ReturnType<typeof buildRecap> }) {
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th colSpan={recap.periods.length + 3}>{caption}</th>
        </tr>
        <tr>
          <th>Pos</th>
          {recap.periods.map(p => <th key={p} className="num-cell">{monthName(p)}</th>)}
          <th className="num-cell">TOTAL</th>
          <th className="num-cell">% dari Total</th>
        </tr>
      </thead>
      <tbody>
        {recap.rows.map(row => (
          <tr key={row.slug}>
            <td>{row.name}</td>
            {recap.periods.map(p => (
              <td key={p} className="num-cell">{row.perMonth[p] ? formatAngka(row.perMonth[p]) : '-'}</td>
            ))}
            <td className="num-cell">{row.total ? formatAngka(row.total) : '-'}</td>
            <td className="num-cell">{row.total ? `${row.percent.toLocaleString('id-ID')}%` : '-'}</td>
          </tr>
        ))}
        <tr className="total">
          <td>TOTAL</td>
          {recap.periods.map(p => <td key={p} className="num-cell">{formatAngka(recap.totals[p])}</td>)}
          <td className="num-cell">{formatAngka(recap.grandTotal)}</td>
          <td className="num-cell">100%</td>
        </tr>
      </tbody>
    </table>
  )
}
