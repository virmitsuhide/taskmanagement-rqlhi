'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

/**
 * Dropdown dibuka → badge berhenti berbunyi.
 *
 * Sengaja TIDAK menandai tiap item sebagai terbaca: titik biru per baris tetap
 * ada sampai itemnya benar-benar diklik.
 */
export async function markNotificationsSeenAction() {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('users')
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal memperbarui notifikasi.' }
  return { success: true }
}

/** Satu item diklik → titik birunya hilang secara permanen. */
export async function markNotificationReadAction(historyId: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { user_id: session.userId, history_id: historyId },
      { onConflict: 'user_id,history_id', ignoreDuplicates: true },
    )

  if (error) return { error: 'Gagal menandai notifikasi.' }
  return { success: true }
}

/** Tandai semua yang tampil sebagai terbaca sekaligus. */
export async function markAllNotificationsReadAction(historyIds: string[]) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (historyIds.length === 0) return { success: true }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      historyIds.map(id => ({ user_id: session.userId, history_id: id })),
      { onConflict: 'user_id,history_id', ignoreDuplicates: true },
    )

  if (error) return { error: 'Gagal menandai notifikasi.' }
  revalidatePath('/', 'layout')
  return { success: true }
}
