'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canEditMeeting } from '@/lib/auth/permissions'

/**
 * Status notulen Draf / Terbit (migrasi 0108). Yang boleh mengubah status sama
 * dengan yang boleh menyunting notulen (canEditMeeting). Status ini tidak
 * mengubah siapa yang boleh melihat notulen, dan tidak mengirim notifikasi.
 */
const MIGRASI = 'drizzle/0108_notulen_status_PASTE_TO_SUPABASE.sql'
const BELUM_MIGRASI = `Status notulen belum aktif. Jalankan migrasi ${MIGRASI} dulu.`

type Hasil = { error: string } | { success: true }

function kolomBelumAda(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === 'PGRST204' || error.code === '42703') &&
      error.message?.includes('notulen_'),
  )
}

async function ubahStatus(meetingId: string, status: 'draf' | 'terbit'): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, type, deleted_at')
    .eq('id', meetingId)
    .maybeSingle()
  if (!meeting || meeting.deleted_at) return { error: 'Rapat tidak ditemukan.' }
  if (!canEditMeeting(session.role, meeting.type)) {
    return { error: 'Anda tidak memiliki izin untuk mengubah status notulen rapat ini.' }
  }

  const perubahan =
    status === 'terbit'
      ? { notulen_status: 'terbit', notulen_terbit_at: new Date().toISOString(), notulen_terbit_by: session.userId }
      : { notulen_status: 'draf', notulen_terbit_at: null, notulen_terbit_by: null }

  try {
    const { error } = await supabase.from('meetings').update(perubahan).eq('id', meetingId)
    if (kolomBelumAda(error)) return { error: BELUM_MIGRASI }
    if (error) {
      console.error('[notulen-status] gagal mengubah status:', error)
      return { error: 'Gagal mengubah status notulen.' }
    }
  } catch (e) {
    console.error('[notulen-status] gagal mengubah status:', e)
    return { error: 'Gagal mengubah status notulen.' }
  }

  revalidatePath('/rapat')
  revalidatePath(`/rapat/${meetingId}`)
  return { success: true }
}

export async function terbitkanNotulen(meetingId: string): Promise<Hasil> {
  return ubahStatus(meetingId, 'terbit')
}

export async function kembalikanKeDraf(meetingId: string): Promise<Hasil> {
  return ubahStatus(meetingId, 'draf')
}
