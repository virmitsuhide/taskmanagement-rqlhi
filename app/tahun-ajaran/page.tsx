import { redirect } from 'next/navigation'
import { CalendarRange } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canManageTerms, canViewTerms } from '@/lib/auth/permissions'
import { getTermStats, getTerms } from '@/lib/data/terms'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TermManager } from '@/components/tahun-ajaran/TermManager'

export default async function TahunAjaranPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTerms(session.role)) redirect('/dashboard')

  const [terms, stats] = await Promise.all([getTerms(), getTermStats()])

  return (
    <div>
      <DashboardHeader
        role={session.role}
        displayName={session.displayName}
        title="Tahun Ajaran"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Tahun Ajaran</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Semester berjalan menjadi acuan seluruh halaqoh, penempatan santri, dan penugasan guru.
          </p>
        </div>

        {terms.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <CalendarRange className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada tahun ajaran. Buat satu dulu sebelum menambah halaqoh.
            </p>
          </div>
        ) : null}

        <TermManager
          terms={terms}
          stats={Object.fromEntries(stats)}
          canManage={canManageTerms(session.role)}
        />
      </div>
    </div>
  )
}
