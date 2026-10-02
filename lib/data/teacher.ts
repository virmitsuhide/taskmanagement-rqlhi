import { createServerClient } from '@/lib/supabase/server'
import { levelSah, type LevelAsrama } from '@/lib/rq/asrama'
import { getJuzDrillPerSiswa } from '@/lib/data/drill-tahfidz'

export type JenisSetoran = 'tahsin' | 'tahfidz'

/** halaqoh_teachers.role yang membatasi guru ke satu jenis setoran. */
function jenisDariPeran(role: string | null): JenisSetoran | null {
  return role === 'tahsin' || role === 'tahfidz' ? role : null
}

/**
 * Halaqoh yang diampu seorang guru, beserta jenis setoran yang boleh ia
 * catat di sana: null = keduanya (bawaan), 'tahsin'/'tahfidz' = hanya itu.
 *
 * Pembatasan datang dari halaqoh_teachers.role. Di sebagian besar unit satu
 * guru memegang tahsin dan tahfidz sekaligus (role 'pengampu'). SMA LHI
 * berbeda: satu guru tahsin untuk semua anak, dua guru tahfidz — guru tahsin
 * tidak boleh mencatat tahfidz dan sebaliknya. Baris halaqoh_teachers yang
 * berperan khusus mengalahkan status wali: wali halaqoh SMA (guru tahfidz)
 * tetap hanya tahfidz.
 */
export async function getTeacherHalaqohPeran(teacherId: string): Promise<Map<string, JenisSetoran | null>> {
  const supabase = createServerClient()
  const [waliRes, memberRes] = await Promise.all([
    supabase.from('halaqoh').select('id').eq('wali_teacher_id', teacherId),
    supabase.from('halaqoh_teachers').select('halaqoh_id, role').eq('teacher_id', teacherId),
  ])

  const hasil = new Map<string, JenisSetoran | null>()
  for (const row of waliRes.data ?? []) hasil.set(row.id, null)
  for (const row of (memberRes.data ?? []) as { halaqoh_id: string; role: string | null }[]) {
    const jenis = jenisDariPeran(row.role)
    if (jenis || !hasil.has(row.halaqoh_id)) hasil.set(row.halaqoh_id, jenis)
  }
  return hasil
}

/**
 * Ambil semua halaqoh_id yang diampu seorang guru.
 * Sumber: wali_teacher_id di tabel halaqoh + relasi halaqoh_teachers.
 *
 * `jenis` diisi = hanya halaqoh tempat guru boleh mencatat setoran jenis itu
 * (lihat getTeacherHalaqohPeran). Tanpa `jenis` = semua halaqohnya, untuk
 * keperluan melihat (profil, rapor, statistik).
 */
export async function getTeacherHalaqohIds(teacherId: string, jenis?: JenisSetoran): Promise<string[]> {
  const peran = await getTeacherHalaqohPeran(teacherId)
  return [...peran].filter(([, j]) => !jenis || j === null || j === jenis).map(([id]) => id)
}

/**
 * Apakah guru boleh mengakses (lihat/setor) data seorang siswa?
 * True jika siswa berada di salah satu halaqoh yang diampu guru — dan, bila
 * `jenis` diisi, guru boleh mencatat setoran jenis itu di halaqoh tersebut.
 */
export async function canTeacherAccessStudent(
  teacherId: string,
  studentId: string,
  jenis?: JenisSetoran,
): Promise<boolean> {
  const supabase = createServerClient()
  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student?.halaqoh_id) return false
  const halaqohIds = await getTeacherHalaqohIds(teacherId, jenis)
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
  /** Sudah Lulus Tahsin (tahap terakhir) — setorannya tinggal tahfidz. */
  lulus_tahsin: boolean
  current_jilid_page: number | null
  /** Tanggal masuk drill tahsin (0064); null = tidak sedang drill. */
  tahsin_drill_sejak: string | null
  /** Juz tahfidz yang sedang drill (ziyadah tuntas, ujian 1 juz belum diajukan — 0065). */
  tahfidz_drill_juz: number[]
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
  /** Anak halaqoh sekolah guru ini (bukan hanya anak asramanya). */
  pengampu_sekolah: boolean
  /** Nama kelompok asrama yang diampu guru ini (0110); null = bukan anak asramanya. */
  asrama_kelompok: string | null
  /** Level anak boarding (0110). */
  level: LevelAsrama | null
}

/**
 * Anak kelompok asrama yang diampu guru (0110): id siswa → nama kelompok,
 * beserta levelnya. Dibaca langsung di sini, bukan lewat lib/data/asrama,
 * supaya tidak membentuk lingkaran impor (asrama → riyadhoh → teacher).
 * Tabel belum ada (sebelum 0110) = kosong.
 */
async function anakAsramaGuru(teacherId: string): Promise<Map<string, { kelompok: string; level: LevelAsrama | null }>> {
  const hasil = new Map<string, { kelompok: string; level: LevelAsrama | null }>()
  const supabase = createServerClient()
  const { data: kelompok, error } = await supabase
    .from('asrama_kelompok').select('id, nama').eq('pengampu_id', teacherId).eq('is_active', true)
  if (error || !kelompok?.length) return hasil
  const nama = new Map((kelompok as { id: string; nama: string }[]).map(k => [k.id, k.nama]))
  const { data: anggota } = await supabase
    .from('asrama_anggota').select('student_id, kelompok_id, level').in('kelompok_id', [...nama.keys()])
  for (const a of (anggota ?? []) as { student_id: string; kelompok_id: string; level: string | null }[]) {
    hasil.set(a.student_id, { kelompok: nama.get(a.kelompok_id) ?? 'Asrama', level: levelSah(a.level) })
  }
  return hasil
}

/**
 * Daftar siswa yang diampu guru, lengkap dengan posisi tahsin & tanggal
 * setoran terakhir. Dipakai di /guru/siswa dan antrian dashboard.
 */
export async function getTeacherStudents(
  teacherId: string,
  /**
   * denganAsrama: ikut sertakan anak kelompok asrama yang diampu (0110) —
   * hanya untuk tampilan "Siswa Saya". Sengaja tidak bawaan: pemakai lain
   * (pengajuan ujian, antrian dashboard) memakai daftar ini sebagai
   * "anak yang boleh saya urus di sekolah".
   */
  /** jenis: hanya anak yang boleh disetor jenis ini oleh guru (getTeacherHalaqohIds). */
  opts: { denganAsrama?: boolean; jenis?: JenisSetoran } = {},
): Promise<TeacherStudentRow[]> {
  const supabase = createServerClient()
  const [halaqohIds, asrama] = await Promise.all([
    getTeacherHalaqohIds(teacherId, opts.jenis),
    opts.denganAsrama ? anakAsramaGuru(teacherId) : Promise.resolve(new Map<string, { kelompok: string; level: LevelAsrama | null }>()),
  ])
  if (halaqohIds.length === 0 && asrama.size === 0) return []
  const saring = [
    halaqohIds.length ? `halaqoh_id.in.(${halaqohIds.join(',')})` : null,
    asrama.size ? `id.in.(${[...asrama.keys()].join(',')})` : null,
  ].filter(Boolean).join(',')
  const sekolah = new Set(halaqohIds)

  const { data: students } = await supabase
    .from('students')
    .select(`
      id, full_name, nis, gender, kelas, jenjang, halaqoh_id, current_jilid_page, tahsin_drill_sejak,
      wali_name, wali_phone,
      halaqoh:halaqoh!students_halaqoh_id_fkey(name, sesi),
      current_method:tahsin_methods!students_current_method_id_fkey(name),
      current_jilid:jilid_levels!students_current_jilid_id_fkey(label, is_terminal)
    `)
    .or(saring)
    .eq('is_active', true)
    .order('full_name')

  const rows = (students ?? []) as unknown as Array<{
    id: string; full_name: string; nis: string | null; gender: 'L' | 'P' | null
    kelas: string | null; jenjang: string; halaqoh_id: string | null; current_jilid_page: number | null
    tahsin_drill_sejak: string | null
    wali_name: string | null; wali_phone: string | null
    halaqoh: { name: string; sesi: number | null } | null
    current_method: { name: string } | null
    current_jilid: { label: string; is_terminal: boolean } | null
  }>

  if (rows.length === 0) return []

  const drillTahfidz = await getJuzDrillPerSiswa(rows.map(r => r.id))

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
    lulus_tahsin: Boolean(r.current_jilid?.is_terminal),
    current_jilid_page: r.current_jilid_page,
    tahsin_drill_sejak: r.tahsin_drill_sejak,
    tahfidz_drill_juz: (drillTahfidz.get(r.id) ?? []).map(d => d.juz).sort((a, b) => b - a),
    // Anak yang sudah Lulus Tahsin tidak setor tahsin lagi: setoran
    // terakhirnya adalah tahfidz. Tanpa ini ia terus menumpuk di antrian
    // sebagai "sekian hari belum setor".
    last_setoran_date: (r.current_jilid?.is_terminal ? tahfidzMap.get(r.id)?.date : lastMap.get(r.id)) ?? null,
    sesi: r.halaqoh?.sesi ?? null,
    wali_phone: r.wali_phone,
    wali_name: r.wali_name,
    last_tahfidz_surat: tahfidzMap.get(r.id)?.surat ?? null,
    last_tahfidz_date: tahfidzMap.get(r.id)?.date ?? null,
    tahfidz_count: tahfidzMap.get(r.id)?.count ?? 0,
    pengampu_sekolah: r.halaqoh_id !== null && sekolah.has(r.halaqoh_id),
    asrama_kelompok: asrama.get(r.id)?.kelompok ?? null,
    level: asrama.get(r.id)?.level ?? null,
  }))
}
