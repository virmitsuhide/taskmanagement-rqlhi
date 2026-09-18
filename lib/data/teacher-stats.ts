import { createServerClient } from '@/lib/supabase/server'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'

/** ISO date (YYYY-MM-DD) untuk perbandingan kolom `date` di Postgres. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Awal pekan ini (Senin, 00:00). */
export function weekStartDate(now = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((now.getDay() + 6) % 7))
  return d
}

export interface TeacherWeeklyStats {
  tahsinCount: number
  tahfidzCount: number
  jilidPromotions: number
  juzPromotions: number
  activeStudents: number
  setorTodayCount: number
}

export async function getTeacherWeeklyStats(teacherId: string): Promise<TeacherWeeklyStats> {
  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(teacherId)

  const now = new Date()
  const todayIso = isoDate(now)
  const weekStartIso = isoDate(weekStartDate(now))

  const [
    tahsinRes, tahfidzRes, jilidPromRes, juzPromRes, activeRes,
    tahsinTodayRes, tahfidzTodayRes,
  ] = await Promise.all([
    supabase.from('tahsin_logs').select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).gte('setoran_date', weekStartIso),
    supabase.from('tahfidz_logs').select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).gte('setoran_date', weekStartIso),
    supabase.from('jilid_promotions').select('*', { count: 'exact', head: true })
      .eq('promoted_by', teacherId).gte('promotion_date', weekStartIso),
    supabase.from('juz_promotions').select('*', { count: 'exact', head: true })
      .eq('promoted_by', teacherId).gte('promotion_date', weekStartIso),
    halaqohIds.length > 0
      ? supabase.from('students').select('*', { count: 'exact', head: true })
          .in('halaqoh_id', halaqohIds).eq('is_active', true)
      : Promise.resolve({ count: 0 }),
    supabase.from('tahsin_logs').select('student_id').eq('teacher_id', teacherId).eq('setoran_date', todayIso),
    supabase.from('tahfidz_logs').select('student_id').eq('teacher_id', teacherId).eq('setoran_date', todayIso),
  ])

  // Siswa unik yang setor hari ini (gabungan tahsin + tahfidz)
  const setorToday = new Set<string>()
  for (const r of tahsinTodayRes.data ?? []) setorToday.add(r.student_id)
  for (const r of tahfidzTodayRes.data ?? []) setorToday.add(r.student_id)

  return {
    tahsinCount: tahsinRes.count ?? 0,
    tahfidzCount: tahfidzRes.count ?? 0,
    jilidPromotions: jilidPromRes.count ?? 0,
    juzPromotions: juzPromRes.count ?? 0,
    activeStudents: activeRes.count ?? 0,
    setorTodayCount: setorToday.size,
  }
}

export interface HalaqohSummary {
  id: string
  name: string
  jenjang: string
  studentCount: number
  setorTodayCount: number
}

export async function getTeacherHalaqohSummary(teacherId: string): Promise<HalaqohSummary[]> {
  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(teacherId)
  if (halaqohIds.length === 0) return []

  const todayIso = isoDate(new Date())

  const [halaqohRes, studentsRes, tahsinTodayRes, tahfidzTodayRes] = await Promise.all([
    supabase.from('halaqoh').select('id, name, jenjang').in('id', halaqohIds).order('name'),
    supabase.from('students').select('id, halaqoh_id').in('halaqoh_id', halaqohIds).eq('is_active', true),
    supabase.from('tahsin_logs').select('student_id, halaqoh_id').in('halaqoh_id', halaqohIds).eq('setoran_date', todayIso),
    supabase.from('tahfidz_logs').select('student_id, halaqoh_id').in('halaqoh_id', halaqohIds).eq('setoran_date', todayIso),
  ])

  const studentCountByHalaqoh = new Map<string, number>()
  for (const s of studentsRes.data ?? []) {
    if (s.halaqoh_id) studentCountByHalaqoh.set(s.halaqoh_id, (studentCountByHalaqoh.get(s.halaqoh_id) ?? 0) + 1)
  }

  // Siswa unik yang setor hari ini per halaqoh
  const setorByHalaqoh = new Map<string, Set<string>>()
  for (const r of [...(tahsinTodayRes.data ?? []), ...(tahfidzTodayRes.data ?? [])]) {
    if (!r.halaqoh_id) continue
    if (!setorByHalaqoh.has(r.halaqoh_id)) setorByHalaqoh.set(r.halaqoh_id, new Set())
    setorByHalaqoh.get(r.halaqoh_id)!.add(r.student_id)
  }

  return (halaqohRes.data ?? []).map(h => ({
    id: h.id,
    name: h.name,
    jenjang: h.jenjang,
    studentCount: studentCountByHalaqoh.get(h.id) ?? 0,
    setorTodayCount: setorByHalaqoh.get(h.id)?.size ?? 0,
  }))
}
