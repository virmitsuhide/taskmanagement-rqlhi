'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { MAKS_TEMPLATE_WA } from '@/lib/rq/laporan-ortu'

/**
 * Template pesan WhatsApp laporan orang tua milik guru (0124).
 *
 * Guru hanya bisa menyentuh template miliknya: teacher_id selalu diambil dari
 * sesi, tidak pernah dari kiriman formulir. Batas 3 template dijaga lewat
 * nomor slot 1–3 — di sini dan di CHECK tabelnya.
 */

type Hasil = { error: string } | { success: true }

const PATH = '/guru/laporan-ortu'
const slotSah = (slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= MAKS_TEMPLATE_WA
const tabelHilang = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')
const PESAN_BELUM_AKTIF = 'Fitur template belum aktif — migrasi 0124 belum dijalankan. Hubungi admin.'

export async function simpanTemplateWaAction(slot: number, nama: string, isi: string): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!slotSah(slot)) return { error: `Template hanya bisa ${MAKS_TEMPLATE_WA}.` }
  const n = nama.trim()
  const t = isi.trim()
  if (!n) return { error: 'Beri nama templatenya.' }
  if (n.length > 40) return { error: 'Nama template paling panjang 40 huruf.' }
  if (!t) return { error: 'Isi template masih kosong.' }
  if (t.length > 4000) return { error: 'Isi template paling panjang 4.000 huruf.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('template_wa_ortu').upsert(
    { teacher_id: session.teacherId, slot, nama: n, isi: t, updated_at: new Date().toISOString() },
    { onConflict: 'teacher_id,slot' },
  )
  if (tabelHilang(error)) return { error: PESAN_BELUM_AKTIF }
  if (error) return { error: 'Gagal menyimpan template.' }
  revalidatePath(PATH)
  return { success: true }
}

export async function hapusTemplateWaAction(slot: number): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!slotSah(slot)) return { error: 'Template tidak ditemukan.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('template_wa_ortu').delete()
    .eq('teacher_id', session.teacherId).eq('slot', slot)
  if (tabelHilang(error)) return { error: PESAN_BELUM_AKTIF }
  if (error) return { error: 'Gagal menghapus template.' }
  revalidatePath(PATH)
  return { success: true }
}
