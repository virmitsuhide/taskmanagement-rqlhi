import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getUnitsUjianGuru } from '@/lib/data/ujian'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { punyaKelompokAsrama } from '@/lib/data/asrama'
import { UJIAN_UNIT_SEKOLAH } from '@/lib/rq/ujian'
import { FormPengajuan } from '@/components/ujian/FormPengajuan'
import { HalamanGuru } from '@/components/guru/HalamanGuru'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AjukanUjianGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  // Guru tanpa unit tidak punya koordinator yang akan menjadwalkan
  // ujiannya, jadi formnya tidak ditampilkan sama sekali — halaman daftar
  // yang menjelaskan duduk perkaranya.
  const [units, halaqohIds, asrama] = await Promise.all([
    getUnitsUjianGuru(session.teacherId),
    getTeacherHalaqohIds(session.teacherId),
    punyaKelompokAsrama(session.teacherId).catch(() => false),
  ])
  if (units.length === 0) redirect('/guru/ujian')
  // Musyrif/ah murni (kelompok asrama, tanpa halaqoh sekolah): ujian tahsin
  // dikelompokkan per halaqoh sekolah, jadi yang bisa ia ajukan hanya tahfidz.
  const hanyaTahfidz = asrama && halaqohIds.length === 0

  return (
    <HalamanGuru
      lebar="sempit"
      judul="Ajukan Ujian"
      keterangan={`Pengajuan masuk ke antrian ${units.map(u => UJIAN_UNIT_SEKOLAH[u]).join(' / ')}. Koordinator yang menentukan jadwal dan pengujinya.`}
      atas={
        <Link href="/guru/ujian" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Pengajuan Ujian
        </Link>
      }
    >
      <FormPengajuan units={units} redirectTo="/guru/ujian" hanyaTahfidz={hanyaTahfidz} />
    </HalamanGuru>
  )
}
