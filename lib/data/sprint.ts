import { createServerClient } from '@/lib/supabase/server'
import { getPetaDependensi, ringkasDependensi, type RingkasDependensi } from '@/lib/data/dependensi'
import { taskRange, today } from '@/lib/tasks/gantt'
import {
  POIN_BOBOT, akhirPeriode, faseSprint, menyentuhPeriode, ringkasSprint, terbawaBerapaBulan,
  type FaseSprint, type RingkasSprint,
} from '@/lib/tasks/sprint'
import type { SessionData, Task, TaskStatus, UserRole } from '@/types'

/**
 * Pembacaan sprint bulanan (drizzle/0072).
 *
 * Tugas milik sebuah jabatan = tugas yang pelaksananya memegang role itu —
 * pengertian "divisi" yang sama dengan papan kanban dan Gantt.
 */

export interface SprintBaris {
  id: string | null
  periode: string
  ditutupAt: string | null
  fase: FaseSprint
}

export interface GoalJabatan {
  goal: string
  disahkanAt: string | null
  hasil: 'tercapai' | 'sebagian' | 'tidak' | null
  catatanReview: string
  retroBaik: string
  retroHambatan: string
  retroUbah: string
}

export interface ItemSprint {
  id: string
  task: Pick<Task, 'id' | 'title' | 'status' | 'weight' | 'start_date' | 'due_date' | 'horizon'>
  poin: number
  tengahSprint: boolean
  /** Status yang dipakai laporan: potret bila sprint ditutup, status hidup bila belum. */
  status: TaskStatus
  terbawa: number
  lewatSprint: boolean
}

export type AlasanSaran = 'jatuh_bulan_ini' | 'terbawa' | 'lewat_tenggat' | 'lainnya'

export interface SaranTugas {
  task: Pick<Task, 'id' | 'title' | 'status' | 'weight' | 'start_date' | 'due_date' | 'horizon'>
  poin: number
  alasan: AlasanSaran
  terbawa: number
}

export interface SprintJabatanData {
  tabelAda: boolean
  sprint: SprintBaris
  goal: GoalJabatan | null
  items: ItemSprint[]
  ringkas: RingkasSprint
  saran: SaranTugas[]
  /** Poin selesai tiga sprint terakhir yang sudah ditutup — patokan kapasitas. */
  riwayat: { periode: string; komitmenPoin: number; selesaiPoin: number }[]
  dependensi: Record<string, RingkasDependensi>
}

const KOLOM_TUGAS = 'id, title, status, weight, start_date, due_date, horizon, created_at, assigned_to, deleted_at'
type BarisTugas = Pick<Task, 'id' | 'title' | 'status' | 'weight' | 'start_date' | 'due_date' | 'horizon' | 'created_at' | 'assigned_to' | 'deleted_at'>

const ringkasTugas = (t: BarisTugas): ItemSprint['task'] => ({
  id: t.id, title: t.title, status: t.status, weight: t.weight, start_date: t.start_date, due_date: t.due_date, horizon: t.horizon,
})

export async function getSprint(periode: string): Promise<{ sprint: SprintBaris; tabelAda: boolean }> {
  const { data, error } = await createServerClient()
    .from('sprints').select('id, periode, ditutup_at').eq('periode', periode).maybeSingle()
  const ditutupAt = (data?.ditutup_at as string | null | undefined) ?? null
  return {
    tabelAda: !error,
    sprint: { id: (data?.id as string | undefined) ?? null, periode, ditutupAt, fase: faseSprint(periode, today(), ditutupAt) },
  }
}

async function penggunaJabatan(jabatan: UserRole): Promise<string[]> {
  const { data } = await createServerClient().from('users').select('id').eq('role', jabatan)
  return ((data ?? []) as { id: string }[]).map(u => u.id)
}

/** Riwayat sprint sebelumnya untuk sekumpulan tugas: taskId → [{periode, selesai}]. */
async function riwayatTugas(taskIds: string[], sebelum: string): Promise<Map<string, { periode: string; selesai: boolean }[]>> {
  const peta = new Map<string, { periode: string; selesai: boolean }[]>()
  if (taskIds.length === 0) return peta
  const { data } = await createServerClient()
    .from('sprint_items')
    .select('task_id, status_saat_tutup, sprint:sprints!sprint_items_sprint_id_fkey(periode), tugas:tasks!sprint_items_task_id_fkey(status)')
    .in('task_id', taskIds)
  for (const r of (data ?? []) as unknown as {
    task_id: string; status_saat_tutup: TaskStatus | null; sprint: { periode: string } | null; tugas: { status: TaskStatus } | null
  }[]) {
    if (!r.sprint || r.sprint.periode >= sebelum) continue
    // Sprint lama yang belum ditutup tidak punya potret; status hidup tugasnya
    // dipakai sebagai gantinya.
    const selesai = (r.status_saat_tutup ?? r.tugas?.status) === 'done'
    const daftar = peta.get(r.task_id) ?? []
    daftar.push({ periode: r.sprint.periode, selesai })
    peta.set(r.task_id, daftar)
  }
  return peta
}

export async function getSprintJabatan(periode: string, jabatan: UserRole, session: SessionData): Promise<SprintJabatanData> {
  const supabase = createServerClient()
  const [{ sprint, tabelAda }, userIds] = await Promise.all([getSprint(periode), penggunaJabatan(jabatan)])
  const kosong: SprintJabatanData = {
    tabelAda, sprint, goal: null, items: [], ringkas: ringkasSprint([]), saran: [], riwayat: [], dependensi: {},
  }
  if (!tabelAda) return kosong

  const [goalRes, itemRes, tugasRes] = await Promise.all([
    sprint.id
      ? supabase.from('sprint_goals').select('*').eq('sprint_id', sprint.id).eq('jabatan', jabatan).maybeSingle()
      : Promise.resolve({ data: null }),
    sprint.id
      ? supabase.from('sprint_items').select(`id, poin, tengah_sprint, status_saat_tutup, tugas:tasks!sprint_items_task_id_fkey(${KOLOM_TUGAS})`)
          .eq('sprint_id', sprint.id).eq('jabatan', jabatan)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase.from('tasks').select(KOLOM_TUGAS).in('assigned_to', userIds).is('deleted_at', null).neq('status', 'done')
      : Promise.resolve({ data: [] }),
  ])

  const g = goalRes.data as Record<string, string | null> | null
  const goal: GoalJabatan | null = g ? {
    goal: g.goal ?? '', disahkanAt: g.disahkan_at ?? null, hasil: (g.hasil as GoalJabatan['hasil']) ?? null,
    catatanReview: g.catatan_review ?? '', retroBaik: g.retro_baik ?? '', retroHambatan: g.retro_hambatan ?? '', retroUbah: g.retro_ubah ?? '',
  } : null

  const itemRows = ((itemRes.data ?? []) as unknown as {
    id: string; poin: number; tengah_sprint: boolean; status_saat_tutup: TaskStatus | null; tugas: BarisTugas | null
  }[]).filter(r => r.tugas && !r.tugas.deleted_at)
  const terkomit = new Set(itemRows.map(r => r.tugas!.id))
  const terbuka = ((tugasRes.data ?? []) as BarisTugas[]).filter(t => !terkomit.has(t.id))

  const riwayat = await riwayatTugas([...terkomit, ...terbuka.map(t => t.id)], periode)
  const akhir = akhirPeriode(periode)

  const items: ItemSprint[] = itemRows.map(r => {
    const t = r.tugas!
    return {
      id: r.id, task: ringkasTugas(t), poin: r.poin, tengahSprint: r.tengah_sprint,
      status: sprint.ditutupAt ? (r.status_saat_tutup ?? t.status) : t.status,
      terbawa: terbawaBerapaBulan(periode, riwayat.get(t.id) ?? []),
      lewatSprint: !!t.due_date && t.due_date > akhir,
    }
  }).sort((a, b) => (a.task.due_date ?? '9999').localeCompare(b.task.due_date ?? '9999'))

  const URUT_ALASAN: Record<AlasanSaran, number> = { terbawa: 0, lewat_tenggat: 1, jatuh_bulan_ini: 2, lainnya: 3 }
  const saran: SaranTugas[] = terbuka.map(t => {
    const terbawa = terbawaBerapaBulan(periode, riwayat.get(t.id) ?? [])
    const range = taskRange(t as Task)
    const alasan: AlasanSaran = terbawa > 0 ? 'terbawa'
      : t.due_date && t.due_date < periode ? 'lewat_tenggat'
      : !range.inferred && menyentuhPeriode(range, periode) ? 'jatuh_bulan_ini'
      : 'lainnya'
    return { task: ringkasTugas(t), poin: POIN_BOBOT[t.weight] ?? 2, alasan, terbawa }
  }).sort((a, b) => URUT_ALASAN[a.alasan] - URUT_ALASAN[b.alasan] || (a.task.due_date ?? '9999').localeCompare(b.task.due_date ?? '9999'))

  // Kapasitas: tiga sprint TERTUTUP sebelum ini — angka dari potret, bukan
  // status hidup, supaya patokannya tidak ikut bergeser.
  const { data: lama } = await supabase
    .from('sprints').select('id, periode').lt('periode', periode).not('ditutup_at', 'is', null)
    .order('periode', { ascending: false }).limit(3)
  const riwayatKapasitas: SprintJabatanData['riwayat'] = []
  if (lama && lama.length > 0) {
    const { data: lamaItems } = await supabase
      .from('sprint_items').select('sprint_id, poin, status_saat_tutup').eq('jabatan', jabatan).in('sprint_id', lama.map(s => s.id))
    for (const s of lama as { id: string; periode: string }[]) {
      const isi = ((lamaItems ?? []) as { sprint_id: string; poin: number; status_saat_tutup: TaskStatus | null }[]).filter(i => i.sprint_id === s.id)
      const r = ringkasSprint(isi.map(i => ({ poin: i.poin, status: i.status_saat_tutup ?? 'todo', tengahSprint: false })))
      riwayatKapasitas.push({ periode: s.periode, komitmenPoin: r.komitmenPoin, selesaiPoin: r.selesaiPoin })
    }
  }

  const peta = await getPetaDependensi([...terkomit, ...terbuka.map(t => t.id)], session)

  return {
    tabelAda, sprint, goal, items,
    ringkas: ringkasSprint(items.map(i => ({ poin: i.poin, status: i.status, tengahSprint: i.tengahSprint }))),
    saran, riwayat: riwayatKapasitas, dependensi: ringkasDependensi(peta),
  }
}

export interface RingkasJabatan {
  jabatan: UserRole
  goal: string
  disahkan: boolean
  hasil: GoalJabatan['hasil']
  ringkas: RingkasSprint
  terbawa: number
  bentrok: number
}

/** Tabel ringkasan semua jabatan untuk Product Owner & pemantau papan. */
export async function getRingkasanSprint(periode: string, jabatanList: UserRole[]): Promise<{ sprint: SprintBaris; tabelAda: boolean; baris: RingkasJabatan[] }> {
  const { sprint, tabelAda } = await getSprint(periode)
  const kosongBaris = jabatanList.map(j => ({ jabatan: j, goal: '', disahkan: false, hasil: null, ringkas: ringkasSprint([]), terbawa: 0, bentrok: 0 }))
  if (!tabelAda || !sprint.id) return { sprint, tabelAda, baris: kosongBaris }

  const supabase = createServerClient()
  const [goalRes, itemRes] = await Promise.all([
    supabase.from('sprint_goals').select('jabatan, goal, disahkan_at, hasil').eq('sprint_id', sprint.id),
    supabase.from('sprint_items')
      .select('jabatan, poin, tengah_sprint, status_saat_tutup, tugas:tasks!sprint_items_task_id_fkey(id, status, deleted_at)')
      .eq('sprint_id', sprint.id),
  ])
  const goals = new Map(((goalRes.data ?? []) as { jabatan: UserRole; goal: string; disahkan_at: string | null; hasil: GoalJabatan['hasil'] }[]).map(g => [g.jabatan, g]))
  const items = ((itemRes.data ?? []) as unknown as {
    jabatan: UserRole; poin: number; tengah_sprint: boolean; status_saat_tutup: TaskStatus | null
    tugas: { id: string; status: TaskStatus; deleted_at: string | null } | null
  }[]).filter(i => i.tugas && !i.tugas.deleted_at)

  const ids = items.map(i => i.tugas!.id)
  const [riwayat, peta] = await Promise.all([
    riwayatTugas(ids, periode),
    getPetaDependensi(ids, null),
  ])
  const dep = ringkasDependensi(peta)

  return {
    sprint, tabelAda,
    baris: jabatanList.map(jabatan => {
      const milik = items.filter(i => i.jabatan === jabatan)
      const g = goals.get(jabatan)
      return {
        jabatan,
        goal: g?.goal ?? '',
        disahkan: !!g?.disahkan_at,
        hasil: g?.hasil ?? null,
        ringkas: ringkasSprint(milik.map(i => ({
          poin: i.poin, tengahSprint: i.tengah_sprint,
          status: sprint.ditutupAt ? (i.status_saat_tutup ?? i.tugas!.status) : i.tugas!.status,
        }))),
        terbawa: milik.filter(i => terbawaBerapaBulan(periode, riwayat.get(i.tugas!.id) ?? []) > 0).length,
        bentrok: milik.filter(i => dep[i.tugas!.id]?.bentrok).length,
      }
    }),
  }
}

/** Tugas yang disanggupi di sprint bulan tertentu — untuk penanda di Gantt & filter papan. */
export async function getTugasSprint(periode: string): Promise<Set<string>> {
  const { sprint, tabelAda } = await getSprint(periode)
  if (!tabelAda || !sprint.id) return new Set()
  const { data } = await createServerClient().from('sprint_items').select('task_id').eq('sprint_id', sprint.id)
  return new Set(((data ?? []) as { task_id: string }[]).map(r => r.task_id))
}

