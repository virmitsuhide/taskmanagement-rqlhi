'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'

/**
 * Menandai pengumuman sudah dilihat guru.
 *
 * Dipanggil dari beranda, bukan dari lonceng: berandalah tempat pengumumannya
 * benar-benar terbaca. Menandainya saat lonceng diklik akan memadamkan lencana
 * untuk kabar yang baru dilirik judulnya.
 */
export async function tandaiPengumumanTerbacaAction() {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ announcements_seen_at: new Date().toISOString() })
    .eq('id', session.teacherId)

  // Kolomnya belum ada (migrasi 0049 belum jalan) bukan alasan menampilkan
  // galat kepada guru: yang gagal hanya pemadaman lencana, bukan pekerjaannya.
  if (error) return { ok: false }

  revalidatePath('/guru')
  return { ok: true }
}
