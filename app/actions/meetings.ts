'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  canCreateMeeting,
  canEditMeeting,
  canDeleteMeeting,
  canPurgeMeeting,
} from '@/lib/auth/permissions'
import type { MeetingType, AgendaTag } from '@/types'

/** Poin notulen dari form, dengan urutan mengikuti tampilan. Poin tanpa isi dilewati. */
/** Satu nama per baris dari textarea formulir notulen. */
function bacaNama(formData: FormData, field: string): string[] {
  const raw = formData.get(field) as string | null
  return raw ? raw.split('\n').map(p => p.trim()).filter(Boolean) : []
}

/**
 * Kolom peserta_izin (0089) mungkin belum ada. Selama isiannya kosong, simpan
 * tetap jalan tanpa kolom itu; kalau ada isinya, galat dibiarkan muncul supaya
 * nama yang izin tidak hilang diam-diam.
 */
const IZIN_BELUM_AKTIF = 'Kolom "Peserta izin" belum aktif — jalankan migrasi 0089, atau kosongkan kolom itu dulu.'

/** Salinan baris tanpa peserta_izin — untuk menyimpan sebelum migrasi 0089. */
function tanpaKolomIzin<T extends { peserta_izin: string[] }>(baris: T): Omit<T, 'peserta_izin'> {
  const salinan: Partial<T> = { ...baris }
  delete salinan.peserta_izin
  return salinan as Omit<T, 'peserta_izin'>
}

function kolomIzinBelumAda(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === 'PGRST204' || error.code === '42703') && error.message?.includes('peserta_izin'))
}

function bacaAgenda(formData: FormData) {
  const jumlah = parseInt(formData.get('agenda_count') as string) || 0
  const hasil: {
    id: string | null; order_num: number; tag: AgendaTag; discussion: string
    follow_up: string | null; butuh_biaya: boolean
  }[] = []
  for (let i = 0; i < jumlah; i++) {
    const discussion = formData.get(`agenda_${i}_discussion`) as string
    const tag = formData.get(`agenda_${i}_tag`) as AgendaTag
    if (!discussion || !tag) continue
    const followUp = formData.get(`agenda_${i}_follow_up`) as string
    hasil.push({
      id: (formData.get(`agenda_${i}_id`) as string) || null,
      order_num: hasil.length + 1,
      tag,
      discussion,
      // Kolom tindak lanjut hanya tampil untuk tag tindak_lanjut; sisa ketikan
      // dari tag sebelumnya tidak ikut tersimpan.
      follow_up: tag === 'tindak_lanjut' ? followUp || null : null,
      butuh_biaya: tag === 'approval' && formData.get(`agenda_${i}_butuh_biaya`) === 'on',
    })
  }
  return hasil
}

export async function createMeetingAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const type = formData.get('type') as MeetingType
  if (!canCreateMeeting(session.role, type)) {
    return { error: 'Anda tidak memiliki izin untuk membuat rapat ini.' }
  }

  const supabase = createServerClient()

  const participants = bacaNama(formData, 'participants')
  const pesertaIzin = bacaNama(formData, 'peserta_izin')

  const baris = {
      type,
      subject: formData.get('subject') as string,
      date: formData.get('date') as string,
      start_time: (formData.get('start_time') as string) || null,
      end_time: (formData.get('end_time') as string) || null,
      location: (formData.get('location') as string) || null,
      mc: (formData.get('mc') as string) || null,
      notulis: (formData.get('notulis') as string) || null,
      participants,
      peserta_izin: pesertaIzin,
      created_by: session.userId,
  }
  let { data: meeting, error } = await supabase.from('meetings').insert(baris).select('id').single()
  if (kolomIzinBelumAda(error) && pesertaIzin.length === 0) {
    const tanpaIzin = tanpaKolomIzin(baris)
    ;({ data: meeting, error } = await supabase.from('meetings').insert(tanpaIzin).select('id').single())
  }

  if (kolomIzinBelumAda(error)) return { error: IZIN_BELUM_AKTIF }
  if (error || !meeting) return { error: 'Gagal membuat rapat.' }

  // Rapat baru: id dari form (kalau ada) diabaikan, semua poin disisipkan.
  const agendaItems = bacaAgenda(formData).map(a => ({
    order_num: a.order_num, tag: a.tag, discussion: a.discussion,
    follow_up: a.follow_up, butuh_biaya: a.butuh_biaya,
    meeting_id: meeting.id,
    approval_status: a.tag === 'approval' ? 'menunggu' : null,
  }))
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
    .select('type, deleted_at')
    .eq('id', meetingId)
    .maybeSingle()

  // Rapat di keranjang sampah tidak bisa diedit — pulihkan dulu. Tanpa syarat
  // ini, tautan /rapat/{id}/edit yang masih tersimpan di riwayat peramban jadi
  // pintu belakang untuk mengubah notulen yang sudah dibuang.
  if (!existing || existing.deleted_at) return { error: 'Rapat tidak ditemukan.' }
  if (!canEditMeeting(session.role, existing.type)) {
    return { error: 'Anda tidak memiliki izin untuk mengedit rapat ini.' }
  }

  const participants = bacaNama(formData, 'participants')
  const pesertaIzin = bacaNama(formData, 'peserta_izin')

  // Jenis rapat boleh dipindah saat edit — koordinator kerap salah pilih antara
  // rapat divisinya sendiri dan rapat kolaborasi. Syaratnya izin BUAT atas jenis
  // TUJUAN, bukan izin edit: MEETING_EDIT.kumik memuat para koor supaya mereka
  // bisa merapikan notulen kumik, jadi memakai izin edit di sini akan membuka
  // jalan memindahkan rapat menjadi rapat Kumik yang tidak boleh mereka buat.
  //
  // Jenis yang tidak berubah tidak diperiksa: seorang koor SD yang mengedit
  // notulen kumik memang tidak bisa membuat rapat kumik, dan tidak semestinya
  // terhalang menyimpan suntingannya sendiri.
  const requestedType = formData.get('type') as MeetingType | null
  let type = existing.type as MeetingType
  if (requestedType && requestedType !== existing.type) {
    if (!canCreateMeeting(session.role, requestedType)) {
      return { error: 'Anda tidak memiliki izin memindahkan rapat ke jenis itu.' }
    }
    type = requestedType
  }

  const ubahan = {
      type,
      subject: formData.get('subject') as string,
      date: formData.get('date') as string,
      start_time: (formData.get('start_time') as string) || null,
      end_time: (formData.get('end_time') as string) || null,
      location: (formData.get('location') as string) || null,
      mc: (formData.get('mc') as string) || null,
      notulis: (formData.get('notulis') as string) || null,
      participants,
      peserta_izin: pesertaIzin,
  }
  let { error } = await supabase.from('meetings').update(ubahan).eq('id', meetingId)
  if (kolomIzinBelumAda(error) && pesertaIzin.length === 0) {
    const tanpaIzin = tanpaKolomIzin(ubahan)
    ;({ error } = await supabase.from('meetings').update(tanpaIzin).eq('id', meetingId))
  }

  if (kolomIzinBelumAda(error)) return { error: IZIN_BELUM_AKTIF }
  if (error) return { error: 'Gagal memperbarui rapat.' }

  /*
    Agenda diperbarui menurut id, bukan dihapus lalu disisipkan ulang.

    Dulu seluruh agenda dibuang dan ditulis ulang setiap kali rapat disimpan.
    Sejak Papan Rapat (0077) menyimpan status di baris agenda — keputusan
    approval, biaya dari bendahara, tanda selesai — cara itu diam-diam menghapus
    semua status tersebut, dan tugas yang dibuat dari poin itu kehilangan
    tautan asalnya. Kini hanya poin yang benar-benar dibuang dari notulen yang
    dihapus.
  */
  const { data: lama, error: galatLama } = await supabase
    .from('agenda_items')
    .select('id, approval_status')
    .eq('meeting_id', meetingId)
  // Tanpa daftar poin lama, semua poin akan dianggap baru dan notulen jadi
  // ganda (mis. migrasi 0077 belum dijalankan). Lebih baik menolak simpan.
  if (galatLama) return { error: 'Gagal membaca poin notulen lama. Detail rapat tersimpan, tetapi poinnya belum.' }
  const statusLama = new Map(
    ((lama ?? []) as { id: string; approval_status: string | null }[]).map(r => [r.id, r.approval_status]),
  )

  const dikirim = bacaAgenda(formData)
  const dipakai = new Set<string>()
  const baru = []
  for (const { id, ...a } of dikirim) {
    // Poin yang baru berganti tag menjadi approval mulai dari "menunggu";
    // approval yang sudah diputuskan tidak ditimpa oleh suntingan teks.
    const approval_status = a.tag === 'approval' ? (id && statusLama.get(id)) || 'menunggu' : null
    if (id && statusLama.has(id) && !dipakai.has(id)) {
      dipakai.add(id)
      await supabase.from('agenda_items').update({ ...a, approval_status }).eq('id', id)
    } else {
      baru.push({ ...a, meeting_id: meetingId, approval_status })
    }
  }
  const dibuang = [...statusLama.keys()].filter(id => !dipakai.has(id))
  if (dibuang.length > 0) {
    await supabase.from('agenda_items').delete().in('id', dibuang)
  }
  if (baru.length > 0) {
    await supabase.from('agenda_items').insert(baru)
  }
  revalidatePath('/rapat/papan')

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
async function purgeMeetingRow(
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

/**
 * Buang rapat ke keranjang sampah. Barisnya tetap ada, hanya ditandai — dan
 * `deleted_by` mencatat siapa yang membuangnya, supaya Kepala RQ tahu kepada
 * siapa harus bertanya sebelum mengosongkan keranjang.
 */
async function trashMeeting(
  supabase: ReturnType<typeof createServerClient>,
  meetingId: string,
  userId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq('id', meetingId)
    .is('deleted_at', null)
  if (error) return { error: 'Gagal memindahkan rapat ke keranjang sampah.' }
  return {}
}

/**
 * Memastikan rapat ada, belum di keranjang, dan penggunanya berhak membuangnya.
 * Dipakai kedua tombol hapus — dari halaman detail dan dari daftar.
 */
async function siapDibuang(meetingId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' as const }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('type, deleted_at')
    .eq('id', meetingId)
    .maybeSingle()

  if (!meeting || meeting.deleted_at) return { error: 'Rapat tidak ditemukan.' as const }
  if (!canDeleteMeeting(session.role, meeting.type)) {
    return { error: 'Anda tidak memiliki izin untuk menghapus rapat ini.' as const }
  }
  return { supabase, userId: session.userId }
}

export async function deleteMeetingAction(meetingId: string) {
  const siap = await siapDibuang(meetingId)
  if ('error' in siap) return { error: siap.error }

  const { error } = await trashMeeting(siap.supabase, meetingId, siap.userId)
  if (error) return { error }

  revalidatePath('/rapat')
  revalidatePath('/rapat/sampah')
  redirect('/rapat')
}

/** Buang dari tabel /rapat tanpa redirect — dipakai tombol aksi di daftar. */
export async function deleteMeetingFromListAction(meetingId: string) {
  const siap = await siapDibuang(meetingId)
  if ('error' in siap) return { error: siap.error }

  const { error } = await trashMeeting(siap.supabase, meetingId, siap.userId)
  if (error) return { error }

  revalidatePath('/rapat')
  revalidatePath('/rapat/sampah')
  return { success: true }
}

/** Kembalikan rapat dari keranjang sampah ke daftar. Kepala RQ saja. */
export async function restoreMeetingAction(meetingId: string) {
  const session = await getSession()
  if (!session || !canPurgeMeeting(session.role)) {
    return { error: 'Hanya Kepala RQ yang bisa membuka keranjang sampah rapat.' }
  }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('deleted_at')
    .eq('id', meetingId)
    .maybeSingle()

  if (!meeting) return { error: 'Rapat tidak ditemukan.' }
  if (!meeting.deleted_at) return { error: 'Rapat ini tidak sedang di keranjang sampah.' }

  const { error } = await supabase
    .from('meetings')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', meetingId)
  if (error) return { error: 'Gagal memulihkan rapat.' }

  revalidatePath('/rapat')
  revalidatePath('/rapat/sampah')
  revalidatePath(`/rapat/${meetingId}`)
  return { success: true }
}

/**
 * Hapus rapat untuk selamanya, beserta seluruh agendanya (cascade). Kepala RQ
 * saja, dan hanya atas rapat yang sudah ada di keranjang sampah — supaya
 * penghapusan permanen selalu butuh dua langkah terpisah oleh orang yang sama.
 */
export async function purgeMeetingAction(meetingId: string) {
  const session = await getSession()
  if (!session || !canPurgeMeeting(session.role)) {
    return { error: 'Hanya Kepala RQ yang bisa menghapus rapat secara permanen.' }
  }

  const supabase = createServerClient()
  const { data: meeting } = await supabase
    .from('meetings')
    .select('deleted_at')
    .eq('id', meetingId)
    .maybeSingle()

  if (!meeting) return { error: 'Rapat tidak ditemukan.' }
  if (!meeting.deleted_at) {
    return { error: 'Buang rapat ini ke keranjang sampah dulu sebelum dihapus permanen.' }
  }

  const { error } = await purgeMeetingRow(supabase, meetingId)
  if (error) return { error }

  revalidatePath('/rapat')
  revalidatePath('/rapat/sampah')
  return { success: true }
}
