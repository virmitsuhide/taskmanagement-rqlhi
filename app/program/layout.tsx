import { getSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

export default async function ProgramLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session?.isLoggedIn) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex shrink-0">
        <Sidebar
          role={session.role}
          displayName={session.displayName}
          username={session.username}
        />
      </div>
      <MobileNav
        role={session.role}
        displayName={session.displayName}
        username={session.username}
      />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
