import { tolakAkses } from '@/lib/auth/tolak-akses'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData, getFinanceNotes } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { PrintButton } from '@/components/keuangan/PrintButton'
import { periodeLaporanBawaan, formatPeriod, formatRupiah, isValidPeriod, shiftPeriod } from '@/lib/finance/period'
import {
  buildBudgetRows, buildProgramPlans, buildRows, buildTrend, buildTrustFunds, monthlyTotals,
} from '@/lib/finance/report'
import { buildKpi } from '@/lib/finance/kpi'
import { drafNarasi } from '@/lib/finance/narasi'
import { ReportSheet } from './ReportSheet'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

/**
 * Laporan Keuangan bulanan untuk BPH — disusun otomatis dari Isian Bulanan.
 * Yang tampil di layar adalah lembar yang dicetak; bagian naratif berisi
 * draf otomatis yang bisa disunting langsung di tempatnya.
 */
export default async function LaporanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) await tolakAkses()

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : periodeLaporanBawaan()
  const canManage = canManageFinance(session.role)

  const [data, notes] = await Promise.all([getFinanceData(period), getFinanceNotes(period)])

  const income = buildRows(data, period, 'pemasukan')
  const expense = buildRows(data, period, 'pengeluaran')
  const budgetIncome = buildBudgetRows(data, period, 'pemasukan')
  const budgetExpense = buildBudgetRows(data, period, 'pengeluaran')
  const nextPeriod = shiftPeriod(period, 1)
  const terisi = monthlyTotals(data, period).terisi
  const balance = income.total - expense.total
  const aktif = <T extends { is_active: boolean; display_order: number }>(xs: T[]) => xs.filter(a => a.is_active).sort((a, b) => a.display_order - b.display_order)

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
      <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Keuangan · Laporan BPH</p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">Laporan keuangan <em>{formatPeriod(period)}</em></h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Disusun otomatis dari Isian Bulanan. Teks berlabel <b>draf otomatis</b> bisa diubah langsung; tombol Cetak
              menghasilkan PDF (pilih &ldquo;Simpan sebagai PDF&rdquo;).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodPicker period={period} />
            <PrintButton />
          </div>
        </div>
        <div className="print:hidden"><FinanceNav period={period} /></div>

        {!terisi && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-wash px-4 py-3 text-sm text-warning print:hidden">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Isian {formatPeriod(period)} belum diisi.{' '}
              <Link href={`/keuangan/isian?periode=${period}`} className="font-semibold underline">Isi sekarang</Link>
            </span>
          </p>
        )}
        {terisi && balance !== 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-wash px-4 py-3 text-sm text-warning print:hidden">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Laporan belum balance: {balance > 0 ? 'surplus' : 'defisit'} {formatRupiah(Math.abs(balance))}.{' '}
              <Link href={`/keuangan/isian?periode=${period}`} className="font-semibold underline">Periksa isian</Link>
            </span>
          </p>
        )}

        <ReportSheet
          period={period}
          nextPeriod={nextPeriod}
          notes={notes}
          draf={drafNarasi(data, period)}
          canManage={canManage}
          income={income}
          expense={expense}
          budgetIncome={budgetIncome}
          budgetExpense={budgetExpense}
          trust={buildTrustFunds(data, period)}
          trend={buildTrend(data, period).filter(t => t.terisi)}
          kpi={buildKpi(data, period)}
          plans={buildProgramPlans(data, nextPeriod)}
          incomeAccounts={aktif(data.accounts.filter(a => a.kind === 'pemasukan'))}
          expenseAccounts={aktif(data.accounts.filter(a => a.kind === 'pengeluaran'))}
        />
      </div>
    </div>
  )
}
