import { createServerClient } from '@/lib/supabase/server'

let cache: Promise<Map<number, { name_latin: string; total_ayat: number }>> | null = null

/**
 * Nama & jumlah ayat 114 surat. surat_master tidak pernah berubah, jadi
 * dibaca sekali per proses — sama seperti getPetaHalaman.
 *
 * Dipakai untuk menampilkan muroja'ah lintas surat (0076): surat akhirnya
 * disimpan sebagai nomor, dan menambah join kedua ke surat_master di setiap
 * kueri riwayat membuat kueri itu gagal total di database yang belum
 * menjalankan migrasinya.
 */
export function getInfoSurat(): Promise<Map<number, { name_latin: string; total_ayat: number }>> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await createServerClient().from('surat_master').select('id, name_latin, total_ayat')
      if (error || !data || data.length === 0) {
        cache = null
        return new Map()
      }
      return new Map((data as { id: number; name_latin: string; total_ayat: number }[])
        .map(s => [s.id, { name_latin: s.name_latin, total_ayat: s.total_ayat }]))
    })()
  }
  return cache
}
