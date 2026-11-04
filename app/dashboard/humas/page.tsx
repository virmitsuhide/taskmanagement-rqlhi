import { tolakAkses } from '@/lib/auth/tolak-akses'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { DashboardPengurus } from '@/components/dashboard/DashboardPengurus'

interface PageProps {
  searchParams: Promise<{ tugas?: string; unit?: string }>
}

/** Isi & tata letak: lihat KONFIG['humas'] di components/dashboard/DashboardPengurus.tsx. */
export default async function DashboardHumasPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'humas')) await tolakAkses()

  return <DashboardPengurus halaman="humas" session={session} searchParams={await searchParams} />
}
