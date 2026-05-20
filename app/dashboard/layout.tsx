import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.isLoggedIn) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex shrink-0">
        <Sidebar
          role={session.role}
          displayName={session.displayName}
          username={session.username}
        />
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
