import { createServerClient } from '@/lib/supabase/server'
import { AMBANG_BAWAAN, type Ambang, type JenisTarget, type TahapTangga } from '@/lib/rq/target-bulanan'
import type { Jenjang } from '@/types'

/** Satu baris target_bulanan (0103). */
export interface TargetBulanan {
  id: string
  tahun_ajaran: string
  bulan: string
  jenjang: Jenjang
  kelompok: string
  tingkat: number
  jenis: JenisTarget
  metode: string | null
  awal_tahap: string | null
  awal_halaman: number | null
  akhir_tahap: string | null
  akhir_halaman: number | null
  awal_surat: number | null
  awal_ayat: number | null
  akhir_surat: number | null
  akhir_ayat: number | null
  keterangan: string
  updated_at: string
}

export interface DataTargetBulanan {
  /** false = migrasi 0103 belum dijalankan. */
  tabelAda: boolean
  baris: TargetBulanan[]
  ambang: Ambang
}

const TABEL_HILANG = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /target_bulanan/.test(e.message ?? ''))

export async function getTargetBulanan(
  tahunAjaran: string,
  jenjang: Jenjang,
  jenis: JenisTarget,
  kelompok: string,
): Promise<DataTargetBulanan> {
  const supabase = createServerClient()
  const [baris, ambang] = await Promise.all([
    supabase.from('target_bulanan').select('*')
      .eq('tahun_ajaran', tahunAjaran).eq('jenjang', jenjang).eq('jenis', jenis).eq('kelompok', kelompok),
    supabase.from('target_bulanan_ambang').select('bawah, atas').eq('jenjang', jenjang).eq('jenis', jenis).maybeSingle(),
  ])
  if (TABEL_HILANG(baris.error)) return { tabelAda: false, baris: [], ambang: AMBANG_BAWAAN[jenis] }
  const a = ambang.data as { bawah: number | string; atas: number | string } | null
  return {
    tabelAda: true,
    baris: (baris.data ?? []) as TargetBulanan[],
    ambang: a ? { bawah: Number(a.bawah), atas: Number(a.atas) } : AMBANG_BAWAAN[jenis],
  }
}

/** Tangga tahap tiap metode aktif, urut — nama metode → tahap. */
export async function getTanggaTahsin(): Promise<Record<string, TahapTangga[]>> {
  const supabase = createServerClient()
  const { data } = await supabase.from('tahsin_methods')
    .select('name, jilid_levels(label, order_num, total_pages, is_quran, is_terminal)')
    .eq('is_active', true)
  const hasil: Record<string, TahapTangga[]> = {}
  for (const m of (data ?? []) as { name: string; jilid_levels: (TahapTangga & { order_num: number })[] }[]) {
    hasil[m.name] = [...m.jilid_levels].sort((a, b) => a.order_num - b.order_num)
      .map(({ label, total_pages, is_quran, is_terminal }) => ({ label, total_pages, is_quran, is_terminal }))
  }
  return hasil
}
