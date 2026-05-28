import { createServerClient } from '@/lib/supabase/server'
import { weekStartDate } from '@/lib/data/teacher-stats'
import type { Jenjang, TaskStatus } from '@/types'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const MONTH_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export interface RqAnalytics {
  overview: {
    activeStudents: number
    activeTeachers: number
    activeHalaqoh: number
    studentsByJenjang: { jenjang: Jenjang; count: number }[]
  }
  monthLabel: string
  monthly: {
    tahsinSetoran: number
    tahfidzSetoran: number
    jilidPromotions: number
    juzPromotions: number
  }
  totalAyatHafal: number
  juzMutqinTotal: number
  halaqohLeaderboard: { id: string; name: string; jenjang: Jenjang; studentCount: number; setoranThisWeek: number }[]
  attention: { id: string; full_name: string; halaqoh_name: string | null; daysSince: number | null }[]
  tasks: { byStatus: Record<TaskStatus, number>; total: number }
}

const JENJANG_ORDER: Jenjang[] = ['paud', 'sd', 'smp', 'sma']

export async function getRqAnalytics(): Promise<RqAnalytics> {
  const supabase = createServerClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const monthStartIso = isoDate(monthStart)
  const monthEndIso = isoDate(monthEnd)
  const weekStartIso = isoDate(weekStartDate(now))
  const since90 = new Date(now); since90.setDate(now.getDate() - 90)
  const since90Iso = isoDate(since90)

  const [
    studentsRes, teachersRes, halaqohListRes,
    tahsinMonthRes, tahfidzMonthRes, jilidPromRes, juzPromRes,
    juzProgressRes,
    weekTahsinRes, weekTahfidzRes,
    attnStudentsRes, recentTahsinRes, recentTahfidzRes,
    tasksRes,
  ] = await Promise.all([
    supabase.from('students').select('jenjang').eq('is_active', true),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('halaqoh').select('id, name, jenjang').eq('is_active', true),
    supabase.from('tahsin_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('tahfidz_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('jilid_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    supabase.from('juz_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    supabase.from('juz_progress').select('ayat_hafal, mutqin'),
    supabase.from('tahsin_logs').select('halaqoh_id').gte('setoran_date', weekStartIso),
    supabase.from('tahfidz_logs').select('halaqoh_id').gte('setoran_date', weekStartIso),
    supabase.from('students').select('id, full_name, halaqoh:halaqoh(name)').eq('is_active', true),
    supabase.from('tahsin_logs').select('student_id, setoran_date').gte('setoran_date', since90Iso),
    supabase.from('tahfidz_logs').select('student_id, setoran_date').gte('setoran_date', since90Iso),
    supabase.from('tasks').select('status'),
  ])

  // Overview
  const studentsByJenjangMap = new Map<Jenjang, number>()
  for (const s of studentsRes.data ?? []) {
    studentsByJenjangMap.set(s.jenjang as Jenjang, (studentsByJenjangMap.get(s.jenjang as Jenjang) ?? 0) + 1)
  }
  const studentsByJenjang = JENJANG_ORDER
    .map(j => ({ jenjang: j, count: studentsByJenjangMap.get(j) ?? 0 }))
    .filter(x => x.count > 0)
  const activeStudents = (studentsRes.data ?? []).length

  // Total hafalan
  const juzProgress = (juzProgressRes.data ?? []) as { ayat_hafal: number; mutqin: boolean }[]
  const totalAyatHafal = juzProgress.reduce((sum, j) => sum + (j.ayat_hafal ?? 0), 0)
  const juzMutqinTotal = juzProgress.filter(j => j.mutqin).length

  // Leaderboard halaqoh
  const halaqohList = (halaqohListRes.data ?? []) as { id: string; name: string; jenjang: Jenjang }[]
  const studentCountByHalaqoh = new Map<string, number>()
  // hitung siswa per halaqoh dari attnStudents (active students dengan halaqoh)
  // (gunakan query students lain? attnStudents tidak punya halaqoh_id; pakai query terpisah)
  const { data: studentHalaqohRows } = await supabase
    .from('students').select('halaqoh_id').eq('is_active', true).not('halaqoh_id', 'is', null)
  for (const r of studentHalaqohRows ?? []) {
    if (r.halaqoh_id) studentCountByHalaqoh.set(r.halaqoh_id, (studentCountByHalaqoh.get(r.halaqoh_id) ?? 0) + 1)
  }
  const weekSetoranByHalaqoh = new Map<string, number>()
  for (const r of [...(weekTahsinRes.data ?? []), ...(weekTahfidzRes.data ?? [])]) {
    if (r.halaqoh_id) weekSetoranByHalaqoh.set(r.halaqoh_id, (weekSetoranByHalaqoh.get(r.halaqoh_id) ?? 0) + 1)
  }
  const halaqohLeaderboard = halaqohList
    .map(h => ({
      id: h.id, name: h.name, jenjang: h.jenjang,
      studentCount: studentCountByHalaqoh.get(h.id) ?? 0,
      setoranThisWeek: weekSetoranByHalaqoh.get(h.id) ?? 0,
    }))
    .sort((a, b) => b.setoranThisWeek - a.setoranThisWeek)
    .slice(0, 8)

  // Siswa perlu perhatian se-RQ
  const attnStudents = (attnStudentsRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; halaqoh: { name: string } | null
  }>
  const lastByStudent = new Map<string, string>()
  for (const r of [...(recentTahsinRes.data ?? []), ...(recentTahfidzRes.data ?? [])]) {
    const cur = lastByStudent.get(r.student_id)
    if (!cur || r.setoran_date > cur) lastByStudent.set(r.student_id, r.setoran_date)
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const DAY_MS = 86_400_000
  const attention = attnStudents
    .map(s => {
      const last = lastByStudent.get(s.id)
      let daysSince: number | null
      if (!last) daysSince = null
      else {
        const d = new Date(last); d.setHours(0, 0, 0, 0)
        daysSince = Math.round((today.getTime() - d.getTime()) / DAY_MS)
      }
      return { id: s.id, full_name: s.full_name, halaqoh_name: s.halaqoh?.name ?? null, daysSince }
    })
    .filter(s => s.daysSince === null || s.daysSince >= 7)
    .sort((a, b) => {
      if (a.daysSince === null) return -1
      if (b.daysSince === null) return 1
      return b.daysSince - a.daysSince
    })
    .slice(0, 8)

  // Task distribution
  const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, submitted: 0, done: 0, returned: 0 }
  for (const t of tasksRes.data ?? []) {
    const st = t.status as TaskStatus
    if (st in byStatus) byStatus[st] += 1
  }
  const totalTasks = (tasksRes.data ?? []).length

  return {
    overview: {
      activeStudents,
      activeTeachers: teachersRes.count ?? 0,
      activeHalaqoh: halaqohList.length,
      studentsByJenjang,
    },
    monthLabel: `${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`,
    monthly: {
      tahsinSetoran: tahsinMonthRes.count ?? 0,
      tahfidzSetoran: tahfidzMonthRes.count ?? 0,
      jilidPromotions: jilidPromRes.count ?? 0,
      juzPromotions: juzPromRes.count ?? 0,
    },
    totalAyatHafal,
    juzMutqinTotal,
    halaqohLeaderboard,
    attention,
    tasks: { byStatus, total: totalTasks },
  }
}
