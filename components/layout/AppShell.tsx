import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

interface Props {
  children: React.ReactNode
}

export async function AppShell({ children }: Props) {
  const session = await getSession()
  if (!session?.isLoggedIn) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        Lewati ke konten utama
      </a>
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
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-16 md:pb-0 outline-none">
        {children}
      </main>
    </div>
  )
}
