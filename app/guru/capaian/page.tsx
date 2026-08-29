import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { StudentMonthBoard } from '@/components/setoran/StudentMonthBoard'
import { currentPeriod, isValidPeriod, shiftPeriod, toPeriodDate } from '@/lib/finance/period'
import type { StudentMonthly } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string; halaqoh?: string }>
}

/**
 * Capaian awal & akhir bulan per siswa — pengganti lembar "DB Y1–Y6".
 *
 * Guru hanya melihat halaqoh yang diampunya; pemilihan halaqoh lewat query
 * string supaya tautannya bisa dibagikan dan halaman tetap server component.
 */
export default async function CapaianBulananPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(session.teacherId)

  const { data: halaqohRows } = halaqohIds.length
    ? await supabase.from('halaqoh').select('id, name').in('id', halaqohIds).order('name')
    : { data: [] }
  const halaqohList = (halaqohRows ?? []) as { id: string; name: string }[]

  const activeHalaqoh = halaqohList.find(h => h.id === params.halaqoh) ?? halaqohList[0] ?? null

  const { data: studentRows } = activeHalaqoh
    ? await supabase
        .from('students')
        .select('id, full_name, kelas, level_awal')
        .eq('halaqoh_id', activeHalaqoh.id)
        .eq('is_active', true)
        .order('full_name')
    : { data: [] }
  const students = (studentRows ?? []) as {
    id: string; full_name: string; kelas: string | null; level_awal: string
  }[]

  const { data: monthlyRows } = students.length
    ? await supabase
        .from('student_monthly')
        .select('*')
        .in('student_id', students.map(s => s.id))
        .eq('period', toPeriodDate(period))
    : { data: [] }

  const monthly = Object.fromEntries(
    ((monthlyRows ?? []) as StudentMonthly[]).map(row => [row.student_id, row]),
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        <h1
          className="text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Capaian Bulanan
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Titik awal dan akhir tiap anak dalam sebulan — dasar rapor dan rekap semester.
        </p>

        {halaqohList.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed bg-white py-10 text-center text-sm text-muted-foreground">
            Anda belum menjadi wali atau pengampu halaqoh mana pun.
          </div>
        ) : (
          <StudentMonthBoard
            period={period}
            previousPeriod={shiftPeriod(period, -1)}
            halaqohList={halaqohList}
            activeHalaqohId={activeHalaqoh?.id ?? ''}
            students={students}
            monthly={monthly}
          />
        )}
      </div>
    </div>
  )
}
