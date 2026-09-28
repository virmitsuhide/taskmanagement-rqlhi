import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits, ujianHanyaQuls } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { RiwayatUjian } from '@/components/ujian/RiwayatUjian'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { getRekapUjian } from '@/lib/data/ujian'

interface PageProps {
  searchParams: Promise<{ bulan?: string; tahun?: string }>
}

function periode(params: { bulan?: string; tahun?: string }) {
  const sekarang = new Date()
  const bulan = Number(params.bulan)
  const tahun = Number(params.tahun)
  return {
    month: Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 ? bulan : sekarang.getMonth() + 1,
    year: Number.isInteger(tahun) && tahun >= 2000 && tahun <= 2100 ? tahun : sekarang.getFullYear(),
  }
}

export default async function RiwayatUjianPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)
  const { month, year } = periode(await searchParams)
  const hanyaQuls = ujianHanyaQuls(session.role)
  const { tahfidz, tahsin } = await getRekapUjian(month, year, units, hanyaQuls)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Riwayat Ujian"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Ujian', href: '/ujian/kelola' }, { label: 'Riwayat' }]}
      />

      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-3xl leading-tight">Riwayat &amp; Rekap Ujian</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hanyaQuls ? 'QULS SD' : units.join(' & ')} · ujian yang sudah terlaksana: rekap nilai sebulan, unduhan Excel, dan rincian per penguji.
          </p>
        </div>

        <UjianSubNav />

        <RiwayatUjian tahfidz={tahfidz} tahsin={tahsin} month={month} year={year} />
      </div>
    </div>
  )
}
