import { createServerClient } from '@/lib/supabase/server'
import { levelSah, type LevelAsrama } from '@/lib/rq/asrama'
import { hariIniWIB } from '@/lib/data/riyadhoh'

/**
 * Halaqoh asrama (0110) — kelompok boarding SMPIT LHI dengan pengampu
 * asrama, di samping halaqoh sekolah anak.
 *
 * Semua pembacaan di sini menoleransi tabel yang belum ada (migrasi belum
 * dijalankan): hasilnya kosong, bukan galat, supaya halaman lain yang hanya
 * menampilkan lencana level tidak ikut rusak.
 */

/** Program SMP yang tinggal di asrama — calon anggota kelompok asrama. */
export const PROGRAM_BOARDING = ['reguler_bd', 'boarding_quls'] as const

/** Level per anak; anak yang bukan anggota asrama tidak ada di peta. */
export async function getLevelPerSiswa(studentIds: string[]): Promise<Map<string, LevelAsrama>> {
  const hasil = new Map<string, LevelAsrama>()
  if (studentIds.length === 0) return hasil
  const { data, error } = await createServerClient()
    .from('asrama_anggota')
    .select('student_id, level')
    .in('student_id', studentIds)
  if (error) return hasil
  for (const r of (data ?? []) as { student_id: string; level: string | null }[]) {
    const l = levelSah(r.level)
    if (l) hasil.set(r.student_id, l)
  }
  return hasil
}

export interface AnggotaAsrama {
  student_id: string
  nama: string
  kelas: string | null
  program: string | null
  level: LevelAsrama | null
  /** Halaqoh sekolah anak & pengampunya — pengampu kedua anak boarding. */
  halaqoh_sekolah: string | null
  pengampu_sekolah: string[]
}

export interface KelompokAsrama {
  id: string
  nama: string
  gender: 'L' | 'P'
  pengampu_id: string | null
  pengampu_nama: string | null
  urutan: number
  anggota: AnggotaAsrama[]
}

interface KelompokRow {
  id: string; nama: string; gender: 'L' | 'P'; pengampu_id: string | null; urutan: number
  pengampu: { full_name: string } | null
}

/**
 * Kelompok asrama aktif beserta anggotanya. `pengampuId` menyempitkan ke
 * kelompok yang diampu satu guru (portal guru).
 */
export async function getKelompokAsrama(opts: { pengampuId?: string } = {}): Promise<KelompokAsrama[]> {
  const supabase = createServerClient()
  let q = supabase
    .from('asrama_kelompok')
    .select('id, nama, gender, pengampu_id, urutan, pengampu:teachers!asrama_kelompok_pengampu_id_fkey(full_name)')
    .eq('is_active', true)
  if (opts.pengampuId) q = q.eq('pengampu_id', opts.pengampuId)
  const { data, error } = await q.order('gender').order('urutan').order('nama')
  if (error) return []
  const kelompok = (data ?? []) as unknown as KelompokRow[]
  if (kelompok.length === 0) return []

  const { data: anggotaRows } = await supabase
    .from('asrama_anggota')
    .select('student_id, kelompok_id, level, siswa:students!asrama_anggota_student_id_fkey(full_name, kelas, program, is_active, halaqoh_id, halaqoh:halaqoh!students_halaqoh_id_fkey(name, wali_teacher_id, halaqoh_teachers(teacher_id)))')
    .in('kelompok_id', kelompok.map(k => k.id))
  type AnggotaRow = {
    student_id: string; kelompok_id: string; level: string | null
    siswa: {
      full_name: string; kelas: string | null; program: string | null; is_active: boolean
      halaqoh: { name: string; wali_teacher_id: string | null; halaqoh_teachers: { teacher_id: string }[] | null } | null
    } | null
  }
  const anggota = ((anggotaRows ?? []) as unknown as AnggotaRow[]).filter(a => a.siswa?.is_active)

  // Nama pengampu sekolah diambil sekali untuk semua anggota.
  const guruIds = new Set<string>()
  for (const a of anggota) {
    const h = a.siswa?.halaqoh
    if (h?.wali_teacher_id) guruIds.add(h.wali_teacher_id)
    for (const t of h?.halaqoh_teachers ?? []) guruIds.add(t.teacher_id)
  }
  const { data: guruRows } = guruIds.size
    ? await supabase.from('teachers').select('id, full_name').in('id', [...guruIds])
    : { data: [] }
  const namaGuru = new Map(((guruRows ?? []) as { id: string; full_name: string }[]).map(g => [g.id, g.full_name]))

  const perKelompok = new Map<string, AnggotaAsrama[]>()
  for (const a of anggota) {
    const h = a.siswa!.halaqoh
    const pengampu = new Set<string>()
    if (h?.wali_teacher_id) pengampu.add(h.wali_teacher_id)
    for (const t of h?.halaqoh_teachers ?? []) pengampu.add(t.teacher_id)
    const item: AnggotaAsrama = {
      student_id: a.student_id,
      nama: a.siswa!.full_name,
      kelas: a.siswa!.kelas,
      program: a.siswa!.program,
      level: levelSah(a.level),
      halaqoh_sekolah: h?.name ?? null,
      pengampu_sekolah: [...pengampu].map(id => namaGuru.get(id)).filter((n): n is string => Boolean(n)),
    }
    perKelompok.set(a.kelompok_id, [...(perKelompok.get(a.kelompok_id) ?? []), item])
  }

  return kelompok.map(k => ({
    id: k.id,
    nama: k.nama,
    gender: k.gender,
    pengampu_id: k.pengampu_id,
    pengampu_nama: k.pengampu?.full_name ?? null,
    urutan: k.urutan,
    anggota: (perKelompok.get(k.id) ?? []).sort((x, y) => x.nama.localeCompare(y.nama, 'id')),
  }))
}

/** Apakah guru ini mengampu setidaknya satu kelompok asrama — untuk menu portal. */
export async function punyaKelompokAsrama(teacherId: string): Promise<boolean> {
  const { data, error } = await createServerClient()
    .from('asrama_kelompok').select('id').eq('pengampu_id', teacherId).eq('is_active', true).limit(1)
  return !error && (data ?? []).length > 0
}

/**
 * Boleh mencatat setoran JALUR ASRAMA untuk anak ini: anak anggota kelompok
 * aktif yang diampu guru ini. Tanggal yang belum tiba ditolak — setoran
 * tidak ditulis di muka.
 */
export async function bolehAsrama(teacherId: string, studentId: string, tanggal: string): Promise<boolean> {
  if (tanggal > hariIniWIB()) return false
  const { data, error } = await createServerClient()
    .from('asrama_anggota')
    .select('kelompok:asrama_kelompok!asrama_anggota_kelompok_id_fkey(pengampu_id, is_active)')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error || !data) return false
  const k = (data as unknown as { kelompok: { pengampu_id: string | null; is_active: boolean } | null }).kelompok
  return !!k && k.is_active && k.pengampu_id === teacherId
}

/** Gender asrama seorang anak (dari kelompoknya); null = bukan anggota asrama. */
export async function genderAsramaSiswa(studentId: string): Promise<'L' | 'P' | null> {
  const { data, error } = await createServerClient()
    .from('asrama_anggota')
    .select('kelompok:asrama_kelompok!asrama_anggota_kelompok_id_fkey(gender)')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error || !data) return null
  return (data as unknown as { kelompok: { gender: 'L' | 'P' } | null }).kelompok?.gender ?? null
}

/** Anak boarding aktif ber-gender ini yang belum masuk kelompok mana pun. */
export async function getBoardingTanpaKelompok(gender: 'L' | 'P'): Promise<{ id: string; nama: string; kelas: string | null }[]> {
  const supabase = createServerClient()
  const [{ data: siswa }, { data: anggota, error }] = await Promise.all([
    supabase.from('students').select('id, full_name, kelas')
      .eq('jenjang', 'smp').eq('is_active', true).eq('gender', gender)
      .in('program', [...PROGRAM_BOARDING]).order('kelas').order('full_name'),
    supabase.from('asrama_anggota').select('student_id'),
  ])
  if (error) return []
  const sudah = new Set(((anggota ?? []) as { student_id: string }[]).map(a => a.student_id))
  return ((siswa ?? []) as { id: string; full_name: string; kelas: string | null }[])
    .filter(s => !sudah.has(s.id))
    .map(s => ({ id: s.id, nama: s.full_name, kelas: s.kelas }))
}
