import { createServerClient } from '@/lib/supabase/server'
import { CADENCES, kunciPeriode } from '@/lib/rutin/periode'
import { JABATAN_ORDER, canViewTasks } from '@/lib/auth/permissions'
import type {
  RoutineCadence, RoutineOutcome, RoutineTask, RoutineTaskState, UserRole,
} from '@/types'

/**
 * Lapisan data Tugas Rutin.
 *
 * Dua cakupan, dan bedanya penting:
 *
 *   • getRoutineChecklist(userId) — milik satu orang, untuk dikerjakan.
 *     Tidak ada matriks izin di sini; pemanggilnya memberi userId dari
 *     sesinya sendiri dan tidak ada tampilan yang meminta milik orang lain.
 *
 *   • getRoutineBoard() — milik semua pengurus, untuk dipantau. Ini pintu
 *     yang memang melintasi batas orang, jadi penjaganya ada di pemanggil
 *     (canViewRoutineBoard) dan bukan di sini — sama seperti modul lain di
 *     lib/data yang menyerahkan keputusan izin ke halaman & server action.
 */

/** Bentuk baris laporan yang dibaca dari routine_task_checks. */
interface CheckRow {
  task_id: string
  period: string
  outcome: RoutineOutcome
  reason: string | null
  checked_at: string
}

/** Kunci periode berjalan untuk keempat irama sekaligus. */
function periodeBerjalan(): Record<RoutineCadence, string> {
  return {
    pekanan: kunciPeriode('pekanan'),
    bulanan: kunciPeriode('bulanan'),
    semesteran: kunciPeriode('semesteran'),
    tahunan: kunciPeriode('tahunan'),
  }
}

/**
 * Kunci indeks laporan di memori.
 *
 * KENAPA IKUT PERIODE, BUKAN task_id SAJA
 *
 * Sekilas task_id sudah cukup: satu tugas punya satu irama, jadi hanya satu
 * dari empat kunci periode yang bisa cocok dengannya. Tapi irama sebuah tugas
 * boleh disunting, dan riwayat laporannya sengaja tidak ikut dihapus saat itu
 * terjadi. Tugas yang pekan ini dipindah dari pekanan ke bulanan karena itu
 * bisa punya baris '2026-W38' DAN '2026-09' — keduanya periode berjalan,
 * keduanya masuk hasil query, dan indeks by task_id akan menyimpan entah yang
 * mana. Menyertakan periodenya membuat pencarian menanyakan hal yang memang
 * dimaksud: laporan untuk irama tugas ini, sekarang.
 */
const kunciLaporan = (taskId: string, period: string) => `${taskId}@${period}`

/**
 * Gabungkan daftar tugas dengan laporannya menjadi keadaan per tugas.
 *
 * Tugas tanpa baris laporan menjadi outcome null — "belum dilaporkan" adalah
 * ketiadaan baris, bukan sebuah nilai yang disimpan.
 */
function rakitState(
  tasks: RoutineTask[],
  laporan: Map<string, CheckRow>,
  periods: Record<RoutineCadence, string>,
): RoutineTaskState[] {
  return tasks.map(task => {
    const row = laporan.get(kunciLaporan(task.id, periods[task.cadence]))
    return {
      task,
      outcome: row?.outcome ?? null,
      reason: row?.reason ?? null,
      checkedAt: row?.checked_at ?? null,
    }
  })
}

function hitung(items: RoutineTaskState[]) {
  return {
    done: items.filter(i => i.outcome === 'terlaksana').length,
    missed: items.filter(i => i.outcome === 'tidak_terlaksana').length,
    pending: items.filter(i => i.outcome === null).length,
    total: items.length,
  }
}

/** Ambil laporan periode berjalan untuk sekumpulan tugas, terindeks kunciLaporan. */
async function ambilLaporan(
  taskIds: string[],
  periods: Record<RoutineCadence, string>,
): Promise<Map<string, CheckRow>> {
  const map = new Map<string, CheckRow>()
  if (taskIds.length === 0) return map

  const supabase = createServerClient()
  const { data } = await supabase
    .from('routine_task_checks')
    .select('task_id, period, outcome, reason, checked_at')
    .in('task_id', taskIds)
    .in('period', Object.values(periods))

  for (const row of (data ?? []) as CheckRow[]) {
    map.set(kunciLaporan(row.task_id, row.period), row)
  }
  return map
}

// ─── Checklist pribadi ───────────────────────────────────────────────────────

/** Isi checklist satu irama pada periode yang sedang berjalan. */
export interface RoutineGroup {
  cadence: RoutineCadence
  /** Kunci periode berjalan, mis. '2026-W36'. */
  period: string
  items: RoutineTaskState[]
  done: number
  missed: number
  pending: number
  total: number
}

/**
 * Checklist lengkap seorang pengurus untuk periode berjalan.
 *
 * Dua query, berapa pun banyaknya tugas: satu untuk daftarnya, satu untuk
 * laporan periode ini. Laporannya dicari dengan `period IN (…)` — empat kunci
 * saja, satu per irama.
 */
export async function getRoutineChecklist(userId: string): Promise<RoutineGroup[]> {
  const supabase = createServerClient()

  const { data: taskData } = await supabase
    .from('routine_tasks')
    .select('*')
    .eq('owner_id', userId)
    .order('cadence', { ascending: true })
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })

  const tasks = (taskData ?? []) as RoutineTask[]
  const periods = periodeBerjalan()
  const laporan = await ambilLaporan(tasks.map(t => t.id), periods)

  // Keempat kelompok selalu ditampilkan, termasuk saat kosong: halaman yang
  // hanya memunculkan kelompok berisi membuat orang mengira ia belum pernah
  // membuat tugas bulanan padahal ia hanya belum sampai ke sana.
  return CADENCES.map(cadence => {
    const items = rakitState(tasks.filter(t => t.cadence === cadence), laporan, periods)
    return { cadence, period: periods[cadence], items, ...hitung(items) }
  })
}

/** Satu tugas rutin milik pengguna ini — null bila bukan miliknya. */
export async function getRoutineTask(id: string, userId: string): Promise<RoutineTask | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('routine_tasks')
    .select('*')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()
  return (data as RoutineTask | null) ?? null
}

// ─── Papan kepala RQ ─────────────────────────────────────────────────────────

/** Seorang pengurus beserta seluruh tugas rutinnya pada periode berjalan. */
export interface RoutineBoardOwner {
  userId: string
  displayName: string
  role: UserRole
  photoUrl: string | null
  items: RoutineTaskState[]
  done: number
  missed: number
  pending: number
  total: number
}

/** Satu laporan "tidak terlaksana", lengkap dengan siapa pelapornya. */
export interface RoutineKendala {
  ownerId: string
  displayName: string
  role: UserRole
  task: RoutineTask
  reason: string
  reportedAt: string
}

export interface RoutineBoard {
  periods: Record<RoutineCadence, string>
  owners: RoutineBoardOwner[]
  /** Semua laporan tidak terlaksana periode ini, terbaru dulu. */
  kendala: RoutineKendala[]
  done: number
  missed: number
  pending: number
  total: number
}

/**
 * Seluruh tugas rutin seluruh pengurus pada periode yang sedang berjalan.
 *
 * Tiga query tetap, tidak peduli berapa pengurus dan berapa tugas: daftar
 * tugas, laporan periode ini, dan nama pemiliknya. Versi yang mengulang query
 * per pengurus akan terlihat wajar hari ini (tiga belas kursi) dan menjadi
 * beban begitu papan ini dibuka tiap hari.
 *
 * KENAPA PENGURUS TANPA TUGAS TETAP MUNCUL
 *
 * Papan ini dipakai untuk menilai apakah tiap amanah punya irama kerja yang
 * jelas. Pengurus yang belum menyusun satu pun tugas rutin adalah temuan yang
 * paling perlu dilihat kepala RQ — dan justru dialah yang akan hilang dari
 * papan kalau daftarnya dibangun dari tabel tugas saja.
 */
export async function getRoutineBoard(): Promise<RoutineBoard> {
  const supabase = createServerClient()
  const periods = periodeBerjalan()

  const [{ data: taskData }, { data: userData }] = await Promise.all([
    supabase
      .from('routine_tasks')
      .select('*')
      .order('cadence', { ascending: true })
      .order('order_num', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('users').select('id, display_name, role, photo_url'),
  ])

  const tasks = (taskData ?? []) as RoutineTask[]
  const users = (userData ?? []) as {
    id: string; display_name: string; role: UserRole; photo_url: string | null
  }[]
  const laporan = await ambilLaporan(tasks.map(t => t.id), periods)

  const perPemilik = new Map<string, RoutineTask[]>()
  for (const t of tasks) {
    const daftar = perPemilik.get(t.owner_id)
    if (daftar) daftar.push(t)
    else perPemilik.set(t.owner_id, [t])
  }

  // Urutan struktural, bukan abjad — sama dengan halaman Pengurus. Peran di
  // luar daftar (kalau ada peran baru yang belum masuk JABATAN_ORDER) jatuh
  // ke belakang alih-alih hilang.
  const urutan = (role: UserRole) => {
    const i = JABATAN_ORDER.indexOf(role)
    return i === -1 ? JABATAN_ORDER.length : i
  }

  // Peran yang tidak melewati modul tugas sama sekali dikeluarkan dari papan.
  // Mereka tidak punya halaman untuk menyusun tugas rutin, jadi menampilkan
  // mereka di daftar "belum menyusun tugas rutin" akan melaporkan kelalaian
  // atas sesuatu yang memang tidak bisa mereka kerjakan.
  const owners: RoutineBoardOwner[] = users
    .filter(u => canViewTasks(u.role))
    .sort((a, b) => urutan(a.role) - urutan(b.role) || a.display_name.localeCompare(b.display_name))
    .map(u => {
      const items = rakitState(perPemilik.get(u.id) ?? [], laporan, periods)
      return {
        userId: u.id,
        displayName: u.display_name,
        role: u.role,
        photoUrl: u.photo_url,
        items,
        ...hitung(items),
      }
    })

  const kendala: RoutineKendala[] = owners
    .flatMap(o =>
      o.items
        .filter(i => i.outcome === 'tidak_terlaksana')
        .map(i => ({
          ownerId: o.userId,
          displayName: o.displayName,
          role: o.role,
          task: i.task,
          reason: i.reason ?? '',
          reportedAt: i.checkedAt ?? '',
        })),
    )
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))

  const semua = owners.flatMap(o => o.items)

  return { periods, owners, kendala, ...hitung(semua) }
}
