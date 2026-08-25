import { createServerClient } from '@/lib/supabase/server'

/**
 * Ambil semua halaqoh_id yang diampu seorang guru.
 * Sumber: wali_teacher_id di tabel halaqoh + relasi halaqoh_teachers.
 */
export async function getTeacherHalaqohIds(teacherId: string): Promise<string[]> {
  const supabase = createServerClient()
  const [waliRes, memberRes] = await Promise.all([
    supabase.from('halaqoh').select('id').eq('wali_teacher_id', teacherId),
    supabase.from('halaqoh_teachers').select('halaqoh_id').eq('teacher_id', teacherId),
  ])

  const ids = new Set<string>()
  for (const row of waliRes.data ?? []) ids.add(row.id)
  for (const row of memberRes.data ?? []) ids.add(row.halaqoh_id)
  return [...ids]
}

/**
 * Apakah guru boleh mengakses (lihat/setor) data seorang siswa?
 * True jika siswa berada di salah satu halaqoh yang diampu guru.
 */
export async function canTeacherAccessStudent(
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const supabase = createServerClient()
  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student?.halaqoh_id) return false
  const halaqohIds = await getTeacherHalaqohIds(teacherId)
  return halaqohIds.includes(student.halaqoh_id)
}

export interface TeacherStudentRow {
  id: string
  full_name: string
  nis: string | null
  gender: 'L' | 'P' | null
  kelas: string | null
  jenjang: string
  halaqoh_id: string | null
  halaqoh_name: string | null
  current_method_name: string | null
  current_jilid_label: string | null
  current_jilid_page: number | null
  last_setoran_date: string | null
  /** Sesi halaqoh (1-3). Null kalau halaqohnya belum punya sesi. */
  sesi: number | null
  /** Nomor HP wali — dipakai mengirim laporan lewat WhatsApp. */
  wali_phone: string | null
  wali_name: string | null
  /** Surat terakhir yang disetorkan, mis. "An-Naba'". Null = belum pernah. */
  last_tahfidz_surat: string | null
  last_tahfidz_date: string | null
  /** Banyaknya setoran tahfidz — ukuran kasar keaktifan hafalan. */
  tahfidz_count: number
}

/**
 * Daftar siswa yang diampu guru, lengkap dengan posisi tahsin & tanggal
 * setoran terakhir. Dipakai di /guru/siswa dan antrian dashboard.
 */
export async function getTeacherStudents(teacherId: string): Promise<TeacherStudentRow[]> {
  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(teacherId)
  if (halaqohIds.length === 0) return []

  const { data: students } = await supabase
    .from('students')
    .select(`
      id, full_name, nis, gender, kelas, jenjang, halaqoh_id, current_jilid_page,
      wali_name, wali_phone,
      halaqoh:halaqoh!students_halaqoh_id_fkey(name, sesi),
      current_method:tahsin_methods!students_current_method_id_fkey(name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(label)
    `)
    .in('halaqoh_id', halaqohIds)
    .eq('is_active', true)
    .order('full_name')

  const rows = (students ?? []) as unknown as Array<{
    id: string; full_name: string; nis: string | null; gender: 'L' | 'P' | null
    kelas: string | null; jenjang: string; halaqoh_id: string | null; current_jilid_page: number | null
    wali_name: string | null; wali_phone: string | null
    halaqoh: { name: string; sesi: number | null } | null
    current_method: { name: string } | null
    current_jilid: { label: string } | null
  }>

  if (rows.length === 0) return []

  // Tanggal setoran tahsin terakhir per siswa (satu query, lalu map)
  const studentIds = rows.map(r => r.id)
  const { data: lastLogs } = await supabase
    .from('tahsin_logs')
    .select('student_id, setoran_date')
    .in('student_id', studentIds)
    .order('setoran_date', { ascending: false })

  const lastMap = new Map<string, string>()
  for (const log of lastLogs ?? []) {
    if (!lastMap.has(log.student_id)) lastMap.set(log.student_id, log.setoran_date)
  }

  // Capaian tahfidz: surat terakhir + banyaknya setoran. Diambil dalam satu
  // query lalu dikelompokkan, bukan per siswa — satu halaqoh bisa berisi
  // puluhan anak, dan query per anak menjadikannya puluhan perjalanan bolak-balik.
  const { data: tahfidzLogs } = await supabase
    .from('tahfidz_logs')
    .select('student_id, setoran_date, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
    .in('student_id', studentIds)
    .order('setoran_date', { ascending: false })

  const tahfidzMap = new Map<string, { surat: string | null; date: string; count: number }>()
  for (const log of (tahfidzLogs ?? []) as unknown as Array<{ student_id: string; setoran_date: string; surat: { name_latin: string } | null }>) {
    const prev = tahfidzMap.get(log.student_id)
    if (prev) prev.count++
    else tahfidzMap.set(log.student_id, { surat: log.surat?.name_latin ?? null, date: log.setoran_date, count: 1 })
  }

  return rows.map(r => ({
    id: r.id,
    full_name: r.full_name,
    nis: r.nis,
    gender: r.gender,
    kelas: r.kelas,
    jenjang: r.jenjang,
    halaqoh_id: r.halaqoh_id,
    halaqoh_name: r.halaqoh?.name ?? null,
    current_method_name: r.current_method?.name ?? null,
    current_jilid_label: r.current_jilid?.label ?? null,
    current_jilid_page: r.current_jilid_page,
    last_setoran_date: lastMap.get(r.id) ?? null,
    sesi: r.halaqoh?.sesi ?? null,
    wali_phone: r.wali_phone,
    wali_name: r.wali_name,
    last_tahfidz_surat: tahfidzMap.get(r.id)?.surat ?? null,
    last_tahfidz_date: tahfidzMap.get(r.id)?.date ?? null,
    tahfidz_count: tahfidzMap.get(r.id)?.count ?? 0,
  }))
}
