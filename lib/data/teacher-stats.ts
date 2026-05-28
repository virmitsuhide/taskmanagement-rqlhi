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

export interface DailyActivity {
  date: string       // ISO
  label: string      // 'Sen', 'Sel', ...
  tahsin: number
  tahfidz: number
}

const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

/** Aktivitas setoran N hari terakhir (default 7) untuk sparkline. */
export async function getTeacherDailyActivity(teacherId: string, days = 7): Promise<DailyActivity[]> {
  const supabase = createServerClient()
  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1))
  const startIso = isoDate(start)

  const [tahsinRes, tahfidzRes] = await Promise.all([
    supabase.from('tahsin_logs').select('setoran_date').eq('teacher_id', teacherId).gte('setoran_date', startIso),
    supabase.from('tahfidz_logs').select('setoran_date').eq('teacher_id', teacherId).gte('setoran_date', startIso),
  ])

  const tahsinByDate = new Map<string, number>()
  for (const r of tahsinRes.data ?? []) tahsinByDate.set(r.setoran_date, (tahsinByDate.get(r.setoran_date) ?? 0) + 1)
  const tahfidzByDate = new Map<string, number>()
  for (const r of tahfidzRes.data ?? []) tahfidzByDate.set(r.setoran_date, (tahfidzByDate.get(r.setoran_date) ?? 0) + 1)

  const result: DailyActivity[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const iso = isoDate(d)
    result.push({
      date: iso,
      label: DAY_SHORT[d.getDay()],
      tahsin: tahsinByDate.get(iso) ?? 0,
      tahfidz: tahfidzByDate.get(iso) ?? 0,
    })
  }
  return result
}

export interface AttentionStudent {
  id: string
  full_name: string
  halaqoh_name: string | null
  daysSinceLastSetoran: number | null  // null = belum pernah
}

/**
 * Siswa yang perlu perhatian: belum setor (tahsin/tahfidz) lebih dari `thresholdDays`.
 * Diurutkan paling lama belum setor di atas.
 */
export async function getStudentsNeedingAttention(
  teacherId: string,
  thresholdDays = 3,
): Promise<AttentionStudent[]> {
  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(teacherId)
  if (halaqohIds.length === 0) return []

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, halaqoh:halaqoh(name)')
    .in('halaqoh_id', halaqohIds)
    .eq('is_active', true)

  const studentRows = (students ?? []) as unknown as Array<{
    id: string; full_name: string; halaqoh: { name: string } | null
  }>
  if (studentRows.length === 0) return []

  const ids = studentRows.map(s => s.id)
  const [tahsinRes, tahfidzRes] = await Promise.all([
    supabase.from('tahsin_logs').select('student_id, setoran_date').in('student_id', ids).order('setoran_date', { ascending: false }),
    supabase.from('tahfidz_logs').select('student_id, setoran_date').in('student_id', ids).order('setoran_date', { ascending: false }),
  ])

  // Tanggal setoran terakhir per siswa (max dari tahsin & tahfidz)
  const lastByStudent = new Map<string, string>()
  for (const r of [...(tahsinRes.data ?? []), ...(tahfidzRes.data ?? [])]) {
    const cur = lastByStudent.get(r.student_id)
    if (!cur || r.setoran_date > cur) lastByStudent.set(r.student_id, r.setoran_date)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const DAY_MS = 1000 * 60 * 60 * 24

  const result: AttentionStudent[] = []
  for (const s of studentRows) {
    const last = lastByStudent.get(s.id)
    let days: number | null
    if (!last) {
      days = null
    } else {
      const d = new Date(last); d.setHours(0, 0, 0, 0)
      days = Math.round((today.getTime() - d.getTime()) / DAY_MS)
    }
    if (days === null || days >= thresholdDays) {
      result.push({
        id: s.id,
        full_name: s.full_name,
        halaqoh_name: s.halaqoh?.name ?? null,
        daysSinceLastSetoran: days,
      })
    }
  }

  // null (belum pernah) paling atas, lalu yang paling lama
  result.sort((a, b) => {
    if (a.daysSinceLastSetoran === null) return -1
    if (b.daysSinceLastSetoran === null) return 1
    return b.daysSinceLastSetoran - a.daysSinceLastSetoran
  })
  return result
}
