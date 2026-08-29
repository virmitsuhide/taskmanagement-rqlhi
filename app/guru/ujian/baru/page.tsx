import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getUnitUjianGuru } from '@/lib/data/ujian'
import { FormPengajuan } from '@/components/ujian/FormPengajuan'

export default async function AjukanUjianGuruPage() {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  // Guru tanpa unit SD/SMP tidak punya koordinator yang akan menjadwalkan
  // ujiannya, jadi formnya tidak ditampilkan sama sekali — halaman daftar
  // yang menjelaskan duduk perkaranya.
  const unit = await getUnitUjianGuru(session.teacherId)
  if (!unit) redirect('/guru/ujian')

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            Ajukan Ujian
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pengajuan masuk ke antrian unit {unit}. Koordinator yang menentukan jadwal dan
            pengujinya.
          </p>
        </div>

        <FormPengajuan units={[unit]} redirectTo="/guru/ujian" />
      </div>
    </div>
  )
}
