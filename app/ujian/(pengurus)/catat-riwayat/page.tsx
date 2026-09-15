import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canSubmitUjian, getUjianUnits } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { FormRiwayatTahfidz } from '@/components/ujian/FormRiwayatTahfidz'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'

export default async function CatatRiwayatUjianPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canSubmitUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Catat Riwayat Ujian"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Catat Riwayat' }]}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Catat Riwayat Tasmi&apos; Lama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Untuk tasmi&apos; 1, 3, dan 5 juz yang sudah terjadi sebelum sistem dipakai. Catatan langsung
            berstatus <em>Selesai</em> dan terhitung sebagai juz teruji — tanpa masuk antrian, tanpa
            notifikasi ke guru.
          </p>
        </div>

        <UjianSubNav />

        <FormRiwayatTahfidz units={units} />
      </div>
    </div>
  )
}
