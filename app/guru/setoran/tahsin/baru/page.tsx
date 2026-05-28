import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherHeader } from '@/components/layout/TeacherHeader'
import { TahsinSetoranForm } from './TahsinSetoranForm'

interface PageProps {
  searchParams: Promise<{ student?: string }>
}

export default async function NewTahsinSetoranPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const { student: defaultStudentId } = await searchParams

  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(session.teacherId)

  const [studentsRes, methodsRes, jilidRes] = await Promise.all([
    halaqohIds.length > 0
      ? supabase
          .from('students')
          .select('id, full_name, current_method_id, current_jilid_id, current_jilid_page, halaqoh:halaqoh(name)')
          .in('halaqoh_id', halaqohIds)
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num').order('order_num'),
  ])

  const students = ((studentsRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; current_method_id: string | null
    current_jilid_id: string | null; current_jilid_page: number | null
    halaqoh: { name: string } | null
  }>).map(s => ({
    id: s.id,
    full_name: s.full_name,
    halaqoh_name: s.halaqoh?.name ?? null,
    current_method_id: s.current_method_id,
    current_jilid_id: s.current_jilid_id,
    current_jilid_page: s.current_jilid_page,
  }))

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <TeacherHeader fullName={session.fullName} active="setoran" />

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">Setoran Harian</p>
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
          >
            📖 Setor Tahsin
          </h1>
        </div>

        {students.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white py-10 text-center text-sm text-muted-foreground">
            Belum ada siswa di halaqoh Anda. Hubungi admin untuk assign siswa.
          </div>
        ) : (
          <TahsinSetoranForm
            students={students}
            methods={methodsRes.data ?? []}
            jilidLevels={jilidRes.data ?? []}
            defaultStudentId={defaultStudentId}
          />
        )}
      </main>
    </div>
  )
}
