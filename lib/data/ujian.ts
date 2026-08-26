import { createServerClient } from '@/lib/supabase/server'
import { tanggalWIB } from '@/lib/rq/ujian'
import type {
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

/** Pengajuan milik seorang guru sendiri — daftar di portal /guru. */
export async function getPengajuanGuru(teacherId: string): Promise<AntrianUjian> {
  try {
    const supabase = createServerClient()
    const [tahfidz, tahsin] = await Promise.all([
      supabase
        .from('ujian_tahfidz')
        .select(TAHFIDZ_COLS)
        .eq('created_by_teacher', teacherId)
        .order('created_at', { ascending: false }),
      supabase
        .from('ujian_tahsin')
        .select(TAHSIN_COLS)
        .eq('created_by_teacher', teacherId)
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
    const { data } = await supabase
      .from('ujian_pengujis')
      .select('*')
      .order('nama', { ascending: true })
    return (data ?? []) as UjianPenguji[]
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
