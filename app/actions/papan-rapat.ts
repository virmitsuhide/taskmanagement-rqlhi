'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  canViewMeeting, canDecideRapatApproval, canIsiBiayaRapat, canKelolaPapanRapat,
} from '@/lib/auth/permissions'
import { sudahTuntas } from '@/lib/rapat/papan'
import type { AgendaTag, ApprovalStatus, MeetingType } from '@/types'

type Hasil = { error?: string; success?: true }

interface Poin {
  id: string
  tag: AgendaTag
  approval_status: ApprovalStatus | null
  butuh_biaya: boolean
  biaya: number | null
  selesai_at: string | null
  diarsipkan_at: string | null
  rapat: { id: string; type: MeetingType; deleted_at: string | null }
}

/** Ambil poin beserta rapatnya, dan pastikan penggunanya boleh membaca rapat itu. */
async function siapkan(agendaId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' } as const
  const supabase = createServerClient()
  const { data } = await supabase
    .from('agenda_items')
    .select('id, tag, approval_status, butuh_biaya, biaya, selesai_at, diarsipkan_at, rapat:meetings!inner(id, type, deleted_at)')
    .eq('id', agendaId)
    .maybeSingle()
  const poin = data as unknown as Poin | null
  if (!poin || poin.rapat.deleted_at || !canViewMeeting(session.role, poin.rapat.type)) {
    return { error: 'Poin rapat tidak ditemukan.' } as const
  }
  return { session, supabase, poin } as const
}

function segarkan(meetingId: string) {
  revalidatePath('/rapat/papan')
  revalidatePath(`/rapat/${meetingId}`)
}

/** Setujui / tolak poin Approval — Kepala RQ. 'menunggu' membatalkan keputusan. */
export async function putuskanApprovalAction(agendaId: string, status: ApprovalStatus): Promise<Hasil> {
  const s = await siapkan(agendaId)
  if ('error' in s) return { error: s.error }
  if (!canDecideRapatApproval(s.session.role)) return { error: 'Hanya Kepala RQ yang bisa memutuskan approval.' }
  if (s.poin.tag !== 'approval') return { error: 'Poin ini bukan approval.' }
  if (s.poin.diarsipkan_at) return { error: 'Poin sudah dikeluarkan dari papan. Kembalikan dulu ke papan.' }
  if (status === 'menunggu' && s.poin.biaya !== null) {
    return { error: 'Biaya sudah dicatat bendahara. Kosongkan biayanya dulu sebelum membatalkan keputusan.' }
  }

  const tetap = status === 'menunggu'
  const { error } = await s.supabase.from('agenda_items').update({
    approval_status: status,
    approval_by: tetap ? null : s.session.userId,
    approval_at: tetap ? null : new Date().toISOString(),
  }).eq('id', agendaId)
  if (error) return { error: 'Gagal menyimpan keputusan approval.' }
  segarkan(s.poin.rapat.id)
  return { success: true }
}

/** Nominal biaya untuk approval yang disetujui — bendahara. Nominal kosong menghapus catatan biaya. */
export async function simpanBiayaAction(agendaId: string, nominal: string, catatan: string): Promise<Hasil> {
  const s = await siapkan(agendaId)
  if ('error' in s) return { error: s.error }
  if (!canIsiBiayaRapat(s.session.role)) return { error: 'Hanya bendahara yang bisa mengisi biaya.' }
  if (s.poin.tag !== 'approval' || s.poin.approval_status !== 'disetujui') {
    return { error: 'Biaya hanya diisi untuk approval yang sudah disetujui.' }
  }

  // "Rp 1.500.000" → 1500000. Rupiah bulat, seperti modul keuangan.
  const angka = nominal.replace(/\D/g, '')
  const biaya = angka ? Number(angka) : null
  if (biaya !== null && (!Number.isSafeInteger(biaya) || biaya > 2_000_000_000)) {
    return { error: 'Nominal tidak valid.' }
  }

  const { error } = await s.supabase.from('agenda_items').update({
    biaya,
    biaya_catatan: biaya === null ? null : catatan.trim() || null,
    biaya_by: biaya === null ? null : s.session.userId,
    biaya_at: biaya === null ? null : new Date().toISOString(),
  }).eq('id', agendaId)
  if (error) return { error: 'Gagal menyimpan biaya.' }
  segarkan(s.poin.rapat.id)
  return { success: true }
}

/** Tandai diskusi lanjut selesai (atau buka lagi). */
export async function tandaiDiskusiSelesaiAction(agendaId: string, selesai: boolean): Promise<Hasil> {
  const s = await siapkan(agendaId)
  if ('error' in s) return { error: s.error }
  if (!canKelolaPapanRapat(s.session.role, s.poin.rapat.type)) return { error: 'Anda tidak bisa mengubah poin rapat ini.' }
  if (s.poin.tag !== 'perlu_diskusi') return { error: 'Poin ini bukan diskusi lanjut.' }
  if (!selesai && s.poin.diarsipkan_at) return { error: 'Kembalikan poin ke papan dulu sebelum membukanya lagi.' }

  const { error } = await s.supabase.from('agenda_items').update({
    selesai_at: selesai ? new Date().toISOString() : null,
    selesai_by: selesai ? s.session.userId : null,
  }).eq('id', agendaId)
  if (error) return { error: 'Gagal menyimpan status diskusi.' }
  segarkan(s.poin.rapat.id)
  return { success: true }
}

/**
 * Keluarkan poin tuntas dari papan aktif, atau kembalikan ke papan. Poin
 * notulennya tidak dihapus — hanya disembunyikan dari papan aktif, dan tetap
 * bisa dilihat di tampilan Arsip.
 */
export async function arsipkanPoinAction(agendaId: string, arsip: boolean): Promise<Hasil> {
  const s = await siapkan(agendaId)
  if ('error' in s) return { error: s.error }
  const { role } = s.session
  // Approval juga boleh dikeluarkan oleh bendahara setelah biayanya tercatat.
  const boleh = canKelolaPapanRapat(role, s.poin.rapat.type)
    || (s.poin.tag === 'approval' && (canDecideRapatApproval(role) || canIsiBiayaRapat(role)))
  if (!boleh) return { error: 'Anda tidak bisa mengubah poin rapat ini.' }

  if (arsip) {
    let tugas: { status: 'todo' | 'in_progress' | 'problem' | 'submitted' | 'done' | 'returned' }[] = []
    if (s.poin.tag === 'tindak_lanjut') {
      const { data } = await s.supabase.from('tasks').select('status')
        .eq('source_agenda_id', agendaId).is('deleted_at', null)
      tugas = (data ?? []) as typeof tugas
    }
    if (!sudahTuntas(s.poin, tugas)) return { error: 'Poin ini belum tuntas, jadi belum bisa dikeluarkan dari papan.' }
  }

  const { error } = await s.supabase.from('agenda_items').update({
    diarsipkan_at: arsip ? new Date().toISOString() : null,
    diarsipkan_by: arsip ? s.session.userId : null,
  }).eq('id', agendaId)
  if (error) return { error: 'Gagal memperbarui papan.' }
  segarkan(s.poin.rapat.id)
  return { success: true }
}
