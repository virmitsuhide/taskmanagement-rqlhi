import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/** Isi & tata letak: lihat KONFIG['koor-sd'] di components/dashboard/DashboardPengurus.tsx. */
export default async function DashboardKoorSdPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-sd')) redirect('/dashboard')

  return <DashboardPengurus halaman="koor-sd" session={session} searchParams={await searchParams} />
}
