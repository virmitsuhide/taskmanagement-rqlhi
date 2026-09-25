import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewUjian, getUjianUnits } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KelolaUjian } from '@/components/ujian/KelolaUjian'
import { KalenderUjian } from '@/components/ujian/KalenderUjian'
import { TandaiUjianDilihat } from '@/components/ujian/TandaiUjianDilihat'
import { UjianSubNav } from '@/components/ujian/UjianSubNav'
import { BebanPenguji } from '@/components/ujian/PapanUjian'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Tahsin &amp; tahfidz · pengajuan ujian
            </p>
            <h1 className="mt-1 text-3xl leading-tight">Dari pengajuan guru sampai hasil ujian</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {units.join(' & ')} · {total} pengajuan · jadwalkan, tentukan penguji, lalu isi nilainya.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/ujian/ajukan"><PlusCircle className="mr-1.5 h-4 w-4" />Ajukan ujian</Link>
          </Button>
        </div>

        <UjianSubNav />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <KelolaUjian
              tahfidz={tahfidz}
              tahsin={tahsin}
              units={units}
              pengujiOptions={pengujis.map(p => p.nama)}
              namaPengaju={namaPengaju}
              jenisAwal={jenisAwal}
            />

            <KalenderUjian
              events={kalender}
              year={tahun}
              month={bulan - 1}
              todayWIB={hariIni}
            />
          </div>
          <aside className="space-y-4">
            <BebanPenguji tahfidz={tahfidz} tahsin={tahsin} />
          </aside>
        </div>
      </div>
    </div>
  )
}
