import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/** Isi & tata letak: lihat KONFIG['koor-smp'] di components/dashboard/DashboardPengurus.tsx. */
export default async function DashboardKoorSmpPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-smp')) redirect('/dashboard')

  return <DashboardPengurus halaman="koor-smp" session={session} searchParams={await searchParams} />
}
