import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getUnitLearning } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UnitProgramAnalytics } from '@/components/dashboard/UnitProgramAnalytics'

export default async function AnalitikUnitPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  // Manajemen melihat semua unit; koor SD/SMP hanya unitnya sendiri.
  const allowedJenjang = getAnalyticsJenjang(session.role)
  const isFullAccess = canViewAnalytics(session.role)

  const allUnits = await getUnitLearning()
  const units = allUnits.filter(u => allowedJenjang.includes(u.jenjang))

  const scopeLabel = isFullAccess
    ? 'Capaian Qur’ani per Unit'
    : `Unit ${allowedJenjang.map(j => JENJANG_LABELS[j]).join(' · ')}`

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Analitik per Unit & Program"
        showBack
        ownH1
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">{scopeLabel}</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik per Unit &amp; Program</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capaian tahsin, tahfidz, ujian juz&apos;iyah &amp; tasmi&apos; tiap program
            {isFullAccess ? (
              <>
                {' · '}
                <Link href="/dashboard/analitik" className="text-primary hover:underline">
                  ← Analitik RQ umum
                </Link>
              </>
            ) : null}
          </p>
        </div>

        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Belum ada data siswa untuk unit Anda.
          </p>
        ) : (
          <UnitProgramAnalytics units={units} />
        )}
      </div>
    </div>
  )
}
