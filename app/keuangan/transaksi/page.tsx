import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { TransactionManager } from '@/components/keuangan/TransactionManager'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { buildReceivables, settledIn } from '@/lib/finance/report'

interface PageProps {
  searchParams: Promise<{ periode?: string; tab?: string }>
}

export default async function TransaksiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()
  const tab = params.tab === 'pengeluaran' || params.tab === 'piutang' ? params.tab : 'pemasukan'

  const data = await getFinanceData(period)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Transaksi Keuangan"
        breadcrumbs={[{ label: 'Keuangan', href: `/keuangan?periode=${period}` }, { label: 'Transaksi' }]}
        showBack
      />

      <div className="p-4 md:p-6 space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Transaksi</h1>
            <p className="text-sm text-muted-foreground">
              Setiap penerimaan dan pengeluaran dicatat di sini — tabel laporan disusun dari data ini.
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        <TransactionManager
          period={period}
          tab={tab}
          accounts={data.accounts}
          settled={settledIn(data.transactions, period)}
          receivables={buildReceivables(data, period)}
          canManage={canManageFinance(session.role)}
        />
      </div>
    </div>
  )
}
