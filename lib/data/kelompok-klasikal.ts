import { createServerClient } from '@/lib/supabase/server'

/**
 * Kelompok klasikal tahsin yang diatur pengampu per halaqoh (0080).
 * Lihat drizzle/0080_kelompok_klasikal_PASTE_TO_SUPABASE.sql.
 */
export interface KelompokKlasikal {
  id: string
  nama: string
  /** Id siswa anggota, urut nama tidak dijamin — layar yang mengurutkan. */
  anggota: string[]
}

export interface DataKelompokKlasikal {
  /** false = migrasi 0080 belum dijalankan; pengaturan belum bisa dipakai. */
  tabelAda: boolean
  kelompok: KelompokKlasikal[]
}

export async function getKelompokKlasikal(halaqohId: string): Promise<DataKelompokKlasikal> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kelompok_klasikal')
    .select('id, nama, urutan, anggota:kelompok_klasikal_anggota(student_id)')
    .eq('halaqoh_id', halaqohId)
    .order('urutan')
  if (error) return { tabelAda: false, kelompok: [] }
  return {
    tabelAda: true,
    kelompok: ((data ?? []) as unknown as { id: string; nama: string; anggota: { student_id: string }[] }[])
      .map(k => ({ id: k.id, nama: k.nama, anggota: k.anggota.map(a => a.student_id) })),
  }
}
