import { createServerClient } from '@/lib/supabase/server'
import { CADENCES, kunciPeriode } from '@/lib/rutin/periode'
import { JABATAN_ORDER, canViewTasks } from '@/lib/auth/permissions'
import { labelPengurus, type PengurusMention } from '@/lib/rutin/bersama'
import type {
  KonfirmasiRutin, RoutineCadence, RoutineOutcome, RoutineTask, RoutineTaskState, StatusAnggotaRutin, UserRole,
} from '@/types'

/**
 * Lapisan data Tugas Rutin.
 *
 * Dua cakupan, dan bedanya penting:
 *
 *   • getRoutineChecklist(userId) — milik satu orang, untuk dikerjakan:
 *     tugas yang ia buat, ditambah tugas bersama yang ajakannya ia terima
 *     (0073). Pemanggilnya memberi userId dari sesinya sendiri.
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
  checked_by: string | null
  /** Sebelum 0073 kolom ini belum ada; dianggap 'selesai'. */
  konfirmasi?: KonfirmasiRutin
}

interface AnggotaRow {
  task_id: string
  user_id: string
  status: StatusAnggotaRutin
  created_at: string
}

interface KeputusanRow {
  task_id: string
  period: string
  user_id: string
  keputusan: 'setuju' | 'tolak'
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

/** Bahan tugas bersama yang dibaca sekali lalu dipakai merakit semua baris. */
interface KonteksBersama {
  anggota: Map<string, AnggotaRow[]>
  keputusan: Map<string, KeputusanRow[]>
  label: Map<string, string>
  /** Pemirsa; '' untuk papan Kepala RQ yang tidak ikut mengerjakan apa pun. */
  viewerId: string
}

/**
 * Gabungkan daftar tugas dengan laporannya menjadi keadaan per tugas.
 *
 * Tugas tanpa baris laporan menjadi outcome null — "belum dilaporkan" adalah
 * ketiadaan baris, bukan sebuah nilai yang disimpan.
 *
 * Laporan terlaksana tugas bersama yang belum dikonfirmasi semua rekan juga
 * dibaca sebagai outcome null. Di checklist, papan, dan hitungan mana pun,
 * tugas itu BELUM tercentang; keterangan "menunggu konfirmasi" dibawa
 * terpisah di `bersama.laporan`.
 */
function rakitState(
  tasks: RoutineTask[],
  laporan: Map<string, CheckRow>,
  periods: Record<RoutineCadence, string>,
  konteks: KonteksBersama,
): RoutineTaskState[] {
  const labelDari = (id: string | null) => (id ? konteks.label.get(id) ?? 'Pengurus' : 'Pengurus')

  return tasks.map(task => {
    const period = periods[task.cadence]
    const row = laporan.get(kunciLaporan(task.id, period))
    const tertunda = row?.outcome === 'terlaksana' && (row.konfirmasi ?? 'selesai') !== 'selesai'
    const state: RoutineTaskState = {
      task,
      outcome: row && !tertunda ? row.outcome : null,
      reason: row && !tertunda ? row.reason : null,
      checkedAt: row && !tertunda ? row.checked_at : null,
    }

    const anggota = konteks.anggota.get(task.id) ?? []
    if (anggota.length === 0) return state

    const peserta = [task.owner_id, ...anggota.filter(a => a.status === 'diterima').map(a => a.user_id)]
    let info: NonNullable<RoutineTaskState['bersama']>['laporan'] = null
    if (row && tertunda) {
      const pelapor = row.checked_by ?? task.owner_id
      const kep = konteks.keputusan.get(kunciLaporan(task.id, period)) ?? []
      const kepPeta = new Map(kep.map(k => [k.user_id, k.keputusan]))
      const wajib = [...new Set(peserta)].filter(p => p !== pelapor)
      const konfirmasi = row.konfirmasi === 'ditolak' ? 'ditolak' : 'menunggu'
      const rekan = konfirmasi === 'ditolak'
        ? wajib.filter(u => kepPeta.get(u) === 'tolak')
        : wajib.filter(u => !kepPeta.has(u))
      const v = konteks.viewerId
      info = {
        konfirmasi,
        pelapor: { userId: pelapor, label: labelDari(pelapor) },
        rekan: rekan.map(labelDari),
        saya: v === pelapor ? 'pelapor'
          : kepPeta.get(v) === 'tolak' ? 'menolak'
          : kepPeta.get(v) === 'setuju' ? 'sudah_setuju'
          : 'perlu_konfirmasi',
      }
    }

    state.bersama = {
      pemilik: { userId: task.owner_id, label: labelDari(task.owner_id) },
      sayaPemilik: konteks.viewerId === task.owner_id,
      anggota: anggota.map(a => ({ userId: a.user_id, label: labelDari(a.user_id), status: a.status })),
      laporan: info,
    }
    return state
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
  const kolom = 'task_id, period, outcome, reason, checked_at, checked_by'
  const baca = (pilih: string) => supabase
    .from('routine_task_checks')
    .select(pilih)
    .in('task_id', taskIds)
    .in('period', Object.values(periods))
  let { data, error } = await baca(`${kolom}, konfirmasi`)
  // Migrasi 0073 belum dijalankan → kolom konfirmasi belum ada. Checklist
  // pribadi tetap harus hidup; semua laporan terbaca selesai seperti dulu.
  if (error) ({ data, error } = await baca(kolom))

  for (const row of (data ?? []) as unknown as CheckRow[]) {
    map.set(kunciLaporan(row.task_id, row.period), row)
  }
  return map
}

/** Anggota tugas bersama, per tugas. Tabel belum ada → kosong. */
async function ambilAnggota(taskIds: string[]): Promise<Map<string, AnggotaRow[]>> {
  const map = new Map<string, AnggotaRow[]>()
  if (taskIds.length === 0) return map
  const { data, error } = await createServerClient()
    .from('routine_task_members')
    .select('task_id, user_id, status, created_at')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })
  if (error) return map
  for (const r of (data ?? []) as AnggotaRow[]) {
    const daftar = map.get(r.task_id)
    if (daftar) daftar.push(r)
    else map.set(r.task_id, [r])
  }
  return map
}

async function ambilKeputusan(taskIds: string[], periods: Record<RoutineCadence, string>): Promise<Map<string, KeputusanRow[]>> {
  const map = new Map<string, KeputusanRow[]>()
  if (taskIds.length === 0) return map
  const { data, error } = await createServerClient()
    .from('routine_check_konfirmasi')
    .select('task_id, period, user_id, keputusan')
    .in('task_id', taskIds)
    .in('period', Object.values(periods))
  if (error) return map
  for (const r of (data ?? []) as KeputusanRow[]) {
    const k = kunciLaporan(r.task_id, r.period)
    const daftar = map.get(k)
    if (daftar) daftar.push(r)
    else map.set(k, [r])
  }
  return map
}

/**
 * Seluruh pengurus yang bisa disebut dengan @ di tugas rutin — mereka yang
 * memang punya halaman tugas rutin. Labelnya sekaligus dipakai menyebut
 * pemilik & rekan di kartu dan checklist.
 */
export async function getPengurusMention(): Promise<PengurusMention[]> {
  const { data } = await createServerClient().from('users').select('id, role, display_name')
  const users = ((data ?? []) as { id: string; role: UserRole; display_name: string }[]).filter(u => canViewTasks(u.role))
  const urutan = (role: UserRole) => {
    const i = JABATAN_ORDER.indexOf(role)
    return i === -1 ? JABATAN_ORDER.length : i
  }
  return labelPengurus(users.sort((a, b) => urutan(a.role) - urutan(b.role) || a.display_name.localeCompare(b.display_name)))
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

/** Ajakan tugas rutin bersama yang belum dijawab. */
export interface UndanganRutin {
  task: RoutineTask
  pengajak: string
  /** Rekan lain yang juga diajak, selain pemirsa. */
  rekanLain: string[]
  diundangAt: string
}

export interface RoutineChecklistData {
  groups: RoutineGroup[]
  undangan: UndanganRutin[]
  pengurus: PengurusMention[]
}

/**
 * Checklist lengkap seorang pengurus untuk periode berjalan, beserta ajakan
 * tugas bersama yang menunggu jawabannya.
 *
 * Tugas yang dibuatnya sendiri tampil lebih dulu dalam tiap irama, menurut
 * urutan yang ia atur; tugas bersama milik orang lain menyusul di bawahnya.
 */
export async function getRoutineChecklist(userId: string): Promise<RoutineChecklistData> {
  const supabase = createServerClient()

  const [{ data: milikData }, { data: ikutData }, pengurus] = await Promise.all([
    supabase
      .from('routine_tasks')
      .select('*')
      .eq('owner_id', userId)
      .order('cadence', { ascending: true })
      .order('order_num', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('routine_task_members')
      .select('task_id, status, created_at')
      .eq('user_id', userId)
      .in('status', ['menunggu', 'diterima']),
    getPengurusMention(),
  ])

  const milik = (milikData ?? []) as RoutineTask[]
  const keanggotaan = (ikutData ?? []) as { task_id: string; status: StatusAnggotaRutin; created_at: string }[]
  const idIkut = [...new Set(keanggotaan.map(k => k.task_id))]

  const { data: ikutTasks } = idIkut.length > 0
    ? await supabase.from('routine_tasks').select('*').in('id', idIkut).order('created_at', { ascending: true })
    : { data: [] }
  const tugasIkut = ((ikutTasks ?? []) as RoutineTask[]).filter(t => t.owner_id !== userId)
  const diterima = new Set(keanggotaan.filter(k => k.status === 'diterima').map(k => k.task_id))

  const tasks = [...milik, ...tugasIkut.filter(t => diterima.has(t.id))]
  const periods = periodeBerjalan()
  const semuaId = [...tasks.map(t => t.id), ...tugasIkut.map(t => t.id)]
  const [laporan, anggota, keputusan] = await Promise.all([
    ambilLaporan(tasks.map(t => t.id), periods),
    ambilAnggota([...new Set(semuaId)]),
    ambilKeputusan(tasks.map(t => t.id), periods),
  ])
  const label = new Map(pengurus.map(p => [p.userId, p.label]))
  const konteks: KonteksBersama = { anggota, keputusan, label, viewerId: userId }

  const undangan: UndanganRutin[] = tugasIkut
    .filter(t => keanggotaan.some(k => k.task_id === t.id && k.status === 'menunggu'))
    .map(t => ({
      task: t,
      pengajak: label.get(t.owner_id) ?? 'Pengurus',
      rekanLain: (anggota.get(t.id) ?? [])
        .filter(a => a.user_id !== userId && a.status !== 'ditolak')
        .map(a => label.get(a.user_id) ?? 'Pengurus'),
      diundangAt: keanggotaan.find(k => k.task_id === t.id)?.created_at ?? t.created_at,
    }))

  // Keempat kelompok selalu ditampilkan, termasuk saat kosong: halaman yang
  // hanya memunculkan kelompok berisi membuat orang mengira ia belum pernah
  // membuat tugas bulanan padahal ia hanya belum sampai ke sana.
  const groups = CADENCES.map(cadence => {
    const items = rakitState(tasks.filter(t => t.cadence === cadence), laporan, periods, konteks)
    return { cadence, period: periods[cadence], items, ...hitung(items) }
  })

  return { groups, undangan, pengurus }
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
 * Query tetap, tidak peduli berapa pengurus dan berapa tugas: daftar tugas,
 * anggota tugas bersama, laporan & keputusan periode ini, dan nama pemiliknya.
 * Versi yang mengulang query per pengurus akan terlihat wajar hari ini (tiga
 * belas kursi) dan menjadi beban begitu papan ini dibuka tiap hari.
 *
 * KENAPA PENGURUS TANPA TUGAS TETAP MUNCUL
 *
 * Papan ini dipakai untuk menilai apakah tiap amanah punya irama kerja yang
 * jelas. Pengurus yang belum menyusun satu pun tugas rutin adalah temuan yang
 * paling perlu dilihat kepala RQ — dan justru dialah yang akan hilang dari
 * papan kalau daftarnya dibangun dari tabel tugas saja.
 *
 * TUGAS BERSAMA muncul di setiap peserta yang sudah menerimanya — itu memang
 * amanah mereka berdua — tapi total papan dan daftar kendala menghitungnya
 * sekali saja.
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
  const ids = tasks.map(t => t.id)
  const [laporan, anggota, keputusan] = await Promise.all([
    ambilLaporan(ids, periods),
    ambilAnggota(ids),
    ambilKeputusan(ids, periods),
  ])
  const pengurusLabel = labelPengurus(users.filter(u => canViewTasks(u.role)))
  const konteks: KonteksBersama = {
    anggota, keputusan, viewerId: '',
    label: new Map(pengurusLabel.map(p => [p.userId, p.label])),
  }

  const perPemilik = new Map<string, RoutineTask[]>()
  const tambah = (userId: string, t: RoutineTask) => {
    const daftar = perPemilik.get(userId)
    if (daftar) daftar.push(t)
    else perPemilik.set(userId, [t])
  }
  for (const t of tasks) tambah(t.owner_id, t)
  for (const t of tasks) {
    for (const a of anggota.get(t.id) ?? []) if (a.status === 'diterima') tambah(a.user_id, t)
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
      const items = rakitState(perPemilik.get(u.id) ?? [], laporan, periods, konteks)
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
        // Tugas bersama tampil di tiap peserta; kendalanya cukup dicatat sekali, di pemiliknya.
        .filter(i => (i.bersama ? i.bersama.pemilik.userId === o.userId : true))
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

  // Total dihitung per tugas, bukan per baris papan: tugas bersama tampil di
  // dua pengurus tapi tetap satu pekerjaan.
  const unik = new Map<string, RoutineTaskState>()
  for (const i of owners.flatMap(o => o.items)) unik.set(i.task.id, i)

  return { periods, owners, kendala, ...hitung([...unik.values()]) }
}

