import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EkstraSubNav, MigrasiEkstra } from '@/components/ekstra/EkstraSubNav'
import { LaporanEkstra, rentangBulan } from '@/components/ekstra/LaporanEkstra'
import { getBookingEkstra, getDataEkstra } from '@/lib/data/ekstra'
import { currentPeriod, isValidPeriod } from '@/lib/finance/period'

export default async function LaporanEkstraPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEkstra(session.role)) redirect('/dashboard')

  const { bulan: diminta } = await searchParams
  const bulan = isValidPeriod(diminta ?? '') ? diminta! : currentPeriod()
  const [y, m] = bulan.split('-').map(Number)
  const geser = (d: number) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}` }

  const [data, peserta] = await Promise.all([getDataEkstra(), getBookingEkstra(['aktif'])])

  return (
    <div>
      <DashboardHeader role={session.role} displayName={session.displayName} title="Ekstra" showBack ownH1 />
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">Ekstra tahsin &amp; tahfidz · laporan</p>
            <h1 className="mt-1 text-3xl leading-tight">Laporan ekstra {rentangBulan(bulan).label}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Kehadiran dan setoran pertemuan ekstra — terpisah dari laporan halaqoh sekolah. Setoran ekstra anak LHI tetap memajukan capaian sekolahnya.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/ekstra/laporan?bulan=${geser(-1)}`} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">← Bulan lalu</Link>
            {bulan !== currentPeriod() && <Link href={`/ekstra/laporan?bulan=${geser(1)}`} className="rounded-lg border bg-card px-3 py-1.5 hover:bg-muted">Bulan berikutnya →</Link>}
          </div>
        </div>
        <EkstraSubNav />
        {!data.tabelAda ? <MigrasiEkstra /> : <LaporanEkstra slot={data.slot.filter(s => s.aktif)} peserta={peserta} bulan={bulan} />}
      </div>
    </div>
  )
}
