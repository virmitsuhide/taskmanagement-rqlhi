import { redirect } from 'next/navigation'
import { getEmployeeSession } from '@/lib/auth/employee-session'
import { PilihSuasana } from '@/components/tampilan/PilihSuasana'
import { prefAwalTampilan } from '@/lib/tampilan/suasana-akun'

/** Tampilan — suasana & ukuran teks akun karyawan. Dijaga seperti /karyawan/profil. */
export default async function TampilanKaryawanPage() {
  const session = await getEmployeeSession()
  if (!session) redirect('/karyawan/login')

  const awal = await prefAwalTampilan('employees', session.employeeId)

  return (
    <div className="min-h-screen">
      <PilihSuasana portal="karyawan" awal={awal} kembaliHref="/karyawan/profil" />
    </div>
  )
}
