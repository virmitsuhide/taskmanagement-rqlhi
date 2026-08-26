import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KelolaUjian } from '@/components/ujian/KelolaUjian'
import { KalenderUjian } from '@/components/ujian/KalenderUjian'
import { TandaiUjianDilihat } from '@/components/ujian/TandaiUjianDilihat'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import {
  getKalenderUjian, getNamaPengaju, getPengajuanUjian, getPengujis,
} from '@/lib/data/ujian'
import { tanggalWIB } from '@/lib/rq/ujian'

interface PageProps {
  searchParams: Promise<{ jenis?: string }>
}

export default async function KelolaUjianPage({ searchParams }: PageProps) {
  const jenisAwal = (await searchParams).jenis === 'tahsin' ? 'tahsin' : 'tahfidz'

  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUjian(session.role)) redirect('/dashboard')

  const units = getUjianUnits(session.role)

  // Bulan kalender dihitung dari WIB, bukan dari zona server: kalau server
  // berjalan pada UTC, tanggal 1 pukul 00.30 WIB masih terbaca bulan lalu.
  const hariIni = tanggalWIB(new Date())
  const [tahun, bulan] = hariIni.split('-').map(Number)

  const [{ tahfidz, tahsin }, pengujis, kalender] = await Promise.all([
    getPengajuanUjian(units),
    getPengujis(),
    getKalenderUjian(units, tahun, bulan),
  ])

  const namaPengaju = await getNamaPengaju([...tahfidz, ...tahsin])
  const total = tahfidz.length + tahsin.length

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Ujian Tahsin & Tahfidz"
        showBack
        ownH1
      />
      <TandaiUjianDilihat />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight">Kelola Pengajuan Ujian</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {units.join(' & ')} · {total} pengajuan · jadwalkan, tentukan penguji, lalu isi nilainya.
          </p>
        </div>

        <UjianSubNav />

        <KalenderUjian
          events={kalender}
          year={tahun}
          month={bulan - 1}
          todayWIB={hariIni}
        />

        <KelolaUjian
          tahfidz={tahfidz}
          tahsin={tahsin}
          units={units}
          pengujiOptions={pengujis.map(p => p.nama)}
          namaPengaju={namaPengaju}
          jenisAwal={jenisAwal}
        />
      </div>
    </div>
  )
}
