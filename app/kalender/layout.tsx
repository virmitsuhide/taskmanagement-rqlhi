import { getSession } from '@/lib/auth/session'
import { AppShell } from '@/components/layout/AppShell'

/**
 * Kalender pendidikan sengaja publik (wali murid membukanya tanpa akun), jadi
 * sidebar pengurus hanya dipasang bila yang membuka sedang masuk. Tamu tetap
 * mendapat header & footer situs publik dari halamannya sendiri.
 */
export default async function KalenderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.isLoggedIn) return children
  return <AppShell>{children}</AppShell>
}
