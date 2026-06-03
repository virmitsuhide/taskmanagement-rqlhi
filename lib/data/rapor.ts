import { createServerClient } from '@/lib/supabase/server'
import { AYAT_PER_JUZ } from '@/types'

const MONTH_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => typeof n === 'number')
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

export interface RaporData {
  student: {
    id: string
    full_name: string
    nis: string | null
    jenjang: string
    kelas: string | null
    halaqoh_name: string | null
    wali_name: string | null
    wali_phone: string | null
  }
  teacherName: string | null
  period: { year: number; month: number; monthLabel: string }
  attendance: { activeDays: number }
  tahsin: {
    setoranCount: number
    lulusCount: number
    avgMakhraj: number | null
    avgTajwid: number | null
    avgKelancaran: number | null
    currentMethod: string | null
    currentJilid: string | null
    currentPage: number | null
    promotions: { from: string | null; to: string; date: string }[]
    lastNote: string | null
  }
  tahfidz: {
    setoranCount: number
    ayatBaru: number
    murojaahCount: number
    avgKelancaran: number | null
    currentJuz: number | null
    currentJuzPercent: number | null
    totalAyatHafal: number
    juzMutqinCount: number
    promotions: { juz: number; date: string }[]
  }
}

/**
 * Agregasi rapor seorang siswa untuk satu bulan (year, month 1-12).
 */
export async function getStudentRaporData(
  studentId: string,
  year: number,
  month: number,
): Promise<RaporData | null> {
  const supabase = createServerClient()

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // hari terakhir bulan
  const startIso = monthStart.toISOString().slice(0, 10)
  const endIso = monthEnd.toISOString().slice(0, 10)

  // Siswa + relasi
  const { data: studentRaw } = await supabase
    .from('students')
    .select(`
      id, full_name, nis, jenjang, kelas, wali_name, wali_phone, current_jilid_page,
      halaqoh:halaqoh(name, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(full_name)),
      current_method:tahsin_methods!students_current_method_id_fkey(name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(label)
    `)
    .eq('id', studentId)
    .maybeSingle()

  if (!studentRaw) return null

  const s = studentRaw as unknown as {
    id: string; full_name: string; nis: string | null; jenjang: string; kelas: string | null
    wali_name: string | null; wali_phone: string | null; current_jilid_page: number | null
    halaqoh: { name: string; wali_teacher: { full_name: string } | null } | null
    current_method: { name: string } | null
    current_jilid: { label: string } | null
  }

  // Setoran tahsin & tahfidz bulan ini + promosi bulan ini + agregat juz (all time)
  const [tahsinRes, tahfidzRes, jilidPromRes, juzPromRes, juzProgRes] = await Promise.all([
    supabase
      .from('tahsin_logs')
      .select('setoran_date, nilai_makhraj, nilai_tajwid, nilai_kelancaran, status, catatan')
      .eq('student_id', studentId).gte('setoran_date', startIso).lte('setoran_date', endIso)
      .order('setoran_date', { ascending: false }),
    supabase
      .from('tahfidz_logs')
      .select('setoran_date, kind, ayat_dari, ayat_ke, nilai_kelancaran')
      .eq('student_id', studentId).gte('setoran_date', startIso).lte('setoran_date', endIso),
    supabase
      .from('jilid_promotions')
      .select('promotion_date, from_jilid:jilid_levels!jilid_promotions_from_jilid_id_fkey(label), to_jilid:jilid_levels!jilid_promotions_to_jilid_id_fkey(label)')
      .eq('student_id', studentId).gte('promotion_date', startIso).lte('promotion_date', endIso),
    supabase
      .from('juz_promotions')
      .select('juz_number, promotion_date')
      .eq('student_id', studentId).gte('promotion_date', startIso).lte('promotion_date', endIso),
    supabase
      .from('juz_progress')
      .select('juz_number, ayat_hafal, mutqin')
      .eq('student_id', studentId),
  ])

  const tahsinLogs = tahsinRes.data ?? []
  const tahfidzLogs = tahfidzRes.data ?? []
  const juzProgress = (juzProgRes.data ?? []) as Array<{ juz_number: number; ayat_hafal: number; mutqin: boolean }>

  // Kehadiran: hari unik dengan setoran (gabungan tahsin+tahfidz)
  const activeDates = new Set<string>()
  for (const l of tahsinLogs) activeDates.add(l.setoran_date)
  for (const l of tahfidzLogs) activeDates.add(l.setoran_date)

  // Tahfidz: ayat baru bulan ini
  let ayatBaru = 0
  let murojaahCount = 0
  for (const l of tahfidzLogs) {
    if (l.kind === 'ziyadah' || l.kind === 'hafalan_baru') ayatBaru += (l.ayat_ke - l.ayat_dari + 1)
    else murojaahCount += 1
  }

  // Juz aktif = juz tertinggi yang punya progress
  const currentJuz = juzProgress.length > 0 ? Math.max(...juzProgress.map(j => j.juz_number)) : null
  const currentJuzAyat = currentJuz ? (juzProgress.find(j => j.juz_number === currentJuz)?.ayat_hafal ?? 0) : 0
  const currentJuzPercent = currentJuz
    ? Math.min(100, Math.round((currentJuzAyat / (AYAT_PER_JUZ[currentJuz] ?? 1)) * 100))
    : null
  const totalAyatHafal = juzProgress.reduce((sum, j) => sum + j.ayat_hafal, 0)
  const juzMutqinCount = juzProgress.filter(j => j.mutqin).length

  return {
    student: {
      id: s.id,
      full_name: s.full_name,
      nis: s.nis,
      jenjang: s.jenjang,
      kelas: s.kelas,
      halaqoh_name: s.halaqoh?.name ?? null,
      wali_name: s.wali_name,
      wali_phone: s.wali_phone,
    },
    teacherName: s.halaqoh?.wali_teacher?.full_name ?? null,
    period: { year, month, monthLabel: `${MONTH_ID[month - 1]} ${year}` },
    attendance: { activeDays: activeDates.size },
    tahsin: {
      setoranCount: tahsinLogs.length,
      lulusCount: tahsinLogs.filter(l => l.status === 'lulus').length,
      avgMakhraj: avg(tahsinLogs.map(l => l.nilai_makhraj)),
      avgTajwid: avg(tahsinLogs.map(l => l.nilai_tajwid)),
      avgKelancaran: avg(tahsinLogs.map(l => l.nilai_kelancaran)),
      currentMethod: s.current_method?.name ?? null,
      currentJilid: s.current_jilid?.label ?? null,
      currentPage: s.current_jilid_page,
      promotions: (jilidPromRes.data ?? []).map(p => ({
        from: (p.from_jilid as unknown as { label: string } | null)?.label ?? null,
        to: (p.to_jilid as unknown as { label: string } | null)?.label ?? '?',
        date: p.promotion_date,
      })),
      lastNote: tahsinLogs.find(l => l.catatan)?.catatan ?? null,
    },
    tahfidz: {
      setoranCount: tahfidzLogs.length,
      ayatBaru,
      murojaahCount,
      avgKelancaran: avg(tahfidzLogs.map(l => l.nilai_kelancaran)),
      currentJuz,
      currentJuzPercent,
      totalAyatHafal,
      juzMutqinCount,
      promotions: (juzPromRes.data ?? []).map(p => ({ juz: p.juz_number, date: p.promotion_date })),
    },
  }
}
