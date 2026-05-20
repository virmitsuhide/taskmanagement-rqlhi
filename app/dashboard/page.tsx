import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { DEFAULT_DASHBOARD } from '@/lib/auth/permissions'

export default async function DashboardIndexPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  redirect(`/dashboard/${DEFAULT_DASHBOARD[session.role]}`)
}
