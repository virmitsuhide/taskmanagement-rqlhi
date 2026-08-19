import { createServerClient } from '@/lib/supabase/server'
import { UNIT_ORDER, UNIT_LABELS, PROGRAMS_BY_JENJANG, programLabel } from '@/lib/rq/programs'
import { TAHFIDZ_TARGETS } from '@/lib/rq/targets'
import type { Jenjang } from '@/types'

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
  juzMutqinTotal: number
}

const JENJANG_ORDER: Jenjang[] = ['paud', 'sd', 'sd_juara', 'smp', 'sma']

export async function getRqAnalytics(): Promise<RqAnalytics> {
  const supabase = createServerClient()

  const now = new Date()
  const monthStartIso = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEndIso = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const [
    studentsRes, teachersRes, halaqohRes,
    tahsinMonthRes, tahfidzMonthRes, jilidPromRes, juzPromRes,
    juzProgressRes,
  ] = await Promise.all([
    supabase.from('students').select('jenjang').eq('is_active', true),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    supabase.from('halaqoh').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('tahsin_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('tahfidz_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('jilid_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    supabase.from('juz_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    supabase.from('juz_progress').select('mutqin'),
  ])

  const studentsByJenjangMap = new Map<Jenjang, number>()
  for (const s of studentsRes.data ?? []) {
    studentsByJenjangMap.set(s.jenjang as Jenjang, (studentsByJenjangMap.get(s.jenjang as Jenjang) ?? 0) + 1)
  }
  // Semua unit selalu ditulis, termasuk yang belum punya siswa — angka 0 itu
  // sendiri informasi (unit belum terdata), bukan alasan menyembunyikan baris.
  const studentsByJenjang = JENJANG_ORDER
    .map(j => ({ jenjang: j, count: studentsByJenjangMap.get(j) ?? 0 }))

  const juzMutqinTotal = ((juzProgressRes.data ?? []) as { mutqin: boolean }[]).filter(j => j.mutqin).length

  return {
    overview: {
      activeStudents: (studentsRes.data ?? []).length,
      activeTeachers: teachersRes.count ?? 0,
      activeHalaqoh: halaqohRes.count ?? 0,
      studentsByJenjang,
    },
    monthLabel: `${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`,
    monthly: {
      tahsinSetoran: tahsinMonthRes.count ?? 0,
      tahfidzSetoran: tahfidzMonthRes.count ?? 0,
      jilidPromotions: jilidPromRes.count ?? 0,
      juzPromotions: juzPromRes.count ?? 0,
    },
    juzMutqinTotal,
  }
}

// ─── Analitik khusus Tahsin & Tahfidz (manajemen) ───────────────────
/** Rata-rata rubrik baru: nilai pokok (tahsin/tahfidz) dan nilai sikap. */
type Avg2 = { nilai: number | null; sikap: number | null }

export interface TahsinTahfidzAnalytics {
  monthLabel: string
  totals: { activeStudents: number; lulusTahsin: number; totalAyatHafal: number; juzMutqin: number }
  byJenjang: { jenjang: Jenjang; count: number }[]
  byMethod: { method: string; count: number }[]
  levelDistribution: {
    method: string
    levels: { label: string; order_num: number; count: number; isTerminal: boolean; isQuran: boolean }[]
  }[]
  tahsinMonth: { setoran: number; lulus: number; ulang: number; avg: Avg2 }
  tahfidzMonth: { ziyadah: number; murojaahBaru: number; murojaahLama: number; tasmi: number; avg: Avg2 }
  juzHistogram: { juz: number; students: number }[]
}

// Rata-rata nilai (coerce Number — numeric Postgres bisa string), bulat 0.5.
function avgOf(vals: (number | string | null | undefined)[]): number | null {
  const n = vals.map(Number).filter(v => !Number.isNaN(v))
  if (n.length === 0) return null
  return Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 2) / 2
}

export async function getTahsinTahfidzAnalytics(): Promise<TahsinTahfidzAnalytics> {
  const supabase = createServerClient()
  const now = new Date()
  const monthStartIso = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEndIso = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const [
    studentsRes, methodsRes, levelsRes, juzProgressRes,
    tahsinMonthRes, tahfidzMonthRes, tasmiMonthRes,
  ] = await Promise.all([
    supabase.from('students').select('jenjang, current_method_id, current_jilid_id').eq('is_active', true),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, is_terminal, is_quran'),
    supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin'),
    supabase.from('tahsin_logs').select('status, nilai_tahsin, nilai_sikap').gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('tahfidz_logs').select('kind, nilai_tahfidz, nilai_sikap').gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('tasmi_logs').select('nilai_tahfidz, nilai_sikap').gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
  ])

  const students = (studentsRes.data ?? []) as { jenjang: Jenjang; current_method_id: string | null; current_jilid_id: string | null }[]
  const methods = (methodsRes.data ?? []) as { id: string; name: string }[]
  const levels = (levelsRes.data ?? []) as { id: string; method_id: string; label: string; order_num: number; is_terminal: boolean; is_quran: boolean }[]
  const levelById = new Map(levels.map(l => [l.id, l]))

  // Distribusi jenjang & metode
  const jenjangMap = new Map<Jenjang, number>()
  const methodMap = new Map<string, number>()
  let lulusTahsin = 0
  const levelCount = new Map<string, number>() // level_id → count
  for (const s of students) {
    jenjangMap.set(s.jenjang, (jenjangMap.get(s.jenjang) ?? 0) + 1)
    if (s.current_method_id) methodMap.set(s.current_method_id, (methodMap.get(s.current_method_id) ?? 0) + 1)
    if (s.current_jilid_id) {
      levelCount.set(s.current_jilid_id, (levelCount.get(s.current_jilid_id) ?? 0) + 1)
      if (levelById.get(s.current_jilid_id)?.is_terminal) lulusTahsin++
    }
  }
  const byJenjang = JENJANG_ORDER.map(j => ({ jenjang: j, count: jenjangMap.get(j) ?? 0 })).filter(x => x.count > 0)
  const byMethod = methods.map(m => ({ method: m.name, count: methodMap.get(m.id) ?? 0 })).filter(x => x.count > 0)

  // Distribusi level per metode (semua level, termasuk yang kosong → terlihat cakupannya)
  const levelDistribution = methods.map(m => ({
    method: m.name,
    levels: levels
      .filter(l => l.method_id === m.id)
      .sort((a, b) => a.order_num - b.order_num)
      .map(l => ({ label: l.label, order_num: l.order_num, count: levelCount.get(l.id) ?? 0, isTerminal: l.is_terminal, isQuran: l.is_quran })),
  })).filter(m => m.levels.length > 0)

  // Juz
  const juzProgress = (juzProgressRes.data ?? []) as { student_id: string; juz_number: number; ayat_hafal: number; mutqin: boolean }[]
  const totalAyatHafal = juzProgress.reduce((sum, j) => sum + (j.ayat_hafal ?? 0), 0)
  const juzMutqin = juzProgress.filter(j => j.mutqin).length
  // Histogram: juz tertinggi yang dicapai tiap siswa
  const maxJuzByStudent = new Map<string, number>()
  for (const j of juzProgress) {
    maxJuzByStudent.set(j.student_id, Math.max(maxJuzByStudent.get(j.student_id) ?? 0, j.juz_number))
  }
  const juzHistMap = new Map<number, number>()
  for (const juz of maxJuzByStudent.values()) juzHistMap.set(juz, (juzHistMap.get(juz) ?? 0) + 1)
  const juzHistogram = [...juzHistMap.entries()].map(([juz, students]) => ({ juz, students })).sort((a, b) => a.juz - b.juz)

  // Tahsin bulan ini
  const tahsinLogs = (tahsinMonthRes.data ?? []) as { status: string; nilai_tahsin: number | string | null; nilai_sikap: number | string | null }[]
  const tahsinMonth = {
    setoran: tahsinLogs.length,
    lulus: tahsinLogs.filter(l => l.status === 'lulus').length,
    ulang: tahsinLogs.filter(l => l.status === 'ulang').length,
    avg: {
      nilai: avgOf(tahsinLogs.map(l => l.nilai_tahsin)),
      sikap: avgOf(tahsinLogs.map(l => l.nilai_sikap)),
    },
  }

  // Tahfidz bulan ini
  const tahfidzLogs = (tahfidzMonthRes.data ?? []) as { kind: string; nilai_tahfidz: number | string | null; nilai_sikap: number | string | null }[]
  const normKind = (k: string) => (k === 'hafalan_baru' ? 'ziyadah' : k === 'murojaah' ? 'murojaah_baru' : k)
  const tasmiLogs = (tasmiMonthRes.data ?? []) as { nilai_tahfidz: number | string | null; nilai_sikap: number | string | null }[]
  const tahfidzMonth = {
    ziyadah: tahfidzLogs.filter(l => normKind(l.kind) === 'ziyadah').length,
    murojaahBaru: tahfidzLogs.filter(l => normKind(l.kind) === 'murojaah_baru').length,
    murojaahLama: tahfidzLogs.filter(l => normKind(l.kind) === 'murojaah_lama').length,
    tasmi: tasmiLogs.length,
    avg: {
      nilai: avgOf([...tahfidzLogs, ...tasmiLogs].map(l => l.nilai_tahfidz)),
      sikap: avgOf([...tahfidzLogs, ...tasmiLogs].map(l => l.nilai_sikap)),
    },
  }

  return {
    monthLabel: `${MONTH_ID[now.getMonth()]} ${now.getFullYear()}`,
    totals: { activeStudents: students.length, lulusTahsin, totalAyatHafal, juzMutqin },
    byJenjang,
    byMethod,
    levelDistribution,
    tahsinMonth,
    tahfidzMonth,
    juzHistogram,
  }
}

// ─── Analitik pembelajaran per Unit & Program (manajemen) ───────────
export interface ProgramAnalytics {
  code: string | null
  label: string
  studentCount: number
  tahsin: { lulus: number; belumLulus: number }
  tahfidz: { totalAyatHafal: number; juzMutqin: number }
  juziyah: { studentName: string; juz: number; score: number | null; date: string }[]
  tasmi: { studentName: string; scopeJuz: number; juzFrom: number; juzTo: number; status: string; date: string }[]
}

export interface UnitAnalytics {
  jenjang: Jenjang
  label: string
  hasPrograms: boolean
  studentCount: number
  programs: ProgramAnalytics[]
}

interface Bucket {
  studentCount: number
  lulus: number
  belumLulus: number
  totalAyatHafal: number
  juzMutqin: number
  juziyah: ProgramAnalytics['juziyah']
  tasmi: ProgramAnalytics['tasmi']
}

function emptyBucket(): Bucket {
  return { studentCount: 0, lulus: 0, belumLulus: 0, totalAyatHafal: 0, juzMutqin: 0, juziyah: [], tasmi: [] }
}

const EXAM_LIMIT = 20

export async function getUnitProgramAnalytics(): Promise<UnitAnalytics[]> {
  const supabase = createServerClient()

  const [studentsRes, levelsRes, juzProgressRes, juzPromRes, tasmiRes] = await Promise.all([
    supabase.from('students').select('id, full_name, jenjang, program, current_jilid_id').eq('is_active', true),
    supabase.from('jilid_levels').select('id, is_terminal'),
    supabase.from('juz_progress').select('student_id, ayat_hafal, mutqin'),
    supabase.from('juz_promotions').select('student_id, juz_number, exam_score, promotion_date'),
    supabase.from('tasmi_logs').select('student_id, scope_juz, juz_from, juz_to, status, setoran_date'),
  ])

  const students = (studentsRes.data ?? []) as { id: string; full_name: string; jenjang: Jenjang; program: string | null; current_jilid_id: string | null }[]
  const terminalSet = new Set(((levelsRes.data ?? []) as { id: string; is_terminal: boolean }[]).filter(l => l.is_terminal).map(l => l.id))

  // Peta siswa → (jenjang, program) + kunci bucket.
  const bucketKey = (jenjang: Jenjang, program: string | null) => `${jenjang}::${program ?? ''}`
  const studentMeta = new Map<string, { jenjang: Jenjang; program: string | null; name: string }>()
  const buckets = new Map<string, Bucket>()
  const getBucket = (key: string) => {
    let b = buckets.get(key)
    if (!b) { b = emptyBucket(); buckets.set(key, b) }
    return b
  }

  for (const s of students) {
    // paud tak punya program → paksa null agar jadi satu bucket.
    const program = s.jenjang === 'paud' ? null : s.program
    studentMeta.set(s.id, { jenjang: s.jenjang, program, name: s.full_name })
    const b = getBucket(bucketKey(s.jenjang, program))
    b.studentCount++
    if (s.current_jilid_id && terminalSet.has(s.current_jilid_id)) b.lulus++
    else b.belumLulus++
  }

  for (const row of (juzProgressRes.data ?? []) as { student_id: string; ayat_hafal: number; mutqin: boolean }[]) {
    const meta = studentMeta.get(row.student_id)
    if (!meta) continue
    const b = getBucket(bucketKey(meta.jenjang, meta.program))
    b.totalAyatHafal += row.ayat_hafal ?? 0
    if (row.mutqin) b.juzMutqin++
  }

  for (const row of (juzPromRes.data ?? []) as { student_id: string; juz_number: number; exam_score: number | string | null; promotion_date: string }[]) {
    const meta = studentMeta.get(row.student_id)
    if (!meta) continue
    const b = getBucket(bucketKey(meta.jenjang, meta.program))
    const score = row.exam_score === null ? null : Number(row.exam_score)
    b.juziyah.push({ studentName: meta.name, juz: row.juz_number, score: Number.isNaN(score as number) ? null : score, date: row.promotion_date })
  }

  for (const row of (tasmiRes.data ?? []) as { student_id: string; scope_juz: number; juz_from: number; juz_to: number; status: string; setoran_date: string }[]) {
    const meta = studentMeta.get(row.student_id)
    if (!meta) continue
    const b = getBucket(bucketKey(meta.jenjang, meta.program))
    b.tasmi.push({ studentName: meta.name, scopeJuz: row.scope_juz, juzFrom: row.juz_from, juzTo: row.juz_to, status: row.status, date: row.setoran_date })
  }

  // Rakit hasil per unit.
  const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date)

  function toProgramAnalytics(jenjang: Jenjang, code: string | null, label: string): ProgramAnalytics {
    const b = buckets.get(bucketKey(jenjang, code)) ?? emptyBucket()
    return {
      code, label,
      studentCount: b.studentCount,
      tahsin: { lulus: b.lulus, belumLulus: b.belumLulus },
      tahfidz: { totalAyatHafal: b.totalAyatHafal, juzMutqin: b.juzMutqin },
      juziyah: [...b.juziyah].sort(byDateDesc).slice(0, EXAM_LIMIT),
      tasmi: [...b.tasmi].sort(byDateDesc).slice(0, EXAM_LIMIT),
    }
  }

  return UNIT_ORDER.map(jenjang => {
    const defs = PROGRAMS_BY_JENJANG[jenjang]
    const hasPrograms = defs.length > 0
    let programs: ProgramAnalytics[]

    if (!hasPrograms) {
      // TPAIT: satu bucket tanpa program.
      programs = [toProgramAnalytics(jenjang, null, 'Tahsin & Tahfidz')]
    } else {
      programs = defs.map(p => toProgramAnalytics(jenjang, p.code, p.label))
      // Bucket "belum ditandai" bila ada siswa unit ini tanpa program valid.
      const untagged = buckets.get(bucketKey(jenjang, null))
      if (untagged && untagged.studentCount > 0) {
        programs.push(toProgramAnalytics(jenjang, null, programLabel(jenjang, null)))
      }
    }

    const studentCount = programs.reduce((sum, p) => sum + p.studentCount, 0)
    return { jenjang, label: UNIT_LABELS[jenjang], hasPrograms, studentCount, programs }
  })
}

// ─── Analitik pembelajaran lengkap per Unit (tabs + tahsin & tahfidz) ─
// Urutan hafalan RQ LHI: 30→26 lalu 1→25.
function juzOrderPos(juz: number): number {
  // posisi kontigu dalam urutan hafalan (30→0 … 26→4, 1→5 … 25→29)
  return juz >= 26 ? 30 - juz : juz + 4
}
function juzHafalCount(currentJuz: number | null): number {
  // Jumlah juz yang SUDAH tuntas (juz yang sedang dihafal tak dihitung).
  // Urutan 30→26 lalu 1→25: juz 30→0, 26→4, juz 1→5, …, juz 25→29.
  if (currentJuz === null) return 0
  return currentJuz >= 26 ? 30 - currentJuz : currentJuz + 4
}
const numOrNull = (v: number | string | null): number | null => {
  if (v === null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export interface UnitLearning {
  jenjang: Jenjang
  label: string
  hasPrograms: boolean
  studentCount: number
  programs: ProgramAnalytics[]
  kpi: { activeStudents: number; teachers: number; halaqoh: number }
  byMethod: { method: string; count: number }[]
  levelDistribution: { method: string; levels: { label: string; order_num: number; count: number; isTerminal: boolean; isQuran: boolean }[] }[]
  jilidByKelas: { kelas: string; total: number; levels: { label: string; count: number }[] }[]
  juzHistogram: { juz: number; students: number }[]
  juzByKelas: { kelas: string; total: number; avgJuz: number; distribution: { juzCount: number; students: number }[] }[]
  logs: {
    tahsin: { date: string; status: string; n: number | null; s: number | null }[]
    tahfidz: { date: string; kind: string; n: number | null; s: number | null }[]
    tasmi: { date: string; n: number | null; s: number | null }[]
  }
}

export async function getUnitLearning(): Promise<UnitLearning[]> {
  const supabase = createServerClient()

  const [studentsRes, methodsRes, levelsRes, juzProgressRes, juzPromRes, tasmiRes, tahsinRes, tahfidzRes, halaqohRes, htRes] = await Promise.all([
    supabase.from('students').select('id, full_name, jenjang, kelas, program, current_method_id, current_jilid_id').eq('is_active', true),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, is_terminal, is_quran'),
    supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin'),
    supabase.from('juz_promotions').select('student_id, juz_number, exam_score, promotion_date'),
    supabase.from('tasmi_logs').select('student_id, scope_juz, juz_from, juz_to, status, setoran_date, nilai_tahfidz, nilai_sikap'),
    supabase.from('tahsin_logs').select('student_id, setoran_date, status, nilai_tahsin, nilai_sikap'),
    supabase.from('tahfidz_logs').select('student_id, setoran_date, kind, nilai_tahfidz, nilai_sikap'),
    supabase.from('halaqoh').select('id, jenjang, wali_teacher_id').eq('is_active', true),
    supabase.from('halaqoh_teachers').select('halaqoh_id, teacher_id'),
  ])

  interface S { id: string; full_name: string; jenjang: Jenjang; kelas: string | null; program: string | null; method: string | null; jilid: string | null }
  const students: S[] = (studentsRes.data ?? []).map((s): S => ({
    id: s.id, full_name: s.full_name, jenjang: s.jenjang as Jenjang, kelas: s.kelas,
    program: s.program, method: s.current_method_id, jilid: s.current_jilid_id,
  }))
  const stById = new Map(students.map(s => [s.id, s]))

  const methods = (methodsRes.data ?? []) as { id: string; name: string }[]
  const levels = (levelsRes.data ?? []) as { id: string; method_id: string; label: string; order_num: number; is_terminal: boolean; is_quran: boolean }[]
  const levelById = new Map(levels.map(l => [l.id, l]))
  const terminalSet = new Set(levels.filter(l => l.is_terminal).map(l => l.id))

  // Halaqoh & pengampu per unit (pengampu = wali halaqoh + pengampu di halaqoh_teachers)
  const halaqoh = (halaqohRes.data ?? []) as { id: string; jenjang: Jenjang; wali_teacher_id: string | null }[]
  const halaqohUnit = new Map(halaqoh.map(h => [h.id, h.jenjang]))
  const teachersByUnit = new Map<Jenjang, Set<string>>()
  const addTeacher = (j: Jenjang, tid: string | null) => {
    if (!tid) return
    if (!teachersByUnit.has(j)) teachersByUnit.set(j, new Set())
    teachersByUnit.get(j)!.add(tid)
  }
  for (const h of halaqoh) addTeacher(h.jenjang, h.wali_teacher_id)
  for (const r of (htRes.data ?? []) as { halaqoh_id: string; teacher_id: string }[]) {
    const j = halaqohUnit.get(r.halaqoh_id)
    if (j) addTeacher(j, r.teacher_id)
  }
  const halaqohCountByUnit = new Map<Jenjang, number>()
  for (const h of halaqoh) halaqohCountByUnit.set(h.jenjang, (halaqohCountByUnit.get(h.jenjang) ?? 0) + 1)

  // Juz terjauh (current) per siswa mengikuti urutan hafalan
  const juzByStudent = new Map<string, number[]>()
  for (const r of (juzProgressRes.data ?? []) as { student_id: string; juz_number: number; ayat_hafal: number; mutqin: boolean }[]) {
    if ((r.ayat_hafal ?? 0) <= 0 && !r.mutqin) continue
    if (!juzByStudent.has(r.student_id)) juzByStudent.set(r.student_id, [])
    juzByStudent.get(r.student_id)!.push(r.juz_number)
  }
  const currentJuzByStudent = new Map<string, number>()
  for (const [sid, list] of juzByStudent) {
    let best = list[0], bestPos = juzOrderPos(list[0])
    for (const j of list) { const p = juzOrderPos(j); if (p > bestPos) { bestPos = p; best = j } }
    currentJuzByStudent.set(sid, best)
  }

  // Program buckets (capaian + ujian) per (jenjang, program)
  const bkey = (jenjang: Jenjang, program: string | null) => `${jenjang}::${program ?? ''}`
  const buckets = new Map<string, ReturnType<typeof emptyBucket>>()
  const getB = (k: string) => { let b = buckets.get(k); if (!b) { b = emptyBucket(); buckets.set(k, b) } return b }
  const metaOf = (s: S) => ({ jenjang: s.jenjang, program: s.jenjang === 'paud' ? null : s.program })
  for (const s of students) {
    const m = metaOf(s); const b = getB(bkey(m.jenjang, m.program))
    b.studentCount++
    if (s.jilid && terminalSet.has(s.jilid)) b.lulus++; else b.belumLulus++
  }
  for (const r of (juzProgressRes.data ?? []) as { student_id: string; ayat_hafal: number; mutqin: boolean }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const m = metaOf(s); const b = getB(bkey(m.jenjang, m.program))
    b.totalAyatHafal += r.ayat_hafal ?? 0; if (r.mutqin) b.juzMutqin++
  }
  for (const r of (juzPromRes.data ?? []) as { student_id: string; juz_number: number; exam_score: number | string | null; promotion_date: string }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const m = metaOf(s); getB(bkey(m.jenjang, m.program)).juziyah.push({ studentName: s.full_name, juz: r.juz_number, score: numOrNull(r.exam_score), date: r.promotion_date })
  }
  for (const r of (tasmiRes.data ?? []) as { student_id: string; scope_juz: number; juz_from: number; juz_to: number; status: string; setoran_date: string }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const m = metaOf(s); getB(bkey(m.jenjang, m.program)).tasmi.push({ studentName: s.full_name, scopeJuz: r.scope_juz, juzFrom: r.juz_from, juzTo: r.juz_to, status: r.status, date: r.setoran_date })
  }
  const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date)
  const toProg = (jenjang: Jenjang, code: string | null, label: string): ProgramAnalytics => {
    const b = buckets.get(bkey(jenjang, code)) ?? emptyBucket()
    return {
      code, label, studentCount: b.studentCount,
      tahsin: { lulus: b.lulus, belumLulus: b.belumLulus },
      tahfidz: { totalAyatHafal: b.totalAyatHafal, juzMutqin: b.juzMutqin },
      juziyah: [...b.juziyah].sort(byDateDesc).slice(0, EXAM_LIMIT),
      tasmi: [...b.tasmi].sort(byDateDesc).slice(0, EXAM_LIMIT),
    }
  }

  return UNIT_ORDER.map(jenjang => {
    const unitStudents = students.filter(s => s.jenjang === jenjang)
    const defs = PROGRAMS_BY_JENJANG[jenjang]
    const hasPrograms = defs.length > 0

    let programs: ProgramAnalytics[]
    if (!hasPrograms) {
      programs = [toProg(jenjang, null, 'Tahsin & Tahfidz')]
    } else {
      programs = defs.map(p => toProg(jenjang, p.code, p.label))
      const untagged = buckets.get(bkey(jenjang, null))
      if (untagged && untagged.studentCount > 0) programs.push(toProg(jenjang, null, programLabel(jenjang, null)))
    }

    // Siswa per metode
    const methodMap = new Map<string, number>()
    for (const s of unitStudents) if (s.method) methodMap.set(s.method, (methodMap.get(s.method) ?? 0) + 1)
    const byMethod = methods.map(m => ({ method: m.name, count: methodMap.get(m.id) ?? 0 })).filter(x => x.count > 0)

    // Sebaran siswa per tahap (level distribution)
    const levelCount = new Map<string, number>()
    for (const s of unitStudents) if (s.jilid) levelCount.set(s.jilid, (levelCount.get(s.jilid) ?? 0) + 1)
    const usedMethodIds = new Set(unitStudents.map(s => s.method).filter(Boolean) as string[])
    const levelDistribution = methods.filter(m => usedMethodIds.has(m.id)).map(m => ({
      method: m.name,
      levels: levels.filter(l => l.method_id === m.id).sort((a, b) => a.order_num - b.order_num)
        .map(l => ({ label: l.label, order_num: l.order_num, count: levelCount.get(l.id) ?? 0, isTerminal: l.is_terminal, isQuran: l.is_quran })),
    }))

    // Sebaran tahapan jilid per kelas
    const kelasJilid = new Map<string, Map<string, number>>()
    for (const s of unitStudents) {
      if (!s.jilid) continue
      const lvl = levelById.get(s.jilid); if (!lvl) continue
      const kelas = s.kelas ?? '—'
      if (!kelasJilid.has(kelas)) kelasJilid.set(kelas, new Map())
      const inner = kelasJilid.get(kelas)!
      inner.set(lvl.label, (inner.get(lvl.label) ?? 0) + 1)
    }
    const jilidByKelas = [...kelasJilid.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([kelas, inner]) => ({
      kelas,
      total: [...inner.values()].reduce((a, b) => a + b, 0),
      levels: [...inner.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    }))

    // Sebaran hafalan per juz (berdasar juz terjauh siswa)
    const juzHistMap = new Map<number, number>()
    for (const s of unitStudents) {
      const cj = currentJuzByStudent.get(s.id)
      if (cj === undefined) continue
      juzHistMap.set(cj, (juzHistMap.get(cj) ?? 0) + 1)
    }
    const juzHistogram = [...juzHistMap.entries()].map(([juz, students]) => ({ juz, students })).sort((a, b) => a.juz - b.juz)

    // Sebaran JUMLAH JUZ dihafal per kelas
    const kelasJuz = new Map<string, number[]>()
    for (const s of unitStudents) {
      const kelas = s.kelas ?? '—'
      if (!kelasJuz.has(kelas)) kelasJuz.set(kelas, [])
      kelasJuz.get(kelas)!.push(juzHafalCount(currentJuzByStudent.get(s.id) ?? null))
    }
    const juzByKelas = [...kelasJuz.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([kelas, counts]) => {
      const distMap = new Map<number, number>()
      for (const c of counts) distMap.set(c, (distMap.get(c) ?? 0) + 1)
      const total = counts.length
      const avgJuz = total ? Math.round((counts.reduce((a, b) => a + b, 0) / total) * 10) / 10 : 0
      return {
        kelas, total, avgJuz,
        distribution: [...distMap.entries()].map(([juzCount, students]) => ({ juzCount, students })).sort((a, b) => a.juzCount - b.juzCount),
      }
    })

    // Log setoran mentah (untuk filter bulan/tahun di klien)
    const unitIds = new Set(unitStudents.map(s => s.id))
    const tahsinLogs = ((tahsinRes.data ?? []) as { student_id: string; setoran_date: string; status: string; nilai_tahsin: number | string | null; nilai_sikap: number | string | null }[])
      .filter(r => unitIds.has(r.student_id))
      .map(r => ({ date: r.setoran_date, status: r.status, n: numOrNull(r.nilai_tahsin), s: numOrNull(r.nilai_sikap) }))
    const tahfidzLogs = ((tahfidzRes.data ?? []) as { student_id: string; setoran_date: string; kind: string; nilai_tahfidz: number | string | null; nilai_sikap: number | string | null }[])
      .filter(r => unitIds.has(r.student_id))
      .map(r => ({ date: r.setoran_date, kind: r.kind, n: numOrNull(r.nilai_tahfidz), s: numOrNull(r.nilai_sikap) }))
    const tasmiLogs = ((tasmiRes.data ?? []) as { student_id: string; setoran_date: string; nilai_tahfidz: number | string | null; nilai_sikap: number | string | null }[])
      .filter(r => unitIds.has(r.student_id))
      .map(r => ({ date: r.setoran_date, n: numOrNull(r.nilai_tahfidz), s: numOrNull(r.nilai_sikap) }))

    return {
      jenjang, label: UNIT_LABELS[jenjang], hasPrograms,
      studentCount: unitStudents.length,
      programs,
      kpi: { activeStudents: unitStudents.length, teachers: teachersByUnit.get(jenjang)?.size ?? 0, halaqoh: halaqohCountByUnit.get(jenjang) ?? 0 },
      byMethod, levelDistribution, jilidByKelas, juzHistogram, juzByKelas,
      logs: { tahsin: tahsinLogs, tahfidz: tahfidzLogs, tasmi: tasmiLogs },
    }
  })
}

// ─── Papan hafalan per unit: 10 besar + posisi vs target (Analitik RQ) ─
export interface HafalanBoard {
  jenjang: Jenjang
  label: string
  studentCount: number
  top10: { id: string; name: string; kelas: string | null; juzCount: number; totalAyat: number }[]
  target: { label: string | null; below: number; on: number; above: number; total: number }
}

export async function getUnitHafalanBoards(): Promise<HafalanBoard[]> {
  const supabase = createServerClient()
  const [studentsRes, juzProgressRes] = await Promise.all([
    supabase.from('students').select('id, full_name, jenjang, kelas').eq('is_active', true),
    supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin'),
  ])
  const students = (studentsRes.data ?? []) as { id: string; full_name: string; jenjang: Jenjang; kelas: string | null }[]

  const totalAyat = new Map<string, number>()
  const juzList = new Map<string, number[]>()
  for (const r of (juzProgressRes.data ?? []) as { student_id: string; juz_number: number; ayat_hafal: number; mutqin: boolean }[]) {
    totalAyat.set(r.student_id, (totalAyat.get(r.student_id) ?? 0) + (r.ayat_hafal ?? 0))
    if ((r.ayat_hafal ?? 0) > 0 || r.mutqin) {
      if (!juzList.has(r.student_id)) juzList.set(r.student_id, [])
      juzList.get(r.student_id)!.push(r.juz_number)
    }
  }
  const currentJuz = new Map<string, number>()
  for (const [sid, list] of juzList) {
    let best = list[0], bestPos = juzOrderPos(list[0])
    for (const j of list) { const p = juzOrderPos(j); if (p > bestPos) { bestPos = p; best = j } }
    currentJuz.set(sid, best)
  }

  return UNIT_ORDER.map(jenjang => {
    const us = students.filter(s => s.jenjang === jenjang)
    const enriched = us.map(s => ({
      id: s.id, name: s.full_name, kelas: s.kelas,
      totalAyat: totalAyat.get(s.id) ?? 0,
      cj: currentJuz.get(s.id) ?? null,
      juzCount: juzHafalCount(currentJuz.get(s.id) ?? null),
    }))
    const top10 = [...enriched]
      .sort((a, b) => b.totalAyat - a.totalAyat || b.juzCount - a.juzCount)
      .slice(0, 10)
      .map(e => ({ id: e.id, name: e.name, kelas: e.kelas, juzCount: e.juzCount, totalAyat: e.totalAyat }))

    // Posisi vs target tahfidz (kerangka — target diisi menyusul di lib/rq/targets.ts)
    const target = TAHFIDZ_TARGETS[jenjang]
    let below = 0, on = 0, above = 0
    if (target) {
      const targetPos = juzOrderPos(target.juz)
      for (const e of enriched) {
        if (e.cj === null) { below++; continue } // belum mulai tahfidz → di bawah target
        const pos = juzOrderPos(e.cj)
        if (pos < targetPos) below++
        else if (pos === targetPos) on++
        else above++
      }
    }

    return {
      jenjang, label: UNIT_LABELS[jenjang], studentCount: us.length,
      top10,
      target: { label: target?.label ?? null, below, on, above, total: us.length },
    }
  })
}
