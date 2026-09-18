import { createServerClient } from '@/lib/supabase/server'

/** Jenis kartu beranda guru yang bisa ditutup. */
export const RUANG_KARTU = ['pengumuman', 'progres-ujian'] as const
export type RuangKartu = (typeof RUANG_KARTU)[number]

/**
 * Kartu beranda yang sudah ditutup seorang guru, dikelompokkan per ruang.
 *
 * Tabelnya belum ada (migrasi 0075 belum jalan) → kosong, bukan galat:
 * beranda tetap tampil, dan penutupan kartu jatuh kembali ke localStorage.
 */
export async function getKartuTersembunyi(teacherId: string): Promise<Record<RuangKartu, string[]>> {
  const hasil: Record<RuangKartu, string[]> = { pengumuman: [], 'progres-ujian': [] }
  try {
    const { data, error } = await createServerClient()
      .from('guru_kartu_tersembunyi')
      .select('ruang, kunci')
      .eq('teacher_id', teacherId)
    if (error || !data) return hasil
    for (const r of data as { ruang: string; kunci: string }[]) {
      if ((RUANG_KARTU as readonly string[]).includes(r.ruang)) hasil[r.ruang as RuangKartu].push(r.kunci)
    }
  } catch {
    // Pelengkap beranda — jangan jatuhkan halamannya.
  }
  return hasil
}
