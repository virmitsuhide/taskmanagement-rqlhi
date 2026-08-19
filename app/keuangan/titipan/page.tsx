import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageFinance, canViewFinance } from '@/lib/auth/permissions'
import { getFinanceData } from '@/lib/data/finance'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FinanceNav } from '@/components/keuangan/FinanceNav'
import { PeriodPicker } from '@/components/keuangan/PeriodPicker'
import { TrustFundManager } from '@/components/keuangan/TrustFundManager'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'
import { buildTrustFunds } from '@/lib/finance/report'

interface PageProps {
  searchParams: Promise<{ periode?: string }>
}

export default async function TitipanPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewFinance(session.role)) redirect('/dashboard')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const data = await getFinanceData(period)

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Dana Titipan"
        breadcrumbs={[{ label: 'Keuangan', href: `/keuangan?periode=${period}` }, { label: 'Dana Titipan' }]}
        showBack
      />

      <div className="p-4 md:p-6 space-y-5 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Dana Titipan</h1>
            <p className="text-sm text-muted-foreground">
              Saldo awal dihitung dari mutasi bulan-bulan sebelumnya, bukan diketik ulang.
            </p>
          </div>
          <PeriodPicker period={period} />
        </div>

        <FinanceNav period={period} />

        <TrustFundManager
          period={period}
          funds={data.trustFunds}
          reports={buildTrustFunds(data, period)}
          canManage={canManageFinance(session.role)}
        />
      </div>
    </div>
  )
}
