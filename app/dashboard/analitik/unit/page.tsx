import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics } from '@/lib/auth/permissions'
import { getUnitLearning } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UnitProgramAnalytics } from '@/components/dashboard/UnitProgramAnalytics'

export default async function AnalitikUnitPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/dashboard')

  const units = await getUnitLearning()

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Analitik per Unit & Program" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Capaian Qur&apos;ani per Unit</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik per Unit &amp; Program</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capaian tahsin, tahfidz, ujian juz&apos;iyah &amp; tasmi&apos; tiap program ·{' '}
            <Link href="/dashboard/analitik" className="text-primary hover:underline">← Analitik RQ umum</Link>
          </p>
        </div>

        <UnitProgramAnalytics units={units} />
      </div>
    </div>
  )
}
