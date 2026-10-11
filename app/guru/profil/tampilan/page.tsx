import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { PilihSuasana } from '@/components/tampilan/PilihSuasana'
import { prefAwalTampilan } from '@/lib/tampilan/suasana-akun'

/** Tampilan — suasana & ukuran teks akun guru. Dijaga seperti /guru/profil. */
export default async function TampilanGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const awal = await prefAwalTampilan('teachers', session.teacherId)

  return (
    <div className="min-h-screen">
      <PilihSuasana portal="guru" awal={awal} kembaliHref="/guru/profil" />
    </div>
  )
}
