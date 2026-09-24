import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getJuzTerujiPerSiswa } from '@/lib/data/hafalan'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TahfidzSetoranForm } from './TahfidzSetoranForm'

interface PageProps {
  searchParams: Promise<{ student?: string }>
}

export default async function NewTahfidzSetoranPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { student: defaultStudentId } = await searchParams

  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(session.teacherId)

  const [studentsRes, suratRes] = await Promise.all([
    halaqohIds.length > 0
      ? supabase
          .from('students')
          .select('id, full_name, halaqoh:halaqoh!students_halaqoh_id_fkey(name)')
          .in('halaqoh_id', halaqohIds)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from('surat_master')
      .select('id, name_latin, total_ayat, juz_start')
      .order('id'),
  ])

  const students = ((studentsRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; halaqoh: { name: string } | null
  }>).map(s => ({
    id: s.id,
    full_name: s.full_name,
    halaqoh_name: s.halaqoh?.name ?? null,
  }))

  // Juz teruji per siswa — untuk hint muroja'ah lama. Sumbernya ujian yang
  // sudah selesai, bukan centang "mutqin" di setoran yang sudah dicabut.
  const juzTeruji = await getJuzTerujiPerSiswa(students.map(s => s.id))
  const completedJuzByStudent: Record<string, number[]> = Object.fromEntries(juzTeruji)

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-warning">Setoran Harian</p>
            <h1
              className="text-3xl tracking-tight"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              Setor Tahfidz
            </h1>
          </div>
          <Link href="/guru/setoran/tahfidz/sesi" className="text-sm font-medium text-primary hover:underline">
            Setor satu sesi sekaligus →
          </Link>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
            Belum ada siswa di halaqoh Anda. Hubungi admin untuk assign siswa.
          </div>
        ) : (
          <TahfidzSetoranForm
            students={students}
            surat={suratRes.data ?? []}
            completedJuzByStudent={completedJuzByStudent}
            defaultStudentId={defaultStudentId}
          />
        )}
      </div>
    </div>
  )
}
