'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canRequestToHumas } from '@/lib/auth/permissions'
import { sendContentRequestToHumas } from '@/lib/email/reminders'
import type { ContentRequestType, ContentPriority } from '@/types'

export async function createContentRequestAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canRequestToHumas(session.role)) return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { data: request, error } = await supabase
    .from('content_requests')
    .insert({
      request_type: formData.get('request_type') as ContentRequestType,
      description: formData.get('description') as string,
      requested_by: session.userId,
      requested_date: formData.get('requested_date') as string,
    })
    .select('id')
    .single()

  if (error || !request) return { error: 'Gagal membuat request.' }

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

export async function updateContentRequestStatusAction(
  requestId: string,
  status: string,
  priority?: ContentPriority
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: req } = await supabase
    .from('content_requests')
    .select('requested_by, status')
    .eq('id', requestId)
    .single()

  if (!req) return { error: 'Request tidak ditemukan.' }

  const updateData: Record<string, unknown> = {}

  // Humas sets priority and changes to on_process
  if (session.role === 'humas' && status === 'on_process') {
    updateData.status = 'on_process'
    if (priority) updateData.priority = priority
  }

  // The requester marks as finish
  if (req.requested_by === session.userId && status === 'finish') {
    updateData.status = 'finish'
    updateData.finished_by = session.userId
    updateData.finished_at = new Date().toISOString()
  }

  if (Object.keys(updateData).length === 0) {
    return { error: 'Tidak memiliki izin untuk mengubah status ini.' }
  }

  const { error } = await supabase
    .from('content_requests')
    .update(updateData)
    .eq('id', requestId)

  if (error) return { error: 'Gagal memperbarui status.' }

  revalidatePath('/humas-request')
  return { success: true }
}

export async function setHumasPriorityAction(requestId: string, priority: ContentPriority) {
  const session = await getSession()
  if (!session || session.role !== 'humas') return { error: 'Tidak memiliki izin.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('content_requests')
    .update({ priority })
    .eq('id', requestId)

  if (error) return { error: 'Gagal memperbarui prioritas.' }

  revalidatePath('/humas-request')
  return { success: true }
}
