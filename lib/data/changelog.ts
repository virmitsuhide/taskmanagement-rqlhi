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
  status?: 'draf' | 'terbit'
  commit_pesan?: string | null
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
    status: b.status ?? 'terbit',
    commit_pesan: b.commit_pesan ?? null,
  }
}

const KOLOM = 'id, judul, isi, jenis, untuk_pengurus, untuk_guru, untuk_karyawan, terbit_at'

/**
 * Entri yang sudah terbit, terbaru di atas. `pembaca` null = semua (layar
 * kelola Kepala RQ, termasuk draf dari commit dan yang dijadwalkan nanti).
 *
 * null dikembalikan bila tabelnya belum ada (0121 belum dijalankan) —
 * pemanggil membedakannya dari "belum ada pembaruan". Bila hanya 0128 yang
 * belum dijalankan (kolom status belum ada), semua baris dianggap terbit.
 */
export async function getChangelog(pembaca: PembacaChangelog | null, batas = 100): Promise<EntriChangelog[] | null> {
  const supabase = createServerClient()
  const tanya = (dengan0128: boolean) => {
    let q = supabase.from('changelog')
      .select(dengan0128 ? `${KOLOM}, status${pembaca ? '' : ', commit_pesan'}` : KOLOM)
      .order('terbit_at', { ascending: false })
      .limit(batas)
    if (pembaca) {
      q = q.eq(`untuk_${pembaca}`, true).lte('terbit_at', new Date().toISOString())
      if (dengan0128) q = q.eq('status', 'terbit')
    }
    return q
  }
  let { data, error } = await tanya(true)
  if (error) ({ data, error } = await tanya(false))
  if (error) return null
  return ((data ?? []) as unknown as Baris[]).map(keEntri)
}
