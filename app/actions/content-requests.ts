'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canRequestToHumas } from '@/lib/auth/permissions'
import { sendContentRequestToHumas } from '@/lib/email/reminders'
import type { ContentRequestType } from '@/types'

const TYPE_LABELS: Record<ContentRequestType, string> = {
  flyer_ujian: 'Flyer Ujian',
  flyer_lain: 'Flyer',
  video: 'Video',
  lain_lain: 'Konten',
}

/**
 * Membuatkan tugas Humas untuk sebuah request, lalu menautkannya.
 *
 * Kegagalan di sini sengaja tidak membatalkan request. Request-nya sendiri
 * sudah tersimpan dan e-mail pemberitahuan tetap terkirim; tugas hanyalah
 * jendela pemantauan. Menggagalkan seluruh pengajuan cuma karena papan tugas
 * bermasalah akan membuat pemohon kehilangan permintaannya tanpa sebab yang
 * bisa ia mengerti — lebih baik request ada tanpa tugas daripada tidak ada
 * sama sekali. Yang seperti itu terbaca sebagai task_id NULL, dan
 * requestStatus() sudah menanganinya.
 */
async function attachTaskToRequest(
  supabase: ReturnType<typeof createServerClient>,
  opts: {
    requestId: string
    requesterId: string
    requestType: ContentRequestType
    description: string
    requestedDate: string
  },
) {
  const { data: humas } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'humas')
    .limit(1)
    .maybeSingle()

  if (!humas) return

  const { data: task } = await supabase
    .from('tasks')
    .insert({
      title: `${TYPE_LABELS[opts.requestType] ?? 'Konten'}: ${opts.description.slice(0, 80)}`,
      description: opts.description,
      source_type: 'humas_request',
      // Pemohon jadi pemberi tugas, jadi dialah yang memverifikasi di langkah
      // Review — persis peran "pemohon menandai selesai" pada alur lama.
      assigned_by: opts.requesterId,
      assigned_to: humas.id,
      due_date: opts.requestedDate || null,
      status: 'todo',
    })
    .select('id')
    .single()

  if (!task) return

  await supabase.from('content_requests').update({ task_id: task.id }).eq('id', opts.requestId)
  await supabase.from('task_history').insert({
    task_id: task.id,
    changed_by: opts.requesterId,
    old_status: null,
    new_status: 'todo',
    notes: 'Dibuat dari request ke Humas',
  })
}

export async function createContentRequestAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canRequestToHumas(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const requestType = formData.get('request_type') as ContentRequestType
  const description = formData.get('description') as string
  const requestedDate = formData.get('requested_date') as string

  const { data: request, error } = await supabase
    .from('content_requests')
    .insert({
      request_type: requestType,
      description,
      requested_by: session.userId,
      requested_date: requestedDate,
    })
    .select('id')
    .single()

  if (error || !request) return { error: 'Gagal membuat request.' }

  // Request dititipkan ke papan tugas Humas supaya kemajuannya terlihat.
  //
  // Izinnya sengaja tidak lewat canAssignTask: hak menugaskan ke Humas hanya
  // dimiliki kumik, SDM, dan koor_ekstra, sedangkan canRequestToHumas jauh
  // lebih luas. Yang berlaku di sini adalah izin *mengajukan request* yang
  // sudah dicek di atas — tugas ini lahir dari request, bukan dari pendelegasian
  // biasa. Memanggil jalur assign biasa akan membuka pintu belakang: pemohon
  // yang tidak berhak mendelegasi jadi bisa menugaskan Humas lewat sini.
  await attachTaskToRequest(supabase, {
    requestId: request.id,
    requesterId: session.userId,
    requestType,
    description,
    requestedDate,
  })

  // Notify humas
  const { data: humasUsers } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('role', 'humas')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  for (const humas of humasUsers ?? []) {
    if (humas.email) {
      await sendContentRequestToHumas({
        to: humas.email,
        requesterName: session.displayName,
        requestType: formData.get('request_type') as string,
        description: formData.get('description') as string,
        requestUrl: `${baseUrl}/humas-request/${request.id}`,
      })
    }
  }

  revalidatePath('/humas-request')
  redirect('/humas-request')
}

/*
 * updateContentRequestStatusAction & setHumasPriorityAction dihapus di 0033.
 *
 * Keduanya menulis `content_requests.status` dan `.priority`, dua kolom yang
 * sejak sekarang diturunkan dari tugasnya. Membiarkannya tetap ada bukan sekadar
 * kode mati: server action adalah endpoint yang bisa dipanggil, jadi keduanya
 * akan tetap sanggup menulis kolom yang seharusnya sudah tidak ditulis siapa pun
 * — persis cara dua sumber kebenaran mulai berbeda isi.
 *
 * Perubahan status sekarang lewat papan tugas: Humas menggeser kartunya, dan
 * pemohon memverifikasi di langkah Review.
 */
