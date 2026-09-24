import { createServerClient } from '@/lib/supabase/server'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { ikutRiyadhoh, pesertaBawaan, type KelompokRiyadhoh } from '@/lib/rq/riyadhoh'

/**
 * Riyadhoh Qur'an SMP (0087) — jadwal Sabtu, pengampu, peserta, kehadiran.
 * Lihat drizzle/0087_riyadhoh_PASTE_TO_SUPABASE.sql.
 *
 * Semua pembaca di sini tahan terhadap 0087 yang belum dijalankan: tabel
 * yang tidak ada dibaca sebagai kosong, dan halaman koordinator yang
 * memeriksa `tabelAda` menampilkan petunjuk menjalankan migrasinya.
 */

export type StatusHadir = 'hadir' | 'izin' | 'sakit' | 'alfa'

// ─── Jadwal ──────────────────────────────────────────────────────────────────

/** tanggal → kelompok, untuk Sabtu di rentang [dari, sampai]. `null` = tabel belum ada. */
export async function getJadwalRiyadhoh(dari: string, sampai: string): Promise<Record<string, KelompokRiyadhoh> | null> {
  const { data, error } = await createServerClient()
    .from('riyadhoh_jadwal').select('tanggal, gender').gte('tanggal', dari).lte('tanggal', sampai).order('tanggal')
  if (error) return null
  return Object.fromEntries(((data ?? []) as { tanggal: string; gender: KelompokRiyadhoh }[]).map(r => [r.tanggal, r.gender]))
}

/** Sabtu terjadwal terakhir sebelum `tanggal` — meneruskan giliran bulan lalu. */
export async function jadwalSebelum(tanggal: string): Promise<KelompokRiyadhoh | null> {
  const { data } = await createServerClient()
    .from('riyadhoh_jadwal').select('gender').lt('tanggal', tanggal).order('tanggal', { ascending: false }).limit(1)
  return ((data ?? []) as { gender: KelompokRiyadhoh }[])[0]?.gender ?? null
}

export async function kelompokPadaTanggal(tanggal: string): Promise<KelompokRiyadhoh | null> {
  const { data } = await createServerClient().from('riyadhoh_jadwal').select('gender').eq('tanggal', tanggal).maybeSingle()
  return (data as { gender: KelompokRiyadhoh } | null)?.gender ?? null
}

// ─── Pengampu ────────────────────────────────────────────────────────────────

export interface PengampuRiyadhoh {
  teacher_id: string
  full_name: string
  kelompok: KelompokRiyadhoh[]
}

export async function getPengampuRiyadhoh(): Promise<PengampuRiyadhoh[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('riyadhoh_pengampu').select('teacher_id, gender')
  if (error || !data?.length) return []
  const rows = data as { teacher_id: string; gender: KelompokRiyadhoh }[]
  const { data: guru } = await supabase.from('teachers').select('id, full_name').in('id', [...new Set(rows.map(r => r.teacher_id))])
  const nama = new Map(((guru ?? []) as { id: string; full_name: string }[]).map(g => [g.id, g.full_name]))
  const per = new Map<string, KelompokRiyadhoh[]>()
  for (const r of rows) per.set(r.teacher_id, [...(per.get(r.teacher_id) ?? []), r.gender])
  return [...per]
    .map(([teacher_id, kelompok]) => ({ teacher_id, full_name: nama.get(teacher_id) ?? '—', kelompok: kelompok.sort() }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

/** Kelompok yang diampu seorang guru; kosong = bukan pengampu Riyadhoh. */
export async function kelompokPengampu(teacherId: string): Promise<KelompokRiyadhoh[]> {
  const { data, error } = await createServerClient().from('riyadhoh_pengampu').select('gender').eq('teacher_id', teacherId)
  if (error) return []
  return ((data ?? []) as { gender: KelompokRiyadhoh }[]).map(r => r.gender).sort()
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

export interface PesertaRiyadhoh {
  id: string
  full_name: string
  kelas: string | null
  program: string | null
  gender: KelompokRiyadhoh | null
  halaqoh_name: string | null
  /** Memenuhi aturan bawaan (kelas 9, atau 7–8 QuLS). */
  bawaan: boolean
  /** Pengecualian koordinator; undefined = ikut aturan. */
  pengecualian?: boolean
  ikut: boolean
}

/**
 * Seluruh siswa SMP aktif, ditandai ikut atau tidak — halaman koordinator
 * butuh yang tidak ikut juga, supaya bisa memasukkannya. Anak di luar SMP
 * hanya muncul bila koordinator pernah memasukkannya secara khusus.
 */
export async function getSiswaRiyadhoh(): Promise<PesertaRiyadhoh[]> {
  const supabase = createServerClient()
  const kolom = 'id, full_name, kelas, program, gender, jenjang, halaqoh:halaqoh!students_halaqoh_id_fkey(name)'
  const [smpRes, ubahRes] = await Promise.all([
    supabase.from('students').select(kolom).eq('is_active', true).eq('jenjang', 'smp').order('kelas').order('full_name'),
    supabase.from('riyadhoh_peserta').select('student_id, ikut'),
  ])
  const ubah = new Map(((ubahRes.data ?? []) as { student_id: string; ikut: boolean }[]).map(r => [r.student_id, r.ikut]))

  type Baris = { id: string; full_name: string; kelas: string | null; program: string | null; gender: KelompokRiyadhoh | null; jenjang: string; halaqoh: { name: string } | null }
  const rows = (smpRes.data ?? []) as unknown as Baris[]
  const luarSmp = [...ubah].filter(([id, ikut]) => ikut && !rows.some(r => r.id === id)).map(([id]) => id)
  if (luarSmp.length > 0) {
    const { data } = await supabase.from('students').select(kolom).eq('is_active', true).in('id', luarSmp)
    rows.push(...((data ?? []) as unknown as Baris[]))
  }

  return rows.map(r => ({
    id: r.id,
    full_name: r.full_name,
    kelas: r.kelas,
    program: r.program,
    gender: r.gender,
    halaqoh_name: r.halaqoh?.name ?? null,
    bawaan: pesertaBawaan(r),
    ...(ubah.has(r.id) ? { pengecualian: ubah.get(r.id) } : {}),
    ikut: ikutRiyadhoh(r, ubah.get(r.id)),
  }))
}

/** Peserta satu kelompok — yang masuk pada Sabtu kelompok itu. */
export async function getPesertaKelompok(kelompok: KelompokRiyadhoh): Promise<PesertaRiyadhoh[]> {
  return (await getSiswaRiyadhoh()).filter(s => s.ikut && s.gender === kelompok)
}

// ─── Akses setoran ───────────────────────────────────────────────────────────

/**
 * Siapa yang boleh mencatat setoran seorang anak pada sebuah tanggal:
 *   'reguler'  — guru halaqoh sekolahnya (setiap hari, seperti biasa);
 *   'riyadhoh' — pengampu Riyadhoh kelompok anak itu, HANYA pada Sabtu yang
 *                dijadwalkan untuk kelompoknya, dan anak itu peserta;
 *   null       — tidak boleh.
 *
 * Jalur Riyadhoh sengaja dikunci ke tanggalnya: pengampu Sabtu bukan guru
 * anak itu di hari lain, dan setoran yang ia catat di hari sekolah akan
 * menyelinap ke riwayat halaqoh yang bukan miliknya.
 */
export async function aksesSetoran(teacherId: string, studentId: string, tanggal: string): Promise<'reguler' | 'riyadhoh' | null> {
  if (await canTeacherAccessStudent(teacherId, studentId)) return 'reguler'
  return (await bolehRiyadhoh(teacherId, studentId, tanggal)) ? 'riyadhoh' : null
}

export async function bolehRiyadhoh(teacherId: string, studentId: string, tanggal: string): Promise<boolean> {
  const supabase = createServerClient()
  const [kelompok, diampu, siswaRes, ubahRes] = await Promise.all([
    kelompokPadaTanggal(tanggal),
    kelompokPengampu(teacherId),
    supabase.from('students').select('jenjang, kelas, program, gender, is_active').eq('id', studentId).maybeSingle(),
    supabase.from('riyadhoh_peserta').select('ikut').eq('student_id', studentId).maybeSingle(),
  ])
  const s = siswaRes.data as { jenjang: string; kelas: string | null; program: string | null; gender: KelompokRiyadhoh | null; is_active: boolean } | null
  // Sabtu yang belum tiba belum bisa dicatat — setoran tidak ditulis di muka.
  if (tanggal > hariIniWIB()) return false
  if (!kelompok || !diampu.includes(kelompok) || !s?.is_active || s.gender !== kelompok) return false
  return ikutRiyadhoh(s, (ubahRes.data as { ikut: boolean } | null)?.ikut)
}

/** Tanggal hari ini menurut WIB, 'YYYY-MM-DD' — server berjalan di UTC. */
export function hariIniWIB(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

// ─── Sabtu seorang pengampu ──────────────────────────────────────────────────

export interface SabtuPengampu {
  /** Kelompok yang diampu; kosong = bukan pengampu Riyadhoh. */
  kelompok: KelompokRiyadhoh[]
  /** Sabtu terjadwal untuk kelompoknya, ±2 bulan dari hari ini, urut naik. */
  daftar: { tanggal: string; kelompok: KelompokRiyadhoh }[]
  /** Sabtu yang sedang dibuka, atau null bila belum ada jadwal sama sekali. */
  terpilih: { tanggal: string; kelompok: KelompokRiyadhoh } | null
  hariIni: string
}

/**
 * Sabtu yang dibuka pengampu: yang diminta bila sah; kalau tidak, hari ini
 * bila hari ini Sabtu kelompoknya, lalu Sabtu terakhir yang sudah lewat —
 * pencatatan sering menyusul — dan baru Sabtu berikutnya yang terdekat.
 */
export async function getSabtuPengampu(teacherId: string, diminta?: string): Promise<SabtuPengampu> {
  const hariIni = hariIniWIB()
  const kelompok = await kelompokPengampu(teacherId)
  if (kelompok.length === 0) return { kelompok, daftar: [], terpilih: null, hariIni }

  const geser = (hari: number) => new Date(Date.parse(`${hariIni}T00:00:00Z`) + hari * 86400_000).toISOString().slice(0, 10)
  const jadwal = (await getJadwalRiyadhoh(geser(-62), geser(62))) ?? {}
  const daftar = Object.entries(jadwal)
    .filter(([, g]) => kelompok.includes(g))
    .map(([tanggal, g]) => ({ tanggal, kelompok: g }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  const terpilih =
    daftar.find(d => d.tanggal === diminta) ??
    daftar.find(d => d.tanggal === hariIni) ??
    [...daftar].reverse().find(d => d.tanggal < hariIni) ??
    daftar.find(d => d.tanggal > hariIni) ??
    null
  return { kelompok, daftar, terpilih, hariIni }
}

// ─── Kehadiran ───────────────────────────────────────────────────────────────

export async function getHadirRiyadhoh(tanggal: string): Promise<Record<string, StatusHadir>> {
  const { data } = await createServerClient().from('riyadhoh_hadir').select('student_id, status').eq('tanggal', tanggal)
  return Object.fromEntries(((data ?? []) as { student_id: string; status: StatusHadir }[]).map(r => [r.student_id, r.status]))
}

/** Siswa yang sudah punya setoran Riyadhoh pada tanggal itu — penanda di daftar pengampu. */
export async function getSudahSetorRiyadhoh(tanggal: string): Promise<{ tahsin: Set<string>; tahfidz: Set<string> }> {
  const supabase = createServerClient()
  const [ts, tf] = await Promise.all([
    supabase.from('tahsin_logs').select('student_id').eq('setoran_date', tanggal).eq('riyadhoh', true),
    supabase.from('tahfidz_logs').select('student_id').eq('setoran_date', tanggal).eq('riyadhoh', true),
  ])
  return {
    tahsin: new Set(((ts.data ?? []) as { student_id: string }[]).map(r => r.student_id)),
    tahfidz: new Set(((tf.data ?? []) as { student_id: string }[]).map(r => r.student_id)),
  }
}
