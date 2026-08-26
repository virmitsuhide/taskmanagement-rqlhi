import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewUjian } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PengujiManager } from '@/components/ujian/PengujiManager'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { getPengujis } from '@/lib/data/ujian'

export default async function PengujiPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const pengujis = await getPengujis()

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Daftar Penguji"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Penguji' }]}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Daftar Penguji</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pengujis.length} nama terdaftar. Satu daftar dipakai bersama SD dan SMP.
          </p>
        </div>

        <UjianSubNav />

        <PengujiManager pengujis={pengujis} />
      </div>
    </div>
  )
}
