'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditSprintJabatan, getSprintJabatan, isProductOwner, ROLE_LABELS } from '@/lib/auth/permissions'
import { POIN_BOBOT, bolehDitutup, faseSprint, geserPeriode, masukTengahSprint, periodeDari } from '@/lib/tasks/sprint'
import { today } from '@/lib/tasks/gantt'
import type { SessionData, TaskStatus, TaskWeight, UserRole } from '@/types'

type Result = { error?: string; success?: boolean }

const PESAN_MIGRASI = 'Fitur sprint belum aktif — jalankan migrasi 0072 di Supabase.'

function segarkan() {
  revalidatePath('/tasks/sprint')
  revalidatePath('/tasks/gantt')
  revalidatePath('/tasks/board')
}

function periodeSah(periode: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(periode)
}

/**
 * Pintu bersama: sesi, izin jabatan, dan sprint yang masih bisa diubah.
 * Baris sprint dibuat saat pertama kali dibutuhkan — tidak ada penjadwal yang
 * harus membukanya tiap awal bulan.
 */
async function bukaSprint(periode: string, jabatan: UserRole): Promise<{ session: SessionData; sprintId: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!periodeSah(periode)) return { error: 'Periode sprint tidak dikenali.' }
  if (!getSprintJabatan(session.role).includes(jabatan) || !canEditSprintJabatan(session.role, jabatan)) {
    return { error: `Hanya ${ROLE_LABELS[jabatan]} dan Kepala RQ yang bisa mengubah sprint jabatan ini.` }
  }
  // Sprint bulan lalu yang belum ditutup masih boleh dirapikan; yang lebih
  // lama dari itu sudah menjadi sejarah.
  if (periode < geserPeriode(periodeDari(today()), -1)) return { error: 'Sprint yang sudah lewat lebih dari sebulan tidak bisa diubah.' }
  if (periode > geserPeriode(periodeDari(today()), 1)) return { error: 'Perencanaan paling jauh untuk bulan depan.' }

  const supabase = createServerClient()
  const { data: ada, error } = await supabase.from('sprints').select('id, ditutup_at').eq('periode', periode).maybeSingle()
  if (error) return { error: PESAN_MIGRASI }
  if (ada?.ditutup_at) return { error: 'Sprint ini sudah ditutup Kepala RQ.' }
  if (ada) return { session, sprintId: ada.id as string }

  const { data: baru, error: galat } = await supabase
    .from('sprints').upsert({ periode }, { onConflict: 'periode' }).select('id').single()
  if (galat || !baru) return { error: `Gagal membuka sprint: ${galat?.message ?? ''}` }
  return { session, sprintId: baru.id as string }
}

async function simpanGoalBaris(sprintId: string, jabatan: UserRole, userId: string, isi: Record<string, unknown>) {
  return createServerClient()
    .from('sprint_goals')
    .upsert({ sprint_id: sprintId, jabatan, ...isi, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'sprint_id,jabatan' })
}

/** Tulis Sprint Goal. Mengubah isinya melepas pengesahan — yang disahkan harus yang tertulis. */
export async function simpanSprintGoalAction(periode: string, jabatan: UserRole, goal: string): Promise<Result> {
  const buka = await bukaSprint(periode, jabatan)
  if ('error' in buka) return buka
  const teks = goal.trim()
  if (teks.length > 1000) return { error: 'Sprint Goal terlalu panjang — cukup 1–3 kalimat.' }

  const { data: lama } = await createServerClient()
    .from('sprint_goals').select('goal, disahkan_at').eq('sprint_id', buka.sprintId).eq('jabatan', jabatan).maybeSingle()
  const berubah = (lama?.goal ?? '') !== teks
  const isi: Record<string, unknown> = { goal: teks }
  if (berubah && lama?.disahkan_at) { isi.disahkan_at = null; isi.disahkan_by = null }

  const { error } = await simpanGoalBaris(buka.sprintId, jabatan, buka.session.userId, isi)
  if (error) return { error: `Gagal menyimpan: ${error.message}` }
  segarkan()
  return { success: true }
}

/** Pengesahan Sprint Goal oleh Product Owner (Kepala RQ). */
export async function sahkanSprintGoalAction(periode: string, jabatan: UserRole, sahkan: boolean): Promise<Result> {
  const session = await getSession()
  if (!session || !isProductOwner(session.role)) return { error: 'Hanya Kepala RQ yang mengesahkan Sprint Goal.' }
  const buka = await bukaSprint(periode, jabatan)
  if ('error' in buka) return buka

  const { data: lama } = await createServerClient()
    .from('sprint_goals').select('goal').eq('sprint_id', buka.sprintId).eq('jabatan', jabatan).maybeSingle()
  if (sahkan && !(lama?.goal ?? '').trim()) return { error: 'Goal jabatan ini masih kosong.' }

  const { error } = await simpanGoalBaris(buka.sprintId, jabatan, session.userId, sahkan
    ? { disahkan_at: new Date().toISOString(), disahkan_by: session.userId }
    : { disahkan_at: null, disahkan_by: null })
  if (error) return { error: `Gagal menyimpan: ${error.message}` }
  segarkan()
  return { success: true }
}

/** Sanggupi sebuah tugas di sprint jabatan pelaksananya. */
export async function sanggupiTugasAction(periode: string, taskId: string): Promise<Result> {
  const supabase = createServerClient()
  const { data: tugas } = await supabase
    .from('tasks').select('id, status, weight, deleted_at, assignee:users!assigned_to(role)').eq('id', taskId).maybeSingle()
  const t = tugas as unknown as { id: string; status: TaskStatus; weight: TaskWeight; deleted_at: string | null; assignee: { role: UserRole } | null } | null
  if (!t || t.deleted_at || !t.assignee) return { error: 'Tugas tidak ditemukan.' }
  if (t.status === 'done') return { error: 'Tugas ini sudah selesai.' }

  const jabatan = t.assignee.role
  const buka = await bukaSprint(periode, jabatan)
  if ('error' in buka) return buka

  const hariIni = today()
  const { error } = await supabase.from('sprint_items').insert({
    sprint_id: buka.sprintId, task_id: t.id, jabatan,
    poin: POIN_BOBOT[t.weight] ?? 2,
    tengah_sprint: faseSprint(periode, hariIni, null) !== 'perencanaan' && masukTengahSprint(periode, hariIni),
    created_by: buka.session.userId,
  })
  if (error) {
    return { error: error.code === '23505' ? 'Tugas ini sudah disanggupi di sprint ini.' : `Gagal menyimpan: ${error.message}` }
  }
  segarkan()
  return { success: true }
}

/** Lepas komitmen — tugasnya kembali ke backlog. */
export async function lepasTugasSprintAction(itemId: string): Promise<Result> {
  const supabase = createServerClient()
  const { data: item } = await supabase
    .from('sprint_items').select('id, jabatan, sprint:sprints!sprint_items_sprint_id_fkey(periode)').eq('id', itemId).maybeSingle()
  const i = item as unknown as { id: string; jabatan: UserRole; sprint: { periode: string } | null } | null
  if (!i?.sprint) return { error: 'Komitmen tidak ditemukan.' }

  const buka = await bukaSprint(i.sprint.periode, i.jabatan)
  if ('error' in buka) return buka
  const { error } = await supabase.from('sprint_items').delete().eq('id', itemId)
  if (error) return { error: `Gagal melepas: ${error.message}` }
  segarkan()
  return { success: true }
}

export interface IsiReview {
  hasil: 'tercapai' | 'sebagian' | 'tidak' | ''
  catatanReview: string
  retroBaik: string
  retroHambatan: string
  retroUbah: string
}

/** Review & retrospektif jabatan. Tetap bisa diisi sampai sprint ditutup. */
export async function simpanReviewSprintAction(periode: string, jabatan: UserRole, isi: IsiReview): Promise<Result> {
  const buka = await bukaSprint(periode, jabatan)
  if ('error' in buka) return buka
  if (isi.hasil && !['tercapai', 'sebagian', 'tidak'].includes(isi.hasil)) return { error: 'Hasil goal tidak dikenali.' }

  const potong = (s: string) => s.trim().slice(0, 2000)
  const { error } = await simpanGoalBaris(buka.sprintId, jabatan, buka.session.userId, {
    hasil: isi.hasil || null,
    catatan_review: potong(isi.catatanReview),
    retro_baik: potong(isi.retroBaik),
    retro_hambatan: potong(isi.retroHambatan),
    retro_ubah: potong(isi.retroUbah),
  })
  if (error) return { error: `Gagal menyimpan: ${error.message}` }
  segarkan()
  return { success: true }
}

/**
 * Tutup sprint: potret status setiap tugas yang disanggupi, lalu kunci.
 * Hanya Product Owner, dan hanya di tiga hari terakhir bulan atau sesudahnya.
 */
export async function tutupSprintAction(periode: string): Promise<Result> {
  const session = await getSession()
  if (!session || !isProductOwner(session.role)) return { error: 'Hanya Kepala RQ yang menutup sprint.' }
  if (!periodeSah(periode)) return { error: 'Periode sprint tidak dikenali.' }

  const supabase = createServerClient()
  const { data: sprint, error: galat } = await supabase.from('sprints').select('id, ditutup_at').eq('periode', periode).maybeSingle()
  if (galat) return { error: PESAN_MIGRASI }
  if (!sprint) return { error: 'Belum ada yang disanggupi di sprint ini.' }
  if (!bolehDitutup(periode, today(), sprint.ditutup_at as string | null)) {
    return { error: sprint.ditutup_at ? 'Sprint ini sudah ditutup.' : 'Sprint baru bisa ditutup di tiga hari terakhir bulannya.' }
  }

  const { data: items } = await supabase
    .from('sprint_items').select('id, tugas:tasks!sprint_items_task_id_fkey(status)').eq('sprint_id', sprint.id)
  for (const it of (items ?? []) as unknown as { id: string; tugas: { status: TaskStatus } | null }[]) {
    const { error } = await supabase.from('sprint_items').update({ status_saat_tutup: it.tugas?.status ?? 'todo' }).eq('id', it.id)
    if (error) return { error: `Gagal memotret komitmen: ${error.message}` }
  }

  const { error } = await supabase.from('sprints')
    .update({ ditutup_at: new Date().toISOString(), ditutup_by: session.userId }).eq('id', sprint.id)
  if (error) return { error: `Gagal menutup sprint: ${error.message}` }
  segarkan()
  return { success: true }
}
