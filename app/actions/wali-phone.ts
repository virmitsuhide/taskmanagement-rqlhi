'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { normalkanNomor } from '@/lib/rq/phone'

/**
 * Pengampu memperbarui nomor HP wali salah satu siswanya.
 *
 * Izinnya dibatasi ke halaqoh yang benar-benar diampu guru itu, diperiksa ke
 * database — bukan mengandalkan siswa mana yang kebetulan tampil di layarnya.
 */
export async function simpanWaliPhoneAction(
  studentId: string,
  raw: string,
): Promise<{ error?: string; success?: boolean; phone?: string | null }> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!studentId) return { error: 'Siswa tidak dikenali.' }

  const supabase = createServerClient()

  const { data: halaqohRows } = await supabase
    .from('halaqoh')
    .select('id')
    .eq('wali_teacher_id', session.teacherId)
  const halaqohIds = (halaqohRows ?? []).map(h => h.id)
  if (halaqohIds.length === 0) return { error: 'Anda belum mengampu halaqoh manapun.' }

  const { data: student } = await supabase
    .from('students')
    .select('id, halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) return { error: 'Siswa tidak ditemukan.' }
  if (!student.halaqoh_id || !halaqohIds.includes(student.halaqoh_id)) {
    return { error: 'Siswa ini bukan siswa halaqoh Anda.' }
  }

  // Kosong berarti sengaja dihapus, bukan salah ketik — dibedakan dari nomor
  // yang diisi tapi tidak sah, supaya pengampu tetap bisa mengosongkan.
  const trimmed = raw.trim()
  let phone: string | null = null
  if (trimmed) {
    phone = normalkanNomor(trimmed)
    if (!phone) return { error: 'Nomor tidak dikenali. Contoh: 0812xxxxxxx atau +62812xxxxxxx.' }
  }

  const { error } = await supabase
    .from('students')
    .update({ wali_phone: phone, updated_at: new Date().toISOString() })
    .eq('id', studentId)

  if (error) return { error: 'Gagal menyimpan nomor.' }

  revalidatePath('/guru/siswa')
  revalidatePath(`/guru/siswa/${studentId}`)
  return { success: true, phone }
}
