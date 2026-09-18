'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { RUANG_KARTU } from '@/lib/data/kartu-tersembunyi'

/**
 * Mencatat kartu beranda yang ditutup guru, supaya tetap tertutup di
 * perangkat mana pun ia login.
 *
 * Menerima beberapa kunci sekaligus: kartu yang dulu ditutup sebelum
 * pencatatan pindah ke server masih tersimpan di localStorage, dan disetor
 * sekali jalan saat beranda dibuka.
 *
 * Tanpa revalidatePath: kartunya sudah hilang di layar lewat catatan lokal,
 * jadi memuat ulang beranda hanya membuang satu putaran kueri.
 */
export async function sembunyikanKartuAction(ruang: string, kunci: string[]) {
  const session = await getTeacherSession()
  if (!session) return { ok: false }
  if (!(RUANG_KARTU as readonly string[]).includes(ruang)) return { ok: false }

  const bersih = [...new Set(kunci)].filter(k => typeof k === 'string' && k.length > 0 && k.length <= 100).slice(0, 200)
  if (bersih.length === 0) return { ok: true }

  const { error } = await createServerClient()
    .from('guru_kartu_tersembunyi')
    .upsert(
      bersih.map(k => ({ teacher_id: session.teacherId, ruang, kunci: k })),
      { onConflict: 'teacher_id,ruang,kunci', ignoreDuplicates: true },
    )

  // Tabel belum ada (migrasi 0075): kartu tetap tertutup di perangkat ini
  // lewat localStorage, jadi tidak ada yang perlu dikabarkan ke guru.
  return { ok: !error }
}
