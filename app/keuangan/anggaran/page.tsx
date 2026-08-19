import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { BudgetForm } from '@/components/keuangan/BudgetForm'
import { currentPeriod, isValidPeriod, shiftPeriod, toPeriodKey } from '@/lib/finance/period'
import { buildBudgetRows } from '@/lib/finance/report'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

export default async function AnggaranPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const data = await getFinanceData(period)
  const income = buildBudgetRows(data, period, 'pemasukan')
  const expense = buildBudgetRows(data, period, 'pengeluaran')

  // Tombol "salin dari bulan lalu" hanya berguna kalau bulan lalu memang
  // sudah punya anggaran — kalau tidak, ia cuma memancing pesan gagal.
  const previous = shiftPeriod(period, -1)
  const previousHasBudget = data.budgets.some(b => toPeriodKey(b.period) === previous)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Anggaran"
        breadcrumbs={[{ label: 'Keuangan', href: `/keuangan?periode=${period}` }, { label: 'Anggaran' }]}
        showBack
      />

      <div className="p-4 md:p-6 space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Anggaran</h1>
            <p className="text-sm text-muted-foreground">
              Pembanding realisasi di tabel 1.5 laporan. Realisasinya terisi sendiri dari transaksi.
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        <BudgetForm
          period={period}
          accounts={data.accounts}
          incomeRows={income.rows}
          expenseRows={expense.rows}
          previousPeriod={previousHasBudget ? previous : null}
          canManage={canManageFinance(session.role)}
        />
      </div>
    </div>
  )
}
