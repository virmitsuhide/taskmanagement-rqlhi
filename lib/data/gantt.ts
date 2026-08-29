import { createServerClient } from '@/lib/supabase/server'
import { getBoardDivisions, canViewUserGantt, ROLE_LABELS } from '@/lib/auth/permissions'
import { taskRange, taskProgress, type DayRange, type Progress } from '@/lib/tasks/gantt'
import type { SessionData, Task, TaskSubtask, UserRole } from '@/types'

/**
 * Lapisan data untuk garis waktu (Gantt).
 *
 * Cakupan siapa-boleh-lihat-siapa TIDAK diputuskan di sini; ia dipinjam utuh
 * dari izin papan kanban lewat canViewUserGantt / getBoardDivisions. Modul ini
 * hanya mengambil baris dan menyusunnya jadi baris Gantt.
 */

/** Satu baris Gantt: tugas induk beserta rincian & rentang waktunya. */
export interface GanttRow {
  task: Task
  subtasks: TaskSubtask[]
  range: DayRange
  progress: Progress
}

/**
 * Pemegang jabatan yang Gantt-nya boleh dibuka pemirsa saat ini.
 *
 * SENGAJA TIDAK MEMBAWA display_name.
 *
 * Yang dipantau di Gantt adalah amanah, bukan orangnya: jabatan berpindah
 * tangan, dan Gantt "Koor SD" tetap berarti hal yang sama setelah pergantian
 * itu sementara Gantt atas nama seseorang jadi menyesatkan. Nama dijatuhkan di
 * lapisan ini, bukan disembunyikan di komponen, supaya tidak bisa bocor lagi
 * lewat tampilan baru yang kebetulan ikut memakai tipe ini.
 */
export interface GanttPerson {
  id: string
  role: UserRole
  /** Jabatannya — inilah yang muncul di layar. */
  label: string
  /** Jumlah tugas aktif — dipakai sebagai angka kecil di menu navigasi. */
  activeTasks: number
}

/**
 * Label satu pemegang jabatan.
 *
 * Hampir selalu cukup nama jabatannya saja. Yang jarang tapi mungkin: satu
 * amanah dipegang dua orang sekaligus — di situ dua baris menu yang bunyinya
 * sama persis tidak bisa dibedakan sama sekali, jadi inisial ditambahkan
 * seperlunya. Pembeda ini hanya muncul saat benar-benar ada duplikat.
 */
function ganttLabel(
  orang: { display_name: string; role: UserRole },
  jumlahPemegang: number,
): string {
  const jabatan = ROLE_LABELS[orang.role]
  if (jumlahPemegang < 2) return jabatan
  const inisial = orang.display_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return `${jabatan} (${inisial})`
}

const SELECT_TASK =
  '*, assignee:users!assigned_to(id, display_name, role), assigner:users!assigned_by(id, display_name, role)'

/** Status yang dianggap "masih berjalan" — dasar tampilan Gantt secara default. */
const OPEN_STATUSES = ['todo', 'in_progress', 'problem', 'submitted', 'returned']

/** Ambil rincian sebuah tugas, terurut sesuai order_num. */
export async function getSubtasks(taskId: string): Promise<TaskSubtask[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('task_subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })
  return (data ?? []) as TaskSubtask[]
}

interface GetGanttRowsOpts {
  /** Pemilik tugas yang ingin dilihat. */
  userId: string
  /** Ikut menampilkan tugas yang sudah selesai. */
  includeDone?: boolean
}

/**
 * Baris Gantt untuk satu orang.
 *
 * Rincian diambil dalam satu query terpisah (bukan join bersarang per tugas)
 * supaya jumlah round-trip tetap dua berapa pun banyaknya tugas.
 */
export async function getGanttRows({ userId, includeDone = false }: GetGanttRowsOpts): Promise<GanttRow[]> {
  const supabase = createServerClient()

  let q = supabase
    .from('tasks')
    .select(SELECT_TASK)
    .eq('assigned_to', userId)
    .is('deleted_at', null)
  if (!includeDone) q = q.in('status', OPEN_STATUSES)

  const { data: taskData } = await q
  const tasks = (taskData ?? []) as Task[]
  if (tasks.length === 0) return []

  const { data: subData } = await supabase
    .from('task_subtasks')
    .select('*')
    .in('task_id', tasks.map(t => t.id))
    .order('order_num', { ascending: true })
    .order('created_at', { ascending: true })
  const subtasks = (subData ?? []) as TaskSubtask[]

  const byTask = new Map<string, TaskSubtask[]>()
  for (const s of subtasks) {
    const list = byTask.get(s.task_id)
    if (list) list.push(s)
    else byTask.set(s.task_id, [s])
  }

  const rows: GanttRow[] = tasks.map(task => {
    const subs = byTask.get(task.id) ?? []
    return { task, subtasks: subs, range: taskRange(task, subs), progress: taskProgress(task, subs) }
  })

  // Urut kronologis: yang mulai duluan di atas. Gantt dibaca dari kiri atas ke
  // kanan bawah, jadi urutan prioritas (seperti di papan) justru membuat
  // batangnya tampak melompat-lompat.
  rows.sort((a, b) => a.range.start.localeCompare(b.range.start) || a.range.end.localeCompare(b.range.end))
  return rows
}

/**
 * Daftar orang yang garis waktunya boleh dibuka pemirsa ini.
 *
 * Diri sendiri tidak dimasukkan — pemanggilnya (menu navigasi) sudah menaruh
 * "Gantt Saya" sebagai entri pertama yang terpisah, dan mengulangnya di daftar
 * bawahan membuat orang mengira dirinya termasuk yang diawasi.
 */
export async function getGanttPeople(session: SessionData): Promise<GanttPerson[]> {
  const divisions = getBoardDivisions(session.role)
  if (divisions.length === 0) return []

  const supabase = createServerClient()
  const { data } = await supabase
    .from('users')
    .select('id, display_name, role')
    .in('role', divisions)
    .neq('id', session.userId)
    .order('role', { ascending: true })
    .order('display_name', { ascending: true })

  const people = (data ?? []) as { id: string; display_name: string; role: UserRole }[]
  if (people.length === 0) return []

  // Satu query hitungan untuk semua orang sekaligus: ambil kolom assigned_to
  // dari tugas aktif mereka lalu dihitung di memori. Alternatifnya satu query
  // count per orang — belasan round-trip hanya untuk angka kecil di menu.
  const { data: openTasks } = await supabase
    .from('tasks')
    .select('assigned_to')
    .in('assigned_to', people.map(p => p.id))
    .in('status', OPEN_STATUSES)
    .is('deleted_at', null)

  const counts = new Map<string, number>()
  for (const t of (openTasks ?? []) as { assigned_to: string }[]) {
    counts.set(t.assigned_to, (counts.get(t.assigned_to) ?? 0) + 1)
  }

  const pemegangPerJabatan = new Map<UserRole, number>()
  for (const p of people) pemegangPerJabatan.set(p.role, (pemegangPerJabatan.get(p.role) ?? 0) + 1)

  return people.map(p => ({
    id: p.id,
    role: p.role,
    label: ganttLabel(p, pemegangPerJabatan.get(p.role) ?? 1),
    activeTasks: counts.get(p.id) ?? 0,
  }))
}

/**
 * Ambil identitas orang yang Gantt-nya diminta, sekaligus menegakkan izinnya.
 *
 * Mengembalikan null kalau pemirsa tidak berhak — pemanggil yang memutuskan
 * apakah itu berarti redirect atau 404. Dipisahkan dari getGanttRows supaya
 * pemeriksaan izin tidak bisa terlewat hanya karena seseorang memanggil
 * pengambil baris secara langsung dengan userId dari query string.
 */
export async function resolveGanttTarget(
  session: SessionData,
  userId: string | undefined,
): Promise<{ id: string; role: UserRole; label: string } | null> {
  if (!userId || userId === session.userId) {
    return { id: session.userId, role: session.role, label: ROLE_LABELS[session.role] }
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('users')
    .select('id, display_name, role')
    .eq('id', userId)
    .maybeSingle()

  const target = data as { id: string; display_name: string; role: UserRole } | null
  if (!target) return null
  if (!canViewUserGantt(session.role, session.userId, target)) return null

  // Satu query hitungan pemegang jabatan yang sama — menentukan perlu tidaknya
  // pembeda inisial, dengan aturan yang sama seperti di getGanttPeople.
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', target.role)

  return { id: target.id, role: target.role, label: ganttLabel(target, count ?? 1) }
}
