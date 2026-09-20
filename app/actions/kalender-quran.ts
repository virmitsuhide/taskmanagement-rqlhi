'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageRaporTemplate } from '@/lib/auth/permissions'
import { HARI_PILIHAN } from '@/lib/rq/kalender-quran'
import type { Jenjang } from '@/types'

type Hasil = { error?: string; success?: true }

const PATH = '/kalender-quran'

/**
 * Kalender aktif pembelajaran Al-Qur'an (0084) dipegang koordinator unit —
 * wewenang yang sama dengan template rapor, sebab keduanya menetapkan bentuk
 * rapor seluruh angkatan.
 */
async function izin(jenjang: Jenjang) {
  const session = await getSession()
  if (!session) return { galat: 'Sesi tidak valid.' as const, session: null }
  if (!canManageRaporTemplate(session.role, jenjang)) return { galat: 'Tidak memiliki izin.' as const, session: null }
  return { galat: null, session }
}

/** Tetapkan hari aktif sebuah program pada satu semester. */
export async function simpanJadwalAction(
  termId: string,
  jenjang: Jenjang,
  program: string,
  hari: number[],
): Promise<Hasil> {
  const { galat, session } = await izin(jenjang)
  if (galat || !session) return { error: galat ?? 'Tidak memiliki izin.' }

  const bersih = [...new Set(hari)].filter(h => (HARI_PILIHAN as readonly number[]).includes(h)).sort()
  if (bersih.length === 0) {
    return { error: 'Pilih minimal satu hari. Program tanpa hari aktif membuat TM-nya nol dan kehadiran anak tak bisa dinilai.' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('kalender_jadwal').upsert(
    { term_id: termId, jenjang, program, hari: bersih, updated_by: session.userId, updated_at: new Date().toISOString() },
    { onConflict: 'term_id,jenjang,program' },
  )
  if (error) return { error: 'Gagal menyimpan jadwal. Pastikan migrasi 0084 sudah dijalankan.' }

  revalidatePath(PATH)
  return { success: true }
}

/**
 * Tandai satu tanggal sebagai sesi kosong.
 *
 * `kelas` kosong berarti seluruh angkatan. Menandai ulang sasaran yang sama
 * ditolak oleh indeks unik (0084) — tanpa itu, satu tanggal bisa ditandai
 * berkali-kali dan TM ikut berkurang sebanyak itu.
 */
export async function tandaiKosongAction(
  tanggal: string,
  jenjang: Jenjang,
  tingkat: number,
  kelas: string | null,
  alasan: string,
): Promise<Hasil> {
  const { galat, session } = await izin(jenjang)
  if (galat || !session) return { error: galat ?? 'Tidak memiliki izin.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Tanggal tidak sah.' }
  if (!Number.isInteger(tingkat) || tingkat < 1 || tingkat > 12) return { error: 'Angkatan tidak sah.' }

  const supabase = createServerClient()
  const { error } = await supabase.from('kalender_kosong').insert({
    tanggal,
    jenjang,
    tingkat,
    kelas: kelas?.trim() || null,
    alasan: alasan.trim().slice(0, 120),
    ditandai_oleh: session.userId,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Tanggal itu sudah ditandai kosong untuk sasaran yang sama.' }
    return { error: 'Gagal menandai. Pastikan migrasi 0084 sudah dijalankan.' }
  }

  revalidatePath(PATH)
  return { success: true }
}

/** Batalkan penandaan — sesinya kembali dihitung sebagai tatap muka. */
export async function batalKosongAction(id: string, jenjang: Jenjang): Promise<Hasil> {
  const { galat } = await izin(jenjang)
  if (galat) return { error: galat }

  const supabase = createServerClient()
  const { error } = await supabase.from('kalender_kosong').delete().eq('id', id)
  if (error) return { error: 'Gagal membatalkan penandaan.' }

  revalidatePath(PATH)
  return { success: true }
}
