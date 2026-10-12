import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { PilihSuasana } from '@/components/tampilan/PilihSuasana'
import { prefAwalTampilan } from '@/lib/tampilan/suasana-akun'

/** Tampilan — suasana & ukuran teks akun pengurus. Dijaga seperti /profil. */
export default async function TampilanPengurusPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const awal = await prefAwalTampilan('users', session.userId)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Tampilan"
        ownH1
        breadcrumbs={[{ label: 'Tampilan' }]}
      />
      <PilihSuasana portal="pengurus" awal={awal} />
    </div>
  )
}
