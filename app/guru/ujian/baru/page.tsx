import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { FormPengajuan } from '@/components/ujian/FormPengajuan'
import { HalamanGuru } from '@/components/guru/HalamanGuru'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AjukanUjianGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  // Guru tanpa unit SD/SMP tidak punya koordinator yang akan menjadwalkan
  // ujiannya, jadi formnya tidak ditampilkan sama sekali — halaman daftar
  // yang menjelaskan duduk perkaranya.
  const unit = await getUnitUjianGuru(session.teacherId)
  if (!unit) redirect('/guru/ujian')

  return (
    <HalamanGuru
      lebar="sempit"
      judul="Ajukan Ujian"
      keterangan={`Pengajuan masuk ke antrian unit ${unit}. Koordinator yang menentukan jadwal dan pengujinya.`}
      atas={
        <Link href="/guru/ujian" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Pengajuan Ujian
        </Link>
      }
    >
      <FormPengajuan units={[unit]} redirectTo="/guru/ujian" />
    </HalamanGuru>
  )
}
