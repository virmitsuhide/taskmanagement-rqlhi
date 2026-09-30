import { createServerClient } from '@/lib/supabase/server'
import { getTugasPerPoin } from '@/lib/data/papan-rapat'
import type { MeetingType, TaskStatus } from '@/types'

/**
 * Ringkasan notulen & tindak lanjut per rapat untuk daftar /rapat.
 *
 * Model yang dipakai sama dengan halaman detail (app/rapat/[id]):
 * - Notulen = baris `agenda_items` milik rapat; rapat tanpa poin = "belum diisi".
 * - Status Draf/Terbit = kolom `meetings.notulen_status` (migrasi 0108). Sebelum
 *   migrasi kolomnya tidak ada → `notulenStatus` null dan daftar memakai
 *   perilaku lama.
 * - Tindak lanjut = poin dengan `follow_up` terisi. Selesai bila `selesai_at`
 *   terisi (Papan Rapat) ATAU semua tugas turunannya berstatus 'done'.
 */
export interface MeetingRowStats {
  poin: number
  tindakLanjut: number
  tindakLanjutSelesai: number
  /** 'draf' | 'terbit' bila migrasi 0108 sudah jalan dan status dikirim; selain itu null. */
  notulenStatus?: 'draf' | 'terbit' | null
}

/** Status notulen dari baris `meetings` hasil select('*') — null bila kolomnya belum ada. */
export function bacaStatusNotulen(row: unknown): 'draf' | 'terbit' | null {
  const v = (row as { notulen_status?: unknown } | null)?.notulen_status
  return v === 'draf' || v === 'terbit' ? v : null
}

/**
 * @param statusPerRapat opsional: status notulen per id rapat (mis. dari
 *   `bacaStatusNotulen` atas baris daftar). Tanpa ini `notulenStatus` null.
 */
export async function getMeetingRowStats(
  meetingIds: string[],
  statusPerRapat?: Record<string, 'draf' | 'terbit' | null>,
): Promise<Record<string, MeetingRowStats>> {
  const out: Record<string, MeetingRowStats> = {}
  if (meetingIds.length === 0) return out
  for (const id of meetingIds) {
    out[id] = { poin: 0, tindakLanjut: 0, tindakLanjutSelesai: 0, notulenStatus: statusPerRapat?.[id] ?? null }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('agenda_items')
    .select('id, meeting_id, follow_up, selesai_at')
    .in('meeting_id', meetingIds)
  if (error) {
    console.error('[rapat-extra] gagal memuat ringkasan poin:', error)
    return out
  }
  const rows = (data ?? []) as { id: string; meeting_id: string; follow_up: string | null; selesai_at: string | null }[]
  const tl = rows.filter(r => r.follow_up)
  const tugasPer = await getTugasPerPoin(tl.filter(r => !r.selesai_at).map(r => r.id))

  for (const r of rows) {
    const s = out[r.meeting_id]
    if (!s) continue
    s.poin++
    if (!r.follow_up) continue
    s.tindakLanjut++
    const tugas = tugasPer.get(r.id) ?? []
    if (r.selesai_at || (tugas.length > 0 && tugas.every(t => t.status === 'done'))) s.tindakLanjutSelesai++
  }
  return out
}

export interface OpenFollowUp {
  taskId: string
  title: string
  status: TaskStatus
  dueDate: string | null
  owner: string | null
  meeting: { id: string; subject: string; date: string; type: MeetingType }
}

/**
 * Tugas tindak lanjut rapat yang masih terbuka (status ≠ done, belum dihapus,
 * poinnya belum ditandai selesai di Papan Rapat) dari rapat yang boleh dilihat
 * — tenggat terdekat dulu, tanpa tenggat di akhir.
 *
 * Hanya poin yang sudah "Jadikan tugas": poin tindak lanjut tanpa tugas tidak
 * punya PIC maupun tenggat sehingga tidak ikut di sini.
 */
export async function getOpenFollowUps(
  viewableTypes: MeetingType[],
  limit = 5,
): Promise<{ items: OpenFollowUp[]; total: number }> {
  if (viewableTypes.length === 0) return { items: [], total: 0 }
  const supabase = createServerClient()
  const { data, count, error } = await supabase
    .from('tasks')
    .select(
      'id, title, status, due_date,' +
      ' assignee:users!assigned_to(display_name),' +
      ' rapat:meetings!source_meeting_id!inner(id, subject, date, type, deleted_at),' +
      ' poin:agenda_items!source_agenda_id!inner(selesai_at)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .neq('status', 'done')
    .in('rapat.type', viewableTypes)
    .is('rapat.deleted_at', null)
    .is('poin.selesai_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[rapat-extra] gagal memuat tindak lanjut terbuka:', error)
    return { items: [], total: 0 }
  }
  const rows = (data ?? []) as unknown as {
    id: string; title: string; status: TaskStatus; due_date: string | null
    assignee: { display_name: string } | null
    rapat: { id: string; subject: string; date: string; type: MeetingType }
  }[]
  return {
    total: count ?? rows.length,
    items: rows.map(r => ({
      taskId: r.id,
      title: r.title,
      status: r.status,
      dueDate: r.due_date,
      owner: r.assignee?.display_name ?? null,
      meeting: { id: r.rapat.id, subject: r.rapat.subject, date: r.rapat.date, type: r.rapat.type },
    })),
  }
}
