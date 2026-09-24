import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/** Isi & tata letak: lihat KONFIG['koor-ekstra'] di components/dashboard/DashboardPengurus.tsx. */
export default async function DashboardKoorEkstraPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-ekstra')) redirect('/dashboard')

  return <DashboardPengurus halaman="koor-ekstra" session={session} searchParams={await searchParams} />
}
