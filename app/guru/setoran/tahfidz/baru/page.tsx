import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
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
          .select('id, full_name, halaqoh:halaqoh(name)')
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

  // Juz yang sudah diujikan per siswa — untuk hint muroja'ah lama
  const completedJuzByStudent: Record<string, number[]> = {}
  const studentIds = students.map(s => s.id)
  if (studentIds.length > 0) {
    const { data: proms } = await supabase
      .from('juz_promotions')
      .select('student_id, juz_number')
      .in('student_id', studentIds)
    for (const p of (proms ?? []) as Array<{ student_id: string; juz_number: number }>) {
      ;(completedJuzByStudent[p.student_id] ??= []).push(p.juz_number)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <TeacherHeader fullName={session.fullName} active="tahfidz" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Setoran Harian</p>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            ✨ Setor Tahfidz
          </h1>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-10 text-center text-sm text-muted-foreground">
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
      </main>
    </div>
  )
}
