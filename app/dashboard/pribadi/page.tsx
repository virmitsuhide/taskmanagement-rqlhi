import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/** Isi & tata letak: lihat KONFIG['pribadi'] di components/dashboard/DashboardPengurus.tsx. */
export default async function DashboardPribadiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'pribadi')) redirect('/dashboard')

  return <DashboardPengurus halaman="pribadi" session={session} searchParams={await searchParams} />
}
