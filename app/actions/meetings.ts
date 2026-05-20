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

  const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
  if (error) return { error: 'Gagal menghapus rapat.' }

  revalidatePath('/rapat')
  redirect('/rapat')
}
