'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateMeeting, canEditMeeting, canDeleteMeeting } from '@/lib/auth/permissions'
import type { MeetingType, AgendaTag } from '@/types'

export async function createMeetingAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const type = formData.get('type') as MeetingType
  if (!canCreateMeeting(session.role, type)) {
    return { error: 'Anda tidak memiliki izin untuk membuat rapat ini.' }
  }

  const supabase = createServerClient()

  const participantsRaw = formData.get('participants') as string
  const participants = participantsRaw
    ? participantsRaw.split('\n').map(p => p.trim()).filter(Boolean)
    : []

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      type,
      subject: formData.get('subject') as string,
      date: formData.get('date') as string,
      start_time: (formData.get('start_time') as string) || null,
      end_time: (formData.get('end_time') as string) || null,
      location: (formData.get('location') as string) || null,
      mc: (formData.get('mc') as string) || null,
      notulis: (formData.get('notulis') as string) || null,
      participants,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (error || !meeting) return { error: 'Gagal membuat rapat.' }

  // Insert agenda items
  const agendaCount = parseInt(formData.get('agenda_count') as string) || 0
  const agendaItems = []
  for (let i = 0; i < agendaCount; i++) {
    const discussion = formData.get(`agenda_${i}_discussion`) as string
    const tag = formData.get(`agenda_${i}_tag`) as AgendaTag
    const followUp = formData.get(`agenda_${i}_follow_up`) as string
    if (discussion && tag) {
      agendaItems.push({
        meeting_id: meeting.id,
        order_num: i + 1,
        tag,
        discussion,
        follow_up: followUp || null,
      })
    }
  }

  if (agendaItems.length > 0) {
    await supabase.from('agenda_items').insert(agendaItems)
  }

  revalidatePath('/rapat')
  redirect(`/rapat/${meeting.id}`)
}

export async function updateMeetingAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const meetingId = formData.get('meeting_id') as string
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('meetings')
    .select('type')
    .eq('id', meetingId)
    .single()

  if (!existing) return { error: 'Rapat tidak ditemukan.' }
  if (!canEditMeeting(session.role, existing.type)) {
    return { error: 'Anda tidak memiliki izin untuk mengedit rapat ini.' }
  }

  const participantsRaw = formData.get('participants') as string
  const participants = participantsRaw
    ? participantsRaw.split('\n').map(p => p.trim()).filter(Boolean)
    : []

  const { error } = await supabase
    .from('meetings')
    .update({
      subject: formData.get('subject') as string,
      date: formData.get('date') as string,
      start_time: (formData.get('start_time') as string) || null,
      end_time: (formData.get('end_time') as string) || null,
      location: (formData.get('location') as string) || null,
      mc: (formData.get('mc') as string) || null,
      notulis: (formData.get('notulis') as string) || null,
      participants,
    })
    .eq('id', meetingId)

  if (error) return { error: 'Gagal memperbarui rapat.' }

  // Rebuild agenda items
  await supabase.from('agenda_items').delete().eq('meeting_id', meetingId)

  const agendaCount = parseInt(formData.get('agenda_count') as string) || 0
  const agendaItems = []
  for (let i = 0; i < agendaCount; i++) {
    const discussion = formData.get(`agenda_${i}_discussion`) as string
    const tag = formData.get(`agenda_${i}_tag`) as AgendaTag
    const followUp = formData.get(`agenda_${i}_follow_up`) as string
    if (discussion && tag) {
      agendaItems.push({
        meeting_id: meetingId,
        order_num: i + 1,
        tag,
        discussion,
        follow_up: followUp || null,
      })
    }
  }

  if (agendaItems.length > 0) {
    await supabase.from('agenda_items').insert(agendaItems)
  }

  revalidatePath('/rapat')
  revalidatePath(`/rapat/${meetingId}`)
  redirect(`/rapat/${meetingId}`)
}

/**
 * Menghapus baris rapat, dengan pesan yang menyebut penghambatnya kalau ditolak.
 *
 * Sebuah tugas menyimpan DUA tautan ke notulen asalnya — `source_meeting_id` ke
 * rapatnya, dan `source_agenda_id` ke poin agendanya. Keduanya harus diperiksa:
 * poin agenda ikut terhapus bersama rapat (cascade), jadi tugas yang hanya
 * menunjuk agenda pun tetap menahan penghapusan, dengan kode galat 23503 yang
 * sama persis. Memeriksa satu kolom saja membuat pesan ini menunjuk penahan yang
 * keliru — atau, lebih buruk, mengaku tidak menemukan penahan apa pun.
 *
 * Tugas yang sudah dihapus lewat UI juga tetap menahan, sebab penghapusan tugas
 * bersifat lunak — barisnya masih ada, hanya diberi `deleted_at`. Itu bagian
 * yang paling membingungkan: daftar tugas terlihat bersih, tapi rapatnya tetap
 * menolak dihapus.
 *
 * Setelah migrasi 0031 & 0032 kedua tautan itu dilepas otomatis, jadi cabang ini
 * semestinya tidak lagi terpicu. Ia dipertahankan supaya penolakan dari arah
 * lain — tabel baru yang kelak menunjuk rapat — tetap terbaca manusiawi,
 * bukan muncul sebagai "Gagal menghapus rapat" tanpa keterangan.
 */
async function deleteMeetingRow(
  supabase: ReturnType<typeof createServerClient>,
  meetingId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
  if (!error) return {}
  if (error.code !== '23503') return { error: 'Gagal menghapus rapat.' }

  const { data: agenda } = await supabase
    .from('agenda_items')
    .select('id')
    .eq('meeting_id', meetingId)
  const agendaIds = (agenda ?? []).map(a => a.id)

  const [viaMeeting, viaAgenda] = await Promise.all([
    supabase.from('tasks').select('id, title, deleted_at').eq('source_meeting_id', meetingId),
    agendaIds.length
      ? supabase.from('tasks').select('id, title, deleted_at').in('source_agenda_id', agendaIds)
      : Promise.resolve({ data: [] as { id: string; title: string; deleted_at: string | null }[] }),
  ])

  // Satu tugas bisa muncul lewat kedua jalur sekaligus — dihitung sekali saja.
  const blockers = new Map<string, { title: string; deleted_at: string | null }>()
  for (const t of [...(viaMeeting.data ?? []), ...(viaAgenda.data ?? [])]) {
    blockers.set(t.id, { title: t.title, deleted_at: t.deleted_at })
  }

  if (blockers.size === 0) {
    return { error: 'Rapat ini masih dirujuk data lain, jadi belum bisa dihapus.' }
  }
  const names = [...blockers.values()].map(
    t => `"${t.title}"${t.deleted_at ? ' (sudah dihapus dari daftar)' : ''}`,
  )
  return {
    error: `Belum bisa dihapus: rapat ini tercatat sebagai asal ${names.length} tugas — ${names.join(', ')}.`,
  }
}

export async function deleteMeetingAction(meetingId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('type')
    .eq('id', meetingId)
    .single()

  if (!meeting) return { error: 'Rapat tidak ditemukan.' }
  if (!canDeleteMeeting(session.role, meeting.type)) {
    return { error: 'Anda tidak memiliki izin untuk menghapus rapat ini.' }
  }

  const { error } = await deleteMeetingRow(supabase, meetingId)
  if (error) return { error }

  revalidatePath('/rapat')
  redirect('/rapat')
}

/** Hapus dari tabel /rapat tanpa redirect — dipakai tombol aksi di daftar. */
export async function deleteMeetingFromListAction(meetingId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('type')
    .eq('id', meetingId)
    .single()

  if (!meeting) return { error: 'Rapat tidak ditemukan.' }
  if (!canDeleteMeeting(session.role, meeting.type)) {
    return { error: 'Anda tidak memiliki izin untuk menghapus rapat ini.' }
  }

  const { error } = await deleteMeetingRow(supabase, meetingId)
  if (error) return { error }

  revalidatePath('/rapat')
  return { success: true }
}
