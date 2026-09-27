import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEkstra, canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'
import { RingkasKoorEkstra } from '@/components/ekstra/RingkasKoorEkstra'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/**
 * Isi & tata letak: lihat KONFIG['koor-ekstra'] di components/dashboard/DashboardPengurus.tsx.
 * Ringkasan ekstra (jawaban hari ini, halaqoh hari ini, kotak masuk, kursi longgar) di atasnya.
 */
export default async function DashboardKoorEkstraPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-ekstra')) redirect('/dashboard')

  return (
    <DashboardPengurus halaman="koor-ekstra" session={session} searchParams={await searchParams}
      atas={canManageEkstra(session.role) ? <RingkasKoorEkstra /> : null} />
  )
}
