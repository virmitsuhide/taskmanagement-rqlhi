import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { tanggalWIB } from '@/lib/rq/ujian'
import { totalJuzHafalan } from '@/lib/rq/hafalan'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import type {
  CalonPenguji,
  Jenjang,
  KategoriGuru,
  UjianPenguji,
  UjianStats,
  UjianTahfidz,
  UjianTahsin,
  UjianUnit,
} from '@/types'

/**
 * Pembacaan data pengajuan ujian.
 *
 * Semua fungsi menerima daftar unit yang boleh dilihat pemanggilnya dan
 * menyaringnya di query, bukan di komponen. Halaman kelola menampilkan SD dan
 * SMP di layar yang sama untuk kepala & kumik, jadi kalau penyaringan diserahkan
 * ke tampilan, satu tab yang lupa disaring langsung membocorkan antrian unit
 * lain ke koordinator yang tidak berhak.
 *
 * `units` kosong berarti tidak berhak apa pun — dijawab daftar kosong, bukan
 * dianggap "semua".
 */

const TAHFIDZ_COLS = '*'
const TAHSIN_COLS = '*'

/** Awal bulan menurut WIB, sebagai batas bawah query (inklusif). */
function awalBulanWIB(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`
}

/** Awal bulan berikutnya — batas atas eksklusif. */
function awalBulanBerikutnyaWIB(year: number, month: number): string {
  return month === 12 ? awalBulanWIB(year + 1, 1) : awalBulanWIB(year, month + 1)
}

// ─── Antrian publik ──────────────────────────────────────────────────────────

export interface AntrianUjian {
  tahfidz: UjianTahfidz[]
  tahsin: UjianTahsin[]
}

/**
 * Antrian yang masih berjalan — diajukan & dijadwalkan, seluruh unit.
 *
 * Dipakai halaman publik, jadi tidak menerima parameter unit: pengunjung
 * memilih tabnya sendiri di peramban.
 */
export async function getAntrianUjian(): Promise<AntrianUjian> {
  try {
    const supabase = createServerClient()
    const [tahfidz, tahsin] = await Promise.all([
      supabase
        .from('ujian_tahfidz')
        .select(TAHFIDZ_COLS)
        .in('status', ['diajukan', 'dijadwalkan'])
        .order('created_at', { ascending: true }),
      supabase
        .from('ujian_tahsin')
        .select(TAHSIN_COLS)
        .in('status', ['diajukan', 'dijadwalkan'])
        .order('created_at', { ascending: true }),
    ])
    return {
      tahfidz: (tahfidz.data ?? []) as UjianTahfidz[],
      tahsin: (tahsin.data ?? []) as UjianTahsin[],
    }
  } catch {
    return { tahfidz: [], tahsin: [] }
  }
}

// ─── Rekap hasil per bulan ───────────────────────────────────────────────────

/**
 * Ujian yang sudah selesai pada satu bulan, diurut menurut jadwalnya.
 *
 * Penyaringnya `jadwal`, bukan `created_at`: rekap bulan Agustus berarti ujian
 * yang DILAKSANAKAN Agustus, walau pengajuannya masuk Juli.
 */
export async function getRekapUjian(
  month: number,
  year: number,
  units?: UjianUnit[],
): Promise<AntrianUjian> {
  if (units && units.length === 0) return { tahfidz: [], tahsin: [] }

  try {
    const supabase = createServerClient()
    const dari = awalBulanWIB(year, month)
    const sampai = awalBulanBerikutnyaWIB(year, month)

    const tfQuery = supabase
      .from('ujian_tahfidz')
      .select(TAHFIDZ_COLS)
      .eq('status', 'selesai')
      .gte('jadwal', dari)
      .lt('jadwal', sampai)
      .order('jadwal', { ascending: true })
    const tsQuery = supabase
      .from('ujian_tahsin')
      .select(TAHSIN_COLS)
      .eq('status', 'selesai')
      .gte('jadwal', dari)
      .lt('jadwal', sampai)
      .order('jadwal', { ascending: true })

    if (units) {
      tfQuery.in('unit', units)
      tsQuery.in('unit', units)
    }

    const [tahfidz, tahsin] = await Promise.all([tfQuery, tsQuery])
    return {
      tahfidz: (tahfidz.data ?? []) as UjianTahfidz[],
      tahsin: (tahsin.data ?? []) as UjianTahsin[],
    }
  } catch {
    return { tahfidz: [], tahsin: [] }
  }
}

// ─── Kelola (pengurus) ───────────────────────────────────────────────────────

/** Seluruh pengajuan pada unit yang boleh dikelola, terbaru dahulu. */
export async function getPengajuanUjian(units: UjianUnit[]): Promise<AntrianUjian> {
  if (units.length === 0) return { tahfidz: [], tahsin: [] }

  try {
    const supabase = createServerClient()
    const [tahfidz, tahsin] = await Promise.all([
      supabase
        .from('ujian_tahfidz')
        .select(TAHFIDZ_COLS)
        .in('unit', units)
        .order('created_at', { ascending: false }),
      supabase
        .from('ujian_tahsin')
        .select(TAHSIN_COLS)
        .in('unit', units)
        .order('created_at', { ascending: false }),
    ])
    return {
      tahfidz: (tahfidz.data ?? []) as UjianTahfidz[],
      tahsin: (tahsin.data ?? []) as UjianTahsin[],
    }
  } catch {
    return { tahfidz: [], tahsin: [] }
  }
}

export interface UjianGuru extends AntrianUjian {
  /** Id siswa halaqoh guru ini — untuk menyorot anaknya di pengajuan kelompok. */
  idSiswa: string[]
}

/**
 * Ujian yang menyangkut seorang guru — daftar & progres di portal /guru.
 *
 * Dua jalan masuk: pengajuan yang ia buat sendiri, ATAU ujian yang menguji anak
 * halaqohnya walau diajukan orang lain. Yang kedua sering terjadi: guru
 * menyampaikan pengajuan secara lisan, lalu koordinator yang memasukkannya.
 * Kalau hanya pengaju yang dihitung, guru itu tidak pernah tahu anaknya sudah
 * terjadwal — padahal dialah yang harus menyiapkan anaknya.
 *
 * Ujian tahsin menyimpan siswanya dalam larik JSON, jadi penyaringannya
 * dikerjakan di sini atas pengajuan satu unit; jumlahnya hanya puluhan.
 */
export const getUjianGuru = cache(bacaUjianGuru)

// Dibungkus cache(): kerangka portal (lonceng) dan halaman beranda sama-sama
// memintanya dalam satu permintaan, dan cukup dibaca sekali.
async function bacaUjianGuru(teacherId: string): Promise<UjianGuru> {
  const kosong: UjianGuru = { tahfidz: [], tahsin: [], idSiswa: [] }
  try {
    const supabase = createServerClient()
    const [halaqohIds, unit] = await Promise.all([
      getTeacherHalaqohIds(teacherId),
      getUnitUjianGuru(teacherId),
    ])

    const { data: siswa } = halaqohIds.length > 0
      ? await supabase.from('students').select('id').in('halaqoh_id', halaqohIds).eq('is_active', true)
      : { data: [] as { id: string }[] }
    const idSiswa = (siswa ?? []).map(s => s.id as string)
    const milik = new Set(idSiswa)

    const [tfSendiri, tfAnak, tahsin] = await Promise.all([
      supabase.from('ujian_tahfidz').select(TAHFIDZ_COLS).eq('created_by_teacher', teacherId),
      idSiswa.length > 0
        ? supabase.from('ujian_tahfidz').select(TAHFIDZ_COLS).in('student_id', idSiswa)
        : Promise.resolve({ data: [] }),
      unit
        ? supabase.from('ujian_tahsin').select(TAHSIN_COLS).eq('unit', unit)
        : supabase.from('ujian_tahsin').select(TAHSIN_COLS).eq('created_by_teacher', teacherId),
    ])

    const tahfidzPerId = new Map<string, UjianTahfidz>()
    for (const r of [...(tfSendiri.data ?? []), ...(tfAnak.data ?? [])] as UjianTahfidz[]) {
      tahfidzPerId.set(r.id, r)
    }

    const terbaru = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at)
    return {
      tahfidz: [...tahfidzPerId.values()].sort(terbaru),
      tahsin: ((tahsin.data ?? []) as UjianTahsin[])
        .filter(t => t.created_by_teacher === teacherId
          || t.siswa.some(s => s.student_id && milik.has(s.student_id)))
        .sort(terbaru),
      idSiswa,
    }
  } catch {
    return kosong
  }
}

// ─── Unit seorang guru ───────────────────────────────────────────────────────

/**
 * Unit ujian seorang guru, atau null kalau ia tidak mengajukan ujian.
 *
 * Yang menjalankan antrian ujian hanya SDIT & SMPIT. Guru SD Juara, PAUD, dan
 * SMA sengaja dijawab null — menunya tidak muncul dan server action menolak
 * pengajuannya, sebab tidak ada koordinator yang akan menjadwalkannya.
 */
export async function getUnitUjianGuru(teacherId: string): Promise<UjianUnit | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('teachers')
      .select('unit')
      .eq('id', teacherId)
      .maybeSingle()

    if (data?.unit === 'sd') return 'SD'
    if (data?.unit === 'smp') return 'SMP'
    return null
  } catch {
    return null
  }
}

// ─── Daftar penguji ──────────────────────────────────────────────────────────

export async function getPengujis(): Promise<UjianPenguji[]> {
  try {
    const supabase = createServerClient()
    // Unit & kategori ikut dibawa lewat relasi teacher_id supaya daftar penguji
    // bisa menyebut asal tiap orang. Kalau 0054 belum dijalankan, select ini
    // gagal — dan kueri cadangan di bawah mengembalikan daftar apa adanya,
    // sebagaimana sebelum penautan ada.
    const { data, error } = await supabase
      .from('ujian_pengujis')
      .select('id, nama, teacher_id, created_at, teachers(unit, kategori_guru)')
      .order('nama', { ascending: true })

    if (!error && data) {
      return (data as Record<string, unknown>[]).map(r => {
        const guru = r.teachers as { unit?: Jenjang | null; kategori_guru?: KategoriGuru | null } | null
        return {
          id: r.id as string,
          nama: r.nama as string,
          teacher_id: (r.teacher_id ?? null) as string | null,
          created_at: r.created_at as string,
          unit: guru?.unit ?? null,
          kategori_guru: guru?.kategori_guru ?? null,
        }
      })
    }

    const dasar = await supabase
      .from('ujian_pengujis')
      .select('*')
      .order('nama', { ascending: true })
    return (dasar.data ?? []) as UjianPenguji[]
  } catch {
    return []
  }
}

/**
 * Guru yang bisa dijadikan penguji — isi dropdown pencarian di Daftar Penguji.
 *
 * Yang sudah terdaftar TIDAK dibuang dari hasil, hanya ditandai. Koor yang
 * mengetik sebuah nama dan tidak menemukannya akan menyimpulkan gurunya belum
 * ada dan pergi membuat akun kedua; menampilkannya dengan keterangan “sudah
 * terdaftar” menjawab pertanyaannya di tempat ia bertanya.
 *
 * Guru nonaktif dan terhapus tidak ikut: penguji adalah penugasan yang sedang
 * berjalan, bukan riwayat.
 */
export async function getCalonPenguji(): Promise<CalonPenguji[]> {
  try {
    const supabase = createServerClient()

    const [guru, penguji] = await Promise.all([
      supabase
        .from('teachers')
        .select('id, full_name, unit, kategori_guru')
        .is('deleted_at', null)
        .eq('is_active', true),
      supabase.from('ujian_pengujis').select('teacher_id'),
    ])

    const terpakai = new Set(
      (penguji.data ?? [])
        .map(r => (r as { teacher_id?: string | null }).teacher_id)
        .filter((v): v is string => Boolean(v)),
    )

    return (guru.data ?? [])
      .map(g => ({
        id: g.id as string,
        full_name: g.full_name as string,
        unit: (g.unit ?? null) as Jenjang | null,
        kategori_guru: (g.kategori_guru ?? null) as KategoriGuru | null,
        sudahPenguji: terpakai.has(g.id as string),
      }))
      // localeCompare('id'), bukan ORDER BY — alasannya sama dengan
      // lib/data/guru-profil.ts: urutan byte melempar nama berhuruf besar dan
      // berawalan tanda baca ke tempat yang tidak diduga pencarinya.
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'))
  } catch {
    return []
  }
}

// ─── Angka ringkas ───────────────────────────────────────────────────────────

async function hitungStatus(
  table: 'ujian_tahfidz' | 'ujian_tahsin',
  units: UjianUnit[],
  status?: string,
): Promise<number> {
  const supabase = createServerClient()
  const q = supabase.from(table).select('id', { count: 'exact', head: true }).in('unit', units)
  if (status) q.eq('status', status)
  const { count } = await q
  return count ?? 0
}

/** Ringkasan satu jenis ujian untuk kartu dashboard. */
export async function getUjianStats(
  jenis: 'tahfidz' | 'tahsin',
  units: UjianUnit[],
): Promise<UjianStats> {
  const kosong: UjianStats = { diajukan: 0, dijadwalkan: 0, selesai: 0, total: 0 }
  if (units.length === 0) return kosong

  try {
    const table = jenis === 'tahfidz' ? 'ujian_tahfidz' : 'ujian_tahsin'
    const [diajukan, dijadwalkan, selesai, total] = await Promise.all([
      hitungStatus(table, units, 'diajukan'),
      hitungStatus(table, units, 'dijadwalkan'),
      hitungStatus(table, units, 'selesai'),
      hitungStatus(table, units),
    ])
    return { diajukan, dijadwalkan, selesai, total }
  } catch {
    return kosong
  }
}

// ─── Kalender jadwal ─────────────────────────────────────────────────────────

export interface EventUjian {
  /** YYYY-MM-DD menurut WIB. */
  date: string
  nama: string
  jenis: 'tahfidz' | 'tahsin'
  unit: UjianUnit
}

/** Ujian terjadwal pada satu bulan, siap dipetakan ke kalender. */
export async function getKalenderUjian(
  units: UjianUnit[],
  year: number,
  month: number,
): Promise<EventUjian[]> {
  if (units.length === 0) return []

  try {
    const supabase = createServerClient()
    const dari = awalBulanWIB(year, month)
    const sampai = awalBulanBerikutnyaWIB(year, month)

    const [tahfidz, tahsin] = await Promise.all([
      supabase
        .from('ujian_tahfidz')
        .select('jadwal, nama_siswa, unit')
        .eq('status', 'dijadwalkan')
        .in('unit', units)
        .gte('jadwal', dari)
        .lt('jadwal', sampai),
      supabase
        .from('ujian_tahsin')
        .select('jadwal, nama_kelompok, unit')
        .eq('status', 'dijadwalkan')
        .in('unit', units)
        .gte('jadwal', dari)
        .lt('jadwal', sampai),
    ])

    const tf = (tahfidz.data ?? [])
      .filter(r => r.jadwal)
      .map(r => ({
        date: tanggalWIB(r.jadwal as string),
        nama: r.nama_siswa as string,
        jenis: 'tahfidz' as const,
        unit: r.unit as UjianUnit,
      }))
    const ts = (tahsin.data ?? [])
      .filter(r => r.jadwal)
      .map(r => ({
        date: tanggalWIB(r.jadwal as string),
        nama: r.nama_kelompok as string,
        jenis: 'tahsin' as const,
        unit: r.unit as UjianUnit,
      }))

    return [...tf, ...ts]
  } catch {
    return []
  }
}

// ─── Badge "pengajuan baru" ──────────────────────────────────────────────────

/**
 * Berapa pengajuan masuk sejak pengurus ini terakhir membuka halaman kelola.
 *
 * Belum pernah membuka sama sekali dijawab 0, bukan "semua": badge bertuliskan
 * ratusan pada hari pertama tidak memberi tahu apa pun, dan penanda waktunya
 * baru mulai berjalan begitu halaman itu pertama kali dibuka.
 */
export async function getUjianBaruCount(userId: string, units: UjianUnit[]): Promise<number> {
  if (units.length === 0) return 0

  try {
    const supabase = createServerClient()
    const { data: user } = await supabase
      .from('users')
      .select('ujian_seen_at')
      .eq('id', userId)
      .maybeSingle()

    const seenAt = user?.ujian_seen_at as string | null | undefined
    if (!seenAt) return 0

    const [tahfidz, tahsin] = await Promise.all([
      supabase
        .from('ujian_tahfidz')
        .select('id', { count: 'exact', head: true })
        .in('unit', units)
        .gt('created_at', seenAt),
      supabase
        .from('ujian_tahsin')
        .select('id', { count: 'exact', head: true })
        .in('unit', units)
        .gt('created_at', seenAt),
    ])

    return (tahfidz.count ?? 0) + (tahsin.count ?? 0)
  } catch {
    return 0
  }
}

// ─── Nama pengaju ────────────────────────────────────────────────────────────

/**
 * Peta id pengaju → nama, untuk baris "oleh …" di halaman kelola.
 *
 * Dua tabel sumber karena pengaju bisa guru (portal /guru) atau pengurus
 * (dashboard). Kuncinya dipisah dengan awalan supaya id dari tabel berbeda
 * tidak pernah bertabrakan.
 */
export async function getNamaPengaju(
  items: { created_by_teacher: string | null; created_by_user: string | null }[],
): Promise<Record<string, string>> {
  const teacherIds = [...new Set(items.map(i => i.created_by_teacher).filter(Boolean))] as string[]
  const userIds = [...new Set(items.map(i => i.created_by_user).filter(Boolean))] as string[]
  if (teacherIds.length === 0 && userIds.length === 0) return {}

  try {
    const supabase = createServerClient()
    const peta: Record<string, string> = {}

    if (teacherIds.length > 0) {
      const { data } = await supabase.from('teachers').select('id, full_name').in('id', teacherIds)
      for (const t of data ?? []) peta[`teacher:${t.id}`] = t.full_name as string
    }
    if (userIds.length > 0) {
      const { data } = await supabase.from('users').select('id, display_name').in('id', userIds)
      for (const u of data ?? []) peta[`user:${u.id}`] = u.display_name as string
    }

    return peta
  } catch {
    return {}
  }
}

/** Kunci untuk membaca hasil getNamaPengaju pada satu baris pengajuan. */
export function kunciPengaju(item: {
  created_by_teacher: string | null
  created_by_user: string | null
}): string | null {
  if (item.created_by_teacher) return `teacher:${item.created_by_teacher}`
  if (item.created_by_user) return `user:${item.created_by_user}`
  return null
}

// ─── Ujian alumni SD LHI di SMP ──────────────────────────────────────────────

export interface UjianAlumniSd {
  id: string
  nama: string
  kelas: string | null
  halaqoh: string | null
  /** Juz tuntas menurut ujian lulus, dalam urutan hafalan RQ. */
  juzTeruji: number
  ujian: {
    id: string
    unit: UjianUnit
    tipe: UjianTahfidz['tipe']
    juz: string
    predikat: UjianTahfidz['predikat']
    status: UjianTahfidz['status']
    tanggal: string | null
  }[]
}

/**
 * Siswa SMP bertanda lulusan SD LHI, beserta seluruh ujian tahfidz mereka.
 *
 * `kolomAda` false = migrasi 0070 belum dijalankan. Daftar kosong karena
 * kolomnya belum ada tidak boleh tampil sama dengan "belum ada alumni".
 */
export async function getUjianAlumniSd(): Promise<{ siswa: UjianAlumniSd[]; kolomAda: boolean }> {
  const supabase = createServerClient()
  const { data: siswa, error } = await supabase
    .from('students')
    .select('id, full_name, kelas, halaqoh:halaqoh!students_halaqoh_id_fkey(name)')
    .eq('is_active', true)
    .eq('jenjang', 'smp')
    .eq('asal_sd_lhi', true)
    .order('kelas')
    .order('full_name')
  if (error) return { siswa: [], kolomAda: false }

  const rows = (siswa ?? []) as unknown as { id: string; full_name: string; kelas: string | null; halaqoh: { name: string } | null }[]
  if (rows.length === 0) return { siswa: [], kolomAda: true }

  const { data: ujian } = await supabase
    .from('ujian_tahfidz')
    .select('id, student_id, unit, tipe, juz, predikat, status, jadwal')
    .in('student_id', rows.map(r => r.id))
    .order('jadwal', { ascending: true, nullsFirst: true })

  const perSiswa = new Map<string, UjianAlumniSd['ujian']>()
  for (const u of (ujian ?? []) as (Pick<UjianTahfidz, 'id' | 'unit' | 'tipe' | 'juz' | 'predikat' | 'status' | 'jadwal'> & { student_id: string })[]) {
    const daftar = perSiswa.get(u.student_id) ?? []
    daftar.push({
      id: u.id, unit: u.unit, tipe: u.tipe, juz: String(u.juz), predikat: u.predikat, status: u.status,
      tanggal: u.jadwal ? tanggalWIB(u.jadwal) : null,
    })
    perSiswa.set(u.student_id, daftar)
  }

  return {
    kolomAda: true,
    siswa: rows.map(r => {
      const daftar = perSiswa.get(r.id) ?? []
      const lulus = daftar.filter(u => u.status === 'selesai' && u.predikat !== 'mengulang').map(u => u.juz)
      return {
        id: r.id, nama: r.full_name, kelas: r.kelas, halaqoh: r.halaqoh?.name ?? null,
        juzTeruji: totalJuzHafalan(lulus),
        ujian: daftar,
      }
    }),
  }
}
