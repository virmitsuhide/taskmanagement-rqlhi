'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditTask, canManageSubtasks, canViewTasks, ROLE_LABELS } from '@/lib/auth/permissions'
import { membentukLingkaran, usulanGeser } from '@/lib/tasks/dependensi'
import { today } from '@/lib/tasks/gantt'
import type { TaskStatus, UserRole } from '@/types'

type Result = { error?: string; success?: boolean }

interface BarisTugas {
  id: string
  title: string
  status: TaskStatus
  start_date: string | null
  due_date: string | null
  assigned_to: string | null
  assigned_by: string | null
  deleted_at: string | null
  assignee: { role: UserRole } | null
}

const KOLOM = 'id, title, status, start_date, due_date, assigned_to, assigned_by, deleted_at, assignee:users!assigned_to(role)'

async function ambilTugas(id: string): Promise<BarisTugas | null> {
  const { data } = await createServerClient().from('tasks').select(KOLOM).eq('id', id).maybeSingle()
  return (data as unknown as BarisTugas | null) ?? null
}

function labelTugas(t: BarisTugas): string {
  return t.assignee ? `"${t.title}" (${ROLE_LABELS[t.assignee.role]})` : `"${t.title}"`
}

function segarkan(...taskIds: string[]) {
  revalidatePath('/tasks')
  revalidatePath('/tasks/board')
  revalidatePath('/tasks/gantt')
  for (const id of taskIds) revalidatePath(`/tasks/${id}`)
}

/**
 * Tandai bahwa `taskId` menunggu `dependsOnId`.
 *
 * Yang boleh menambahkannya adalah yang boleh merinci tugas yang MENUNGGU —
 * menyatakan "saya baru bisa mulai setelah itu" adalah bagian dari menyusun
 * rencana tugas sendiri. Pemegang tugas yang ditunggu tidak dimintai izin,
 * tapi diberi tahu lewat riwayat tugasnya (lihat drizzle/0071).
 */
export async function tambahDependensiAction(taskId: string, dependsOnId: string): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!taskId || !dependsOnId) return { error: 'Tugas tidak dikenali.' }
  if (taskId === dependsOnId) return { error: 'Tugas tidak bisa menunggu dirinya sendiri.' }

  const [menunggu, ditunggu] = await Promise.all([ambilTugas(taskId), ambilTugas(dependsOnId)])
  if (!menunggu || menunggu.deleted_at) return { error: 'Tugas tidak ditemukan.' }
  if (!ditunggu || ditunggu.deleted_at) return { error: 'Tugas yang ditunggu tidak ditemukan.' }
  if (!canManageSubtasks(session.role, menunggu.assigned_to === session.userId, menunggu.assigned_by === session.userId)) {
    return { error: 'Hanya pelaksana, pemberi tugas, atau Kepala RQ yang bisa mengatur tugas ini.' }
  }
  if (ditunggu.status === 'done') return { error: 'Tugas itu sudah selesai — tidak ada yang perlu ditunggu.' }

  const supabase = createServerClient()
  const { data: sisi, error: galatBaca } = await supabase.from('task_dependencies').select('task_id, depends_on_id')
  if (galatBaca) return { error: 'Fitur dependensi belum aktif — jalankan migrasi 0071 di Supabase.' }
  const semua = (sisi ?? []) as { task_id: string; depends_on_id: string }[]
  if (semua.some(s => s.task_id === taskId && s.depends_on_id === dependsOnId)) {
    return { error: 'Tugas ini sudah tercatat menunggu tugas tersebut.' }
  }
  if (membentukLingkaran(semua, taskId, dependsOnId)) {
    return { error: `${labelTugas(ditunggu)} sendiri (secara berantai) sedang menunggu tugas ini — keduanya akan saling menunggu selamanya.` }
  }

  const { error } = await supabase.from('task_dependencies').insert({
    task_id: taskId, depends_on_id: dependsOnId, created_by: session.userId,
  })
  if (error) return { error: `Gagal menyimpan: ${error.message}` }

  // Ditulis di riwayat tugas yang DITUNGGU: dari sanalah pemegangnya diberi
  // tahu bahwa ada pekerjaan lain yang tertahan oleh tugasnya.
  await supabase.from('task_history').insert({
    task_id: dependsOnId,
    changed_by: session.userId,
    old_status: ditunggu.status,
    new_status: ditunggu.status,
    action: 'dependency_added',
    notes: `Ditunggu oleh tugas ${labelTugas(menunggu)}`,
  })

  segarkan(taskId, dependsOnId)
  return { success: true }
}

export async function hapusDependensiAction(dependensiId: string): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: dep } = await supabase
    .from('task_dependencies').select('id, task_id, depends_on_id').eq('id', dependensiId).maybeSingle()
  if (!dep) return { error: 'Relasi tidak ditemukan.' }

  const [menunggu, ditunggu] = await Promise.all([ambilTugas(dep.task_id), ambilTugas(dep.depends_on_id)])
  if (!menunggu) return { error: 'Tugas tidak ditemukan.' }
  if (!canManageSubtasks(session.role, menunggu.assigned_to === session.userId, menunggu.assigned_by === session.userId)) {
    return { error: 'Hanya pelaksana, pemberi tugas, atau Kepala RQ yang bisa mengatur tugas ini.' }
  }

  const { error } = await supabase.from('task_dependencies').delete().eq('id', dependensiId)
  if (error) return { error: `Gagal menghapus: ${error.message}` }

  if (ditunggu && !ditunggu.deleted_at) {
    await supabase.from('task_history').insert({
      task_id: ditunggu.id,
      changed_by: session.userId,
      old_status: ditunggu.status,
      new_status: ditunggu.status,
      action: 'dependency_removed',
      notes: `Tidak lagi ditunggu oleh tugas ${labelTugas(menunggu)}`,
    })
  }

  segarkan(dep.task_id, dep.depends_on_id)
  return { success: true }
}

export interface KandidatDependensi {
  id: string
  title: string
  status: TaskStatus
  due_date: string | null
  jabatan: UserRole | null
}

/**
 * Cari tugas yang bisa ditunggu — seluruh tugas aktif RQ, bukan hanya papan
 * yang boleh dilihat pemirsa. Pekerjaan yang ditunggu seringkali milik
 * jabatan lain di luar papan itu, dan RQ memutuskan judul serta jabatannya
 * boleh terlihat oleh yang menunggu. Yang dikirim hanya judul, jabatan,
 * status, dan tenggat.
 */
export async function cariTugasDitungguAction(taskId: string, kueri: string): Promise<KandidatDependensi[]> {
  const session = await getSession()
  if (!session || !canViewTasks(session.role)) return []
  const q = kueri.trim()
  if (q.length < 2) return []

  const { data } = await createServerClient()
    .from('tasks')
    .select('id, title, status, due_date, assignee:users!assigned_to(role)')
    .is('deleted_at', null)
    .neq('status', 'done')
    .neq('id', taskId)
    .ilike('title', `%${q.replace(/[%_]/g, '')}%`)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)

  return ((data ?? []) as unknown as (Omit<KandidatDependensi, 'jabatan'> & { assignee: { role: UserRole } | null })[])
    .map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, jabatan: t.assignee?.role ?? null }))
}

/**
 * Geser jadwal tugas yang menunggu ke sehari setelah penghambatnya selesai.
 *
 * Mengubah tanggal = menyunting tugas, jadi izinnya izin sunting — lebih
 * sempit dari izin menambah relasi. Pelaksana tugas delegasi bisa menyatakan
 * ia menunggu sesuatu, tapi tanggal tugas delegasi hanya boleh diubah Kepala
 * RQ (lihat canEditTask: pemberi tugas pun tidak menyunting sepihak).
 */
export async function geserJadwalSetelahDitungguAction(dependensiId: string): Promise<Result> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: dep } = await supabase
    .from('task_dependencies').select('task_id, depends_on_id').eq('id', dependensiId).maybeSingle()
  if (!dep) return { error: 'Relasi tidak ditemukan.' }

  const [menunggu, ditunggu] = await Promise.all([ambilTugas(dep.task_id), ambilTugas(dep.depends_on_id)])
  if (!menunggu || menunggu.deleted_at || !ditunggu) return { error: 'Tugas tidak ditemukan.' }
  if (!canEditTask(session.role, menunggu.assigned_to === session.userId, menunggu.assigned_by === session.userId)) {
    return { error: 'Tanggal tugas delegasi hanya bisa digeser Kepala RQ.' }
  }
  if (!ditunggu.due_date) return { error: 'Tugas yang ditunggu belum punya tenggat, jadi belum ada patokan untuk menggeser.' }

  const baru = usulanGeser(menunggu, ditunggu.due_date, today())
  const { error } = await supabase.from('tasks').update(baru).eq('id', menunggu.id)
  if (error) return { error: `Gagal menggeser jadwal: ${error.message}` }

  await supabase.from('task_history').insert({
    task_id: menunggu.id,
    changed_by: session.userId,
    old_status: menunggu.status,
    new_status: menunggu.status,
    action: 'edited',
    notes: `Jadwal digeser mengikuti tugas yang ditunggu ${labelTugas(ditunggu)}: mulai ${baru.start_date}${baru.due_date ? `, tenggat ${baru.due_date}` : ''}`,
  })

  segarkan(menunggu.id, ditunggu.id)
  return { success: true }
}
