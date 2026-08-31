import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { hitungMenungguKoordinator } from '@/lib/data/kpi-pengesahan'
import { hitungBandingMenunggu } from '@/lib/data/kpi-banding'

interface Props {
  children: React.ReactNode
}

export async function AppShell({ children }: Props) {
  const session = await getSession()
  if (!session?.isLoggedIn) redirect('/login')

  // Lencana alur rapor KPI. Dihitung di sini, bukan di tiap halaman: keduanya
  // menempel di navigasi yang ikut ke mana pun, dan pemberitahuan yang hanya
  // muncul di halaman KPI hanya akan sampai kepada orang yang memang sudah
  // membuka halaman KPI.
  const [menungguKoor, bandingMenunggu] = await Promise.all([
    hitungMenungguKoordinator(session.role),
    hitungBandingMenunggu(session.role),
  ])
  const lencanaKpi = { publikasi: menungguKoor, banding: bandingMenunggu }

  return (
    // Saat dicetak, tinggi tetap + scroll internal harus dilepas. Browser
    // hanya mencetak apa yang muat di kotak setinggi layar itu, sehingga
    // halaman sepanjang apa pun keluar sebagai satu lembar terpotong.
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        Lewati ke konten utama
      </a>
      <div className="hidden md:flex shrink-0 print:hidden">
        <Sidebar
          role={session.role}
          displayName={session.displayName}
          username={session.username}
          lencanaKpi={lencanaKpi}
        />
      </div>
      <MobileNav
        role={session.role}
        displayName={session.displayName}
        username={session.username}
        lencanaKpi={lencanaKpi}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-16 md:pb-0 outline-none print:overflow-visible print:pb-0">
        {children}
      </main>
    </div>
  )
}
