import { createServerClient } from '@/lib/supabase/server'
import { UNIT_ORDER, UNIT_LABELS, PROGRAMS_BY_JENJANG, programLabel } from '@/lib/rq/programs'
import { juzSelesaiSetoran, juzTerjauh, totalJuzHafalan } from '@/lib/rq/hafalan'
import { getJuzUjianPerSiswa, juzGabunganPerSiswa } from '@/lib/data/hafalan'
import { TAHFIDZ_TARGETS } from '@/lib/rq/targets'
import { getPredikatLabel, tanggalWIB } from '@/lib/rq/ujian'
import type { Jenjang, UjianPredikat } from '@/types'

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
  juzTerujiTotal: number
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
    juzUjianPerSiswa,
  ] = await Promise.all([
    supabase.from('students').select('jenjang').eq('is_active', true),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    supabase.from('halaqoh').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('tahsin_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('tahfidz_logs').select('*', { count: 'exact', head: true }).gte('setoran_date', monthStartIso).lte('setoran_date', monthEndIso),
    supabase.from('jilid_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    supabase.from('juz_promotions').select('*', { count: 'exact', head: true }).gte('promotion_date', monthStartIso).lte('promotion_date', monthEndIso),
    getJuzUjianPerSiswa(),
  ])

  const studentsByJenjangMap = new Map<Jenjang, number>()
  for (const s of studentsRes.data ?? []) {
    studentsByJenjangMap.set(s.jenjang as Jenjang, (studentsByJenjangMap.get(s.jenjang as Jenjang) ?? 0) + 1)
  }
  // Semua unit selalu ditulis, termasuk yang belum punya siswa — angka 0 itu
  // sendiri informasi (unit belum terdata), bukan alasan menyembunyikan baris.
  const studentsByJenjang = JENJANG_ORDER
    .map(j => ({ jenjang: j, count: studentsByJenjangMap.get(j) ?? 0 }))

  // Juz teruji = juz yang diakui tuntas lewat ujian selesai. Menggantikan
  // hitungan centang "mutqin" di setoran harian, yang sudah dicabut.
  const juzTerujiTotal = [...juzUjianPerSiswa.values()].reduce((n, j) => n + j, 0)

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
    juzTerujiTotal,
  }
}

// ─── Analitik khusus Tahsin & Tahfidz (manajemen) ───────────────────
/** Rata-rata rubrik baru: nilai pokok (tahsin/tahfidz) dan nilai sikap. */
type Avg2 = { nilai: number | null; sikap: number | null }

export interface TahsinTahfidzAnalytics {
  monthLabel: string
  totals: { activeStudents: number; lulusTahsin: number; totalAyatHafal: number; juzTeruji: number }
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
  const juzTeruji = juzProgress.filter(j => j.mutqin).length
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
    totals: { activeStudents: students.length, lulusTahsin, totalAyatHafal, juzTeruji },
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
  tahfidz: { totalAyatHafal: number; juzTeruji: number }
  /** `predikat` terisi bila barisnya datang dari modul ujian (tanpa nilai angka). */
  juziyah: { studentName: string; juz: number; score: number | null; predikat?: string | null; date: string }[]
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
  juzTeruji: number
  juziyah: ProgramAnalytics['juziyah']
  tasmi: ProgramAnalytics['tasmi']
}

function emptyBucket(): Bucket {
  return { studentCount: 0, lulus: 0, belumLulus: 0, totalAyatHafal: 0, juzTeruji: 0, juziyah: [], tasmi: [] }
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
    if (row.mutqin) b.juzTeruji++
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
      tahfidz: { totalAyatHafal: b.totalAyatHafal, juzTeruji: b.juzTeruji },
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

/*
 * ─── Analitik pembelajaran lengkap per Unit (tabs + tahsin & tahfidz) ─
 *
 * Urutan hafalan RQ LHI (30→26 lalu 1→25) tidak lagi ditulis ulang di sini.
 * Berkas ini dulu menyimpan salinannya sendiri sebagai juzOrderPos() dan
 * juzHafalCount() — rumus yang sama persis dengan lib/rq/hafalan.ts, di dua
 * berkas yang tidak saling menyebut, sehingga salinan ini tidak akan pernah
 * tahu kalau aslinya berubah. Sekarang keduanya diambil dari sana:
 * juzTerjauh() untuk "juz mana yang paling jauh", juzSelesaiSetoran() untuk
 * "berapa juz yang sudah tuntas".
 */
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

  const [studentsRes, methodsRes, levelsRes, juzProgressRes, juzPromRes, tasmiRes, tahsinRes, tahfidzRes, halaqohRes, htRes, ujianTahfidzRes] = await Promise.all([
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
    supabase
      .from('ujian_tahfidz')
      .select('student_id, tipe, juz, predikat, jadwal, updated_at')
      .not('student_id', 'is', null)
      .eq('status', 'selesai'),
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
    const terjauh = juzTerjauh(list)
    if (terjauh !== null) currentJuzByStudent.set(sid, terjauh)
  }

  // Jumlah juz tuntas per siswa: setoran digabung dengan ujian yang sudah
  // selesai. Histogram "juz berjalan" di bawah tetap murni dari setoran —
  // ia menjawab "sedang di juz berapa", pertanyaan yang tidak dijawab ujian.
  const juzUjianUnit = await getJuzUjianPerSiswa()
  const juzGabungan = juzGabunganPerSiswa(
    (juzProgressRes.data ?? []) as {
      student_id: string; juz_number: number; ayat_hafal: number; mutqin: boolean
    }[],
    juzUjianUnit,
  )

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
    b.totalAyatHafal += r.ayat_hafal ?? 0
  }
  // Juz teruji per program: jumlah juz tuntas lewat ujian selesai.
  for (const [sid, n] of juzUjianUnit) {
    const s = stById.get(sid); if (!s) continue
    const m = metaOf(s); getB(bkey(m.jenjang, m.program)).juzTeruji += n
  }
  for (const r of (juzPromRes.data ?? []) as { student_id: string; juz_number: number; exam_score: number | string | null; promotion_date: string }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const m = metaOf(s); getB(bkey(m.jenjang, m.program)).juziyah.push({ studentName: s.full_name, juz: r.juz_number, score: numOrNull(r.exam_score), date: r.promotion_date })
  }
  for (const r of (tasmiRes.data ?? []) as { student_id: string; scope_juz: number; juz_from: number; juz_to: number; status: string; setoran_date: string }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const m = metaOf(s); getB(bkey(m.jenjang, m.program)).tasmi.push({ studentName: s.full_name, scopeJuz: r.scope_juz, juzFrom: r.juz_from, juzTo: r.juz_to, status: r.status, date: r.setoran_date })
  }
  /*
    Hasil modul ujian (ujian_tahfidz) ikut masuk ke dua daftar di atas.

    juz_promotions & tasmi_logs hanya terisi dari alur setoran, dan alur itu
    nyaris tidak dipakai — ujian yang sesungguhnya diajukan dan dinilai lewat
    modul ujian. Tanpa ini, seluruh 30-an ujian SMP yang sudah selesai tidak
    muncul di sini dan daftarnya terbaca "Belum ada". Tipe 1 juz = juz'iyyah;
    3 & 5 juz = tasmi'. Predikat 'mengulang' dicatat sebagai ulang, sisanya lulus.
  */
  for (const r of (ujianTahfidzRes.data ?? []) as {
    student_id: string; tipe: string; juz: string; predikat: string | null
    jadwal: string | null; updated_at: string
  }[]) {
    const s = stById.get(r.student_id); if (!s) continue
    const b = getB(bkey(metaOf(s).jenjang, metaOf(s).program))
    const date = r.jadwal ?? r.updated_at
    const angka = String(r.juz).match(/\d+/g)?.map(Number) ?? []
    if (angka.length === 0) continue
    if (r.tipe === '1_juz') {
      b.juziyah.push({ studentName: s.full_name, juz: angka[0], score: null, predikat: getPredikatLabel(r.predikat as UjianPredikat | null), date })
    } else {
      const scopeJuz = r.tipe === '3_juz' ? 3 : 5
      const juzFrom = Math.min(...angka), juzTo = Math.max(...angka)
      b.tasmi.push({ studentName: s.full_name, scopeJuz, juzFrom, juzTo, status: r.predikat === 'mengulang' ? 'ulang' : 'lulus', date })
    }
  }
  const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date)
  const toProg = (jenjang: Jenjang, code: string | null, label: string): ProgramAnalytics => {
    const b = buckets.get(bkey(jenjang, code)) ?? emptyBucket()
    return {
      code, label, studentCount: b.studentCount,
      tahsin: { lulus: b.lulus, belumLulus: b.belumLulus },
      tahfidz: { totalAyatHafal: b.totalAyatHafal, juzTeruji: b.juzTeruji },
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

    // Sebaran JUMLAH JUZ dihafal per kelas — setoran digabung dengan ujian,
    // lihat lib/data/hafalan.ts.
    const kelasJuz = new Map<string, number[]>()
    for (const s of unitStudents) {
      const kelas = s.kelas ?? '—'
      if (!kelasJuz.has(kelas)) kelasJuz.set(kelas, [])
      kelasJuz.get(kelas)!.push(juzGabungan.get(s.id) ?? 0)
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
  const [studentsRes, juzProgressRes, juzUjian] = await Promise.all([
    supabase.from('students').select('id, full_name, jenjang, kelas').eq('is_active', true),
    supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin'),
    getJuzUjianPerSiswa(),
  ])
  const students = (studentsRes.data ?? []) as { id: string; full_name: string; jenjang: Jenjang; kelas: string | null }[]
  const jpRows = (juzProgressRes.data ?? []) as { student_id: string; juz_number: number; ayat_hafal: number; mutqin: boolean }[]

  const totalAyat = new Map<string, number>()
  const juzList = new Map<string, number[]>()
  for (const r of jpRows) {
    totalAyat.set(r.student_id, (totalAyat.get(r.student_id) ?? 0) + (r.ayat_hafal ?? 0))
    if ((r.ayat_hafal ?? 0) > 0 || r.mutqin) {
      if (!juzList.has(r.student_id)) juzList.set(r.student_id, [])
      juzList.get(r.student_id)!.push(r.juz_number)
    }
  }
  const currentJuz = new Map<string, number>()
  for (const [sid, list] of juzList) {
    const terjauh = juzTerjauh(list)
    if (terjauh !== null) currentJuz.set(sid, terjauh)
  }

  // Jumlah juz diambil dari sumber yang paling jauh — setoran atau ujian.
  // Lihat lib/data/hafalan.ts: anak yang masih di program tahsin tidak pernah
  // punya setoran ziyadah, jadi tanpa ini capaian ujiannya terbaca nol.
  const juzGabungan = juzGabunganPerSiswa(jpRows, juzUjian)

  return UNIT_ORDER.map(jenjang => {
    const us = students.filter(s => s.jenjang === jenjang)
    const enriched = us.map(s => ({
      id: s.id, name: s.full_name, kelas: s.kelas,
      totalAyat: totalAyat.get(s.id) ?? 0,
      cj: currentJuz.get(s.id) ?? null,
      juzUjian: juzUjian.get(s.id) ?? 0,
      juzCount: juzGabungan.get(s.id) ?? 0,
    }))
    /*
      Diurutkan menurut JUZ lebih dulu, baru ayat.

      Sebelumnya ayat yang menentukan, dan itu diam-diam meniadakan seluruh
      penggabungan di atas: capaian ujian tidak membawa hitungan ayat, jadi
      anak yang lulus ujian 10 juz tetap ber-totalAyat 0 dan tidak pernah
      sampai ke sepuluh besar — betapapun benar angka juz-nya. Papan ini
      bernama papan hafalan, dan juz memang ukuran utamanya; ayat tetap
      dipakai sebagai pemisah saat juz-nya sama.
    */
    const top10 = [...enriched]
      .sort((a, b) => b.juzCount - a.juzCount || b.totalAyat - a.totalAyat)
      .slice(0, 10)
      .map(e => ({ id: e.id, name: e.name, kelas: e.kelas, juzCount: e.juzCount, totalAyat: e.totalAyat }))

    // Posisi vs target tahfidz (kerangka — target diisi menyusul di lib/rq/targets.ts)
    const target = TAHFIDZ_TARGETS[jenjang]
    let below = 0, on = 0, above = 0
    if (target) {
      // Target dinyatakan sebagai nomor juz; yang dibandingkan jumlah juz
      // tuntas, supaya capaian ujian ikut terhitung. Anak yang LULUS ujian
      // juz 26 tuntas 5 juz, sementara yang baru MENYETOR juz 26 tuntas 4 —
      // dan target "juz 26" berarti yang kedua.
      const targetJuz = juzSelesaiSetoran(target.juz)
      for (const e of enriched) {
        if (e.juzCount === 0 && e.cj === null) { below++; continue } // belum mulai tahfidz
        if (e.juzCount < targetJuz) below++
        else if (e.juzCount === targetJuz) on++
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

// ─── Tren setoran bulanan ───────────────────────────────────────────

export interface SetoranTrendPoint {
  /** 'YYYY-MM' — kunci stabil, bukan untuk ditampilkan. */
  key: string
  /** 'Agu' — label sumbu X, sengaja pendek supaya muat di layar HP. */
  short: string
  /** 'Agustus 2026' — untuk tooltip & pembacaan layar. */
  full: string
  tahsin: number
  tahfidz: number
  /**
   * Dari mana angka bulan ini dibaca (0056). 'harian' = setoran hari per hari
   * yang masih ditulis; 'bulanan' = rangkuman bulan yang sudah ditutup.
   * Keduanya menghitung hal yang sama — berapa ANAK punya catatan bulan itu.
   */
  sumber: 'harian' | 'bulanan'
  /** Bulan berjalan: angkanya belum lengkap, jangan dibandingkan setara. */
  isRunning: boolean
  /** Sebelum setoran pertama tercatat — beda dari "nol beneran". */
  isBeforeData: boolean
}

export interface SetoranTrend {
  points: SetoranTrendPoint[]
  /** Nilai tertinggi lintas kedua seri; jadi batas atas sumbu Y. */
  max: number
  /** Perbandingan bulan lengkap terakhir vs bulan sebelumnya. */
  delta: { tahsin: number | null; tahfidz: number | null; fromLabel: string; toLabel: string } | null
  /** Tidak ada satupun setoran di seluruh rentang. */
  isEmpty: boolean
}

/**
 * Santri yang tercatat capaiannya per bulan, untuk `months` bulan terakhir.
 *
 * ── KENAPA YANG DIHITUNG SANTRI, BUKAN SETORAN ──────────────────────────────
 *
 * Sejak RQ memakai model semi (0056), satu bulan punya DUA kemungkinan sumber:
 *
 *   bulan berjalan   tahsin_logs / tahfidz_logs  — setoran harian, masih ditulis
 *   bulan tertutup   student_monthly             — rangkuman, satu baris per anak
 *
 * Keduanya tidak menghitung hal yang sama. Setoran harian menghitung PERISTIWA
 * (satu anak bisa menyumbang delapan baris sebulan); rangkuman bulanan
 * menghitung ANAK. Menggambar keduanya pada satu sumbu akan menghasilkan garis
 * yang melonjak atau terjun bebas persis di bulan peralihan — bukan karena ada
 * yang berubah di lapangan, melainkan karena satuannya berganti di tengah jalan.
 *
 * Yang bisa dijawab kedua sumber dengan cara yang sama persis adalah: BERAPA
 * ANAK yang punya catatan bulan itu. Itulah yang dihitung di sini, dan itu pula
 * angka yang paling dicari manajemen — cakupan pencatatan, bukan kesibukan.
 *
 * ── KENAPA TIDAK MENJUMLAHKAN KEDUANYA ──────────────────────────────────────
 *
 * Bulan berjalan sengaja HANYA membaca setoran harian, meski rangkuman bulannya
 * mungkin sudah sebagian terisi. Merangkum adalah tindakan akhir bulan; kalau
 * kedua sumber dijumlahkan, anak yang sudah dirangkum akan terhitung dua kali
 * selama bulan itu masih berjalan.
 */
export async function getSetoranTrend(months = 12): Promise<SetoranTrend> {
  const supabase = createServerClient()
  const now = new Date()

  const ranges = Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0)
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      short: MONTH_ID[start.getMonth()].slice(0, 3),
      full: `${MONTH_ID[start.getMonth()]} ${start.getFullYear()}`,
      startIso: isoDate(start),
      endIso: isoDate(end),
      isRunning: offset === 0,
    }
  })

  /*
    Bulan berjalan: anak berbeda yang punya setoran harian.

    Diambil barisnya lalu dihitung unik di memori, bukan lewat count query —
    PostgREST tidak punya COUNT(DISTINCT), dan satu bulan setoran harian
    berjumlah puluhan sampai ratusan baris, bukan ribuan.
  */
  const berjalan = ranges.find(r => r.isRunning)
  const hariIni = berjalan
    ? await Promise.all([
        supabase.from('tahsin_logs').select('student_id')
          .gte('setoran_date', berjalan.startIso).lte('setoran_date', berjalan.endIso),
        supabase.from('tahfidz_logs').select('student_id')
          .gte('setoran_date', berjalan.startIso).lte('setoran_date', berjalan.endIso),
      ])
    : null

  const unik = (rows: { student_id: string }[] | null | undefined) =>
    new Set((rows ?? []).map(r => r.student_id)).size

  // Bulan tertutup: satu baris student_monthly = satu anak, jadi cukup dihitung
  // per periode. Kolom akhir yang menentukan — baris yang hanya berisi titik
  // berangkat (hasil salin awal bulan) belum berarti anaknya sudah dinilai.
  const lampau = ranges.filter(r => !r.isRunning)
  const bulanan = await Promise.all(
    lampau.map(r =>
      supabase.from('student_monthly')
        .select('student_id, halaman_akhir_tahsin, tahfidz_akhir')
        .eq('period', `${r.key}-01`)
        .then(res => res.data ?? []),
    ),
  )

  const perKey = new Map<string, { tahsin: number; tahfidz: number; sumber: 'bulanan' | 'harian' }>()
  lampau.forEach((r, i) => {
    const rows = bulanan[i] as { halaman_akhir_tahsin: string; tahfidz_akhir: string }[]
    perKey.set(r.key, {
      tahsin: rows.filter(x => (x.halaman_akhir_tahsin ?? '').trim()).length,
      tahfidz: rows.filter(x => (x.tahfidz_akhir ?? '').trim()).length,
      sumber: 'bulanan',
    })
  })
  if (berjalan && hariIni) {
    perKey.set(berjalan.key, {
      tahsin: unik(hariIni[0].data as { student_id: string }[]),
      tahfidz: unik(hariIni[1].data as { student_id: string }[]),
      sumber: 'harian',
    })
  }

  const raw = ranges.map(r => ({
    ...r,
    ...(perKey.get(r.key) ?? { tahsin: 0, tahfidz: 0, sumber: 'bulanan' as const }),
  }))

  // Bulan-bulan nol di awal rentang dianggap "belum ada data", bukan nol
  // beneran — RQ bisa saja baru mulai mencatat di tengah rentang, dan menggambar
  // garis nol di situ akan terbaca sebagai penurunan kinerja.
  const firstWithData = raw.findIndex(p => p.tahsin > 0 || p.tahfidz > 0)

  const points: SetoranTrendPoint[] = raw.map((p, i) => ({
    key: p.key,
    short: p.short,
    full: p.full,
    tahsin: p.tahsin,
    tahfidz: p.tahfidz,
    sumber: p.sumber,
    isRunning: p.isRunning,
    isBeforeData: firstWithData === -1 || i < firstWithData,
  }))

  const max = Math.max(1, ...points.map(p => Math.max(p.tahsin, p.tahfidz)))

  // Bulan berjalan dikecualikan dari delta: membandingkan bulan yang baru jalan
  // seminggu dengan bulan penuh selalu terlihat seperti anjlok — dan sejak
  // sumbernya berbeda pula, perbandingannya jadi dua kali tidak setara.
  const complete = points.filter(p => !p.isRunning && !p.isBeforeData)
  const prev = complete.at(-2)
  const last = complete.at(-1)
  const pct = (from: number, to: number) => (from === 0 ? null : Math.round(((to - from) / from) * 100))

  return {
    points,
    max,
    delta: prev && last
      ? {
          tahsin: pct(prev.tahsin, last.tahsin),
          tahfidz: pct(prev.tahfidz, last.tahfidz),
          fromLabel: prev.full,
          toLabel: last.full,
        }
      : null,
    isEmpty: firstWithData === -1,
  }
}

// ─── Hafalan menurut UJIAN, bukan menurut setoran ──────────────────────

/**
 * Capaian hafalan yang sudah LULUS UJIAN, per unit.
 *
 * Sengaja berdiri sendiri di samping getUnitHafalanBoards(), yang menghitung
 * dari juz_progress — yaitu apa yang disetor sehari-hari. Keduanya menjawab
 * pertanyaan berbeda: setoran menunjukkan proses yang sedang berjalan, ujian
 * menunjukkan yang sudah diakui tuntas. Angkanya wajar berbeda, dan
 * menggabungkannya jadi satu metrik akan menyembunyikan justru selisih itu —
 * anak yang setorannya jauh tapi belum pernah diujikan.
 *
 * Hitungannya memakai posisi dalam urutan hafalan (30, 29, 28, 27, 26, lalu
 * 1..25), bukan nomor juz. Lihat lib/rq/hafalan.ts.
 */
export interface HafalanUjianUnit {
  jenjang: Jenjang
  label: string
  /** Siswa yang punya minimal satu catatan ujian terpetakan. */
  siswaTeruji: number
  totalJuz: number
  rataJuz: number
  /** Berapa siswa pada tiap jumlah juz — untuk batang sebaran. */
  sebaran: { juz: number; siswa: number }[]
  top10: { id: string; name: string; kelas: string | null; juz: number }[]
}

export async function getHafalanUjianPerUnit(): Promise<HafalanUjianUnit[]> {
  const supabase = createServerClient()
  const [siswaRes, ujianRes] = await Promise.all([
    supabase.from('students').select('id, full_name, jenjang, kelas').eq('is_active', true),
    // Hanya yang sudah selesai: pengajuan yang belum diuji bukan capaian.
    supabase
      .from('ujian_tahfidz')
      .select('student_id, juz')
      .not('student_id', 'is', null)
      .eq('status', 'selesai'),
  ])

  const siswa = (siswaRes.data ?? []) as {
    id: string; full_name: string; jenjang: Jenjang; kelas: string | null
  }[]

  const perSiswa = new Map<string, string[]>()
  for (const r of (ujianRes.data ?? []) as { student_id: string; juz: string }[]) {
    const daftar = perSiswa.get(r.student_id) ?? []
    daftar.push(String(r.juz))
    perSiswa.set(r.student_id, daftar)
  }

  return UNIT_ORDER.map(jenjang => {
    const anak = siswa
      .filter(s => s.jenjang === jenjang && perSiswa.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.full_name,
        kelas: s.kelas,
        juz: totalJuzHafalan(perSiswa.get(s.id) ?? []),
      }))
      .filter(a => a.juz > 0)

    const totalJuz = anak.reduce((n, a) => n + a.juz, 0)

    const hitung = new Map<number, number>()
    for (const a of anak) hitung.set(a.juz, (hitung.get(a.juz) ?? 0) + 1)

    return {
      jenjang,
      label: UNIT_LABELS[jenjang],
      siswaTeruji: anak.length,
      totalJuz,
      rataJuz: anak.length > 0 ? Math.round((totalJuz / anak.length) * 10) / 10 : 0,
      sebaran: [...hitung.entries()]
        .map(([juz, jumlah]) => ({ juz, siswa: jumlah }))
        .sort((a, b) => a.juz - b.juz),
      top10: [...anak].sort((a, b) => b.juz - a.juz || a.name.localeCompare(b.name)).slice(0, 10),
    }
  }).filter(u => u.siswaTeruji > 0)
}

// ─── Siswa DRILL tahsin (0064) ──────────────────────────────────────

export interface SiswaDrill {
  id: string
  name: string
  kelas: string | null
  jilid: string | null
  halaqoh: string | null
  sejak: string
  /** Hari sejak masuk drill — makin lama, makin perlu ditanyakan. */
  hari: number
  /** Ujian tahsin yang menunggu untuk anak ini: belum diajukan / diajukan / dijadwalkan. */
  ujian: 'belum' | 'diajukan' | 'dijadwalkan'
}

export interface DrillUnit {
  jenjang: Jenjang
  label: string
  siswa: SiswaDrill[]
  /** Sudah drill tapi belum ada pengajuan ujian sama sekali — yang paling perlu ditindaklanjuti. */
  belumDiajukan: number
}

/**
 * Anak yang sedang DRILL — sudah lulus halaman terakhir jilid dan tertahan
 * sampai lulus ujian tahsin.
 *
 * Status pengajuannya ikut dibaca, sebab pertanyaan manajemen bukan sekadar
 * "berapa yang drill", melainkan "siapa yang tertahan karena ujiannya belum
 * diajukan". Drill yang lama tanpa pengajuan berarti anak menunggu sesuatu
 * yang tidak sedang diurus siapa pun.
 */
export async function getSiswaDrill(): Promise<DrillUnit[]> {
  const supabase = createServerClient()
  const [siswaRes, ujianRes] = await Promise.all([
    supabase
      .from('students')
      .select(
        'id, full_name, jenjang, kelas, tahsin_drill_sejak,' +
        ' jilid:jilid_levels!students_current_jilid_id_fkey(label),' +
        ' halaqoh:halaqoh!students_halaqoh_id_fkey(name)',
      )
      .eq('is_active', true)
      .not('tahsin_drill_sejak', 'is', null),
    supabase.from('ujian_tahsin').select('status, siswa').in('status', ['diajukan', 'dijadwalkan']),
  ])
  // Migrasi 0064 belum jalan → kolomnya tidak ada; papan cukup tidak tampil.
  if (siswaRes.error) return []

  const statusUjian = new Map<string, 'diajukan' | 'dijadwalkan'>()
  for (const u of (ujianRes.data ?? []) as { status: 'diajukan' | 'dijadwalkan'; siswa: { student_id?: string | null }[] }[]) {
    for (const s of u.siswa ?? []) {
      if (!s.student_id) continue
      // Dijadwalkan lebih maju daripada diajukan — itu yang ditampilkan.
      if (statusUjian.get(s.student_id) !== 'dijadwalkan') statusUjian.set(s.student_id, u.status)
    }
  }

  const hariIni = new Date(new Date().toISOString().slice(0, 10)).getTime()
  const rows = (siswaRes.data ?? []) as unknown as Array<{
    id: string; full_name: string; jenjang: Jenjang; kelas: string | null; tahsin_drill_sejak: string
    jilid: { label: string } | null; halaqoh: { name: string } | null
  }>

  return UNIT_ORDER.map(jenjang => {
    const siswa = rows
      .filter(r => r.jenjang === jenjang)
      .map((r): SiswaDrill => ({
        id: r.id,
        name: r.full_name,
        kelas: r.kelas,
        jilid: r.jilid?.label ?? null,
        halaqoh: r.halaqoh?.name ?? null,
        sejak: r.tahsin_drill_sejak,
        hari: Math.max(0, Math.round((hariIni - new Date(r.tahsin_drill_sejak).getTime()) / 86_400_000)),
        ujian: statusUjian.get(r.id) ?? 'belum',
      }))
      .sort((a, b) => b.hari - a.hari)
    return {
      jenjang,
      label: UNIT_LABELS[jenjang],
      siswa,
      belumDiajukan: siswa.filter(s => s.ujian === 'belum').length,
    }
  }).filter(u => u.siswa.length > 0)
}

// ─── Drill tahfidz: lama menyiapkan ujian 1 juz (0065) ──────────────

export interface StatLama {
  /** Jumlah juz yang sudah diajukan ujiannya — sampel rata-rata. */
  n: number
  rata: number | null
  median: number | null
  tercepat: number | null
  terlama: number | null
}

export interface DrillTahfidzAnalitik {
  /** Juz yang ziyadahnya tuntas tapi belum diajukan ujian, terlama dahulu. */
  sedang: {
    id: string; name: string; kelas: string | null; halaqoh: string | null
    jenjang: Jenjang; juz: number; sejak: string; hari: number
  }[]
  keseluruhan: StatLama
  /** Per juz, berurutan menurut urutan hafalan RQ (30, 29, … lalu 1 …). */
  perJuz: ({ juz: number } & StatLama)[]
  perUnit: ({ jenjang: Jenjang; label: string } & StatLama)[]
}

function statLama(hari: number[]): StatLama {
  if (hari.length === 0) return { n: 0, rata: null, median: null, tercepat: null, terlama: null }
  const urut = [...hari].sort((a, b) => a - b)
  const tengah = Math.floor(urut.length / 2)
  return {
    n: urut.length,
    rata: Math.round((urut.reduce((a, b) => a + b, 0) / urut.length) * 10) / 10,
    median: urut.length % 2 ? urut[tengah] : (urut[tengah - 1] + urut[tengah]) / 2,
    tercepat: urut[0],
    terlama: urut[urut.length - 1],
  }
}

/** Selisih hari kalender antara dua tanggal YYYY-MM-DD; tidak pernah negatif. */
function selisihHari(dari: string, ke: string): number {
  return Math.max(0, Math.round((new Date(ke).getTime() - new Date(dari).getTime()) / 86_400_000))
}

/**
 * Lama anak menyiapkan ujian 1 juz: dari ziyadah juz itu tuntas sampai
 * ujiannya diajukan.
 *
 * Pengajuan yang lebih dulu dari tuntasnya ziyadah — guru mengajukan sebelum
 * setoran terakhir tercatat — dihitung nol hari, bukan negatif. Median ikut
 * ditampilkan di samping rata-rata: satu anak yang tertahan setahun cukup
 * untuk menyeret rata-rata sebuah juz jauh dari kebiasaan sebenarnya.
 *
 * @param jenjangBoleh batasi ke unit tertentu (koordinator); kosong = semua.
 */
export async function getDrillTahfidz(jenjangBoleh?: Jenjang[]): Promise<DrillTahfidzAnalitik> {
  const kosong: DrillTahfidzAnalitik = { sedang: [], keseluruhan: statLama([]), perJuz: [], perUnit: [] }
  const supabase = createServerClient()

  const { data: drillRows, error } = await supabase
    .from('tahfidz_juz_drill')
    .select(
      'student_id, juz_number, selesai_ziyadah, ujian_id,' +
      ' siswa:students!tahfidz_juz_drill_student_id_fkey(full_name, jenjang, kelas, is_active,' +
      ' halaqoh:halaqoh!students_halaqoh_id_fkey(name))',
    )
  // Migrasi 0065 belum jalan → tabelnya tidak ada; papan cukup kosong.
  if (error || !drillRows) return kosong

  const rows = (drillRows as unknown as Array<{
    student_id: string; juz_number: number; selesai_ziyadah: string; ujian_id: string | null
    siswa: { full_name: string; jenjang: Jenjang; kelas: string | null; is_active: boolean; halaqoh: { name: string } | null } | null
  }>).filter(r => r.siswa && (!jenjangBoleh || jenjangBoleh.includes(r.siswa.jenjang)))

  const ujianIds = rows.map(r => r.ujian_id).filter((id): id is string => Boolean(id))
  const diajukan = new Map<string, string>()
  if (ujianIds.length > 0) {
    const { data: ujian } = await supabase.from('ujian_tahfidz').select('id, created_at').in('id', ujianIds)
    for (const u of (ujian ?? []) as { id: string; created_at: string }[]) diajukan.set(u.id, tanggalWIB(u.created_at))
  }

  const hariIni = tanggalWIB(new Date())
  const sedang: DrillTahfidzAnalitik['sedang'] = []
  const selesai: { juz: number; jenjang: Jenjang; hari: number }[] = []

  for (const r of rows) {
    const s = r.siswa!
    const tglAju = r.ujian_id ? diajukan.get(r.ujian_id) : undefined
    if (tglAju) {
      selesai.push({ juz: r.juz_number, jenjang: s.jenjang, hari: selisihHari(r.selesai_ziyadah, tglAju) })
    } else if (s.is_active) {
      sedang.push({
        id: `${r.student_id}:${r.juz_number}`, name: s.full_name, kelas: s.kelas, halaqoh: s.halaqoh?.name ?? null,
        jenjang: s.jenjang, juz: r.juz_number, sejak: r.selesai_ziyadah, hari: selisihHari(r.selesai_ziyadah, hariIni),
      })
    }
  }

  const juzAda = [...new Set(selesai.map(x => x.juz))].sort((a, b) => urutanJuz(a) - urutanJuz(b))
  return {
    sedang: sedang.sort((a, b) => b.hari - a.hari),
    keseluruhan: statLama(selesai.map(x => x.hari)),
    perJuz: juzAda.map(juz => ({ juz, ...statLama(selesai.filter(x => x.juz === juz).map(x => x.hari)) })),
    perUnit: UNIT_ORDER
      .map(jenjang => ({ jenjang, label: UNIT_LABELS[jenjang], ...statLama(selesai.filter(x => x.jenjang === jenjang).map(x => x.hari)) }))
      .filter(u => u.n > 0),
  }
}

/** Posisi juz dalam urutan hafalan RQ: 30, 29, 28, 27, 26, lalu 1…25. */
function urutanJuz(juz: number): number {
  return juz >= 26 ? 30 - juz : juz + 4
}
