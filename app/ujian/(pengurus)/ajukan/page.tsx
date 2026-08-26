import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FormPengajuan } from '@/components/ujian/FormPengajuan'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'

export default async function AjukanUjianPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canSubmitUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Ajukan Ujian"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Ajukan' }]}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Ajukan Ujian</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pengajuan masuk ke antrian dengan status <em>Diajukan</em>, lalu tinggal dijadwalkan
            dari halaman Kelola.
          </p>
        </div>

        <UjianSubNav />

        <FormPengajuan units={units} redirectTo="/ujian/kelola" />
      </div>
    </div>
  )
}
