import { createServerClient } from '@/lib/supabase/server'
import type { EntriChangelog, JenisChangelog, PembacaChangelog } from '@/lib/rq/changelog'

interface Baris {
  id: string
  judul: string
  isi: string
  jenis: JenisChangelog
  untuk_pengurus: boolean
  untuk_guru: boolean
  untuk_karyawan: boolean
  terbit_at: string
}

function keEntri(b: Baris): EntriChangelog {
  return {
    id: b.id,
    judul: b.judul,
    isi: b.isi,
    jenis: b.jenis,
    untuk: [
      ...(b.untuk_pengurus ? ['pengurus' as const] : []),
      ...(b.untuk_guru ? ['guru' as const] : []),
      ...(b.untuk_karyawan ? ['karyawan' as const] : []),
    ],
    terbit_at: b.terbit_at,
  }
}

/**
 * Entri yang sudah terbit, terbaru di atas. `pembaca` null = semua (layar
 * kelola Kepala RQ, termasuk yang dijadwalkan terbit nanti).
 *
 * null dikembalikan bila tabelnya belum ada (0121 belum dijalankan) —
 * pemanggil membedakannya dari "belum ada pembaruan".
 */
export async function getChangelog(pembaca: PembacaChangelog | null, batas = 100): Promise<EntriChangelog[] | null> {
  const supabase = createServerClient()
  let q = supabase.from('changelog')
    .select('id, judul, isi, jenis, untuk_pengurus, untuk_guru, untuk_karyawan, terbit_at')
    .order('terbit_at', { ascending: false })
    .limit(batas)
  if (pembaca) q = q.eq(`untuk_${pembaca}`, true).lte('terbit_at', new Date().toISOString())
  const { data, error } = await q
  if (error) return null
  return ((data ?? []) as Baris[]).map(keEntri)
}
