import { createServerClient } from '@/lib/supabase/server'
import type { Blok } from '@/lib/rapor/docx'
import type { KodeMedan } from '@/lib/rapor/medan'
import { tingkatOf } from '@/lib/rq/sesi'
import type { Jenjang } from '@/types'

/**
 * Template rapor Qur'an (0082) — bentuk lembar yang diunggah koordinator.
 * Lihat drizzle/0082_rapor_quran_template_PASTE_TO_SUPABASE.sql.
 */
export interface RaporTemplate {
  id: string
  nama: string
  jenjang: Jenjang
  tingkat_min: number
  tingkat_max: number
  file_path: string | null
  file_nama: string | null
  blok: Blok[]
  pemetaan: Record<string, KodeMedan>
  tempat_terbit: string
  nama_koordinator: string
  nip_koordinator: string
  /** Path objek di bucket signatures (tertutup); null = ttd basah. */
  ttd_koordinator_path: string | null
  aktif: boolean
  updated_at: string
}

const KOLOM =
  'id, nama, jenjang, tingkat_min, tingkat_max, file_path, file_nama, blok, pemetaan,' +
  ' tempat_terbit, nama_koordinator, nip_koordinator, ttd_koordinator_path, aktif, updated_at'

/** false = migrasi 0082 belum dijalankan. */
export interface DaftarTemplate {
  tabelAda: boolean
  daftar: RaporTemplate[]
}

export async function getRaporTemplates(jenjang?: Jenjang[]): Promise<DaftarTemplate> {
  const supabase = createServerClient()
  let q = supabase.from('rapor_templates').select(KOLOM).order('jenjang').order('tingkat_min')
  if (jenjang && jenjang.length > 0) q = q.in('jenjang', jenjang)
  const { data, error } = await q
  if (error) return { tabelAda: false, daftar: [] }
  return { tabelAda: true, daftar: (data ?? []) as unknown as RaporTemplate[] }
}

export async function getRaporTemplate(id: string): Promise<RaporTemplate | null> {
  const supabase = createServerClient()
  const { data } = await supabase.from('rapor_templates').select(KOLOM).eq('id', id).maybeSingle()
  return (data as unknown as RaporTemplate) ?? null
}

/**
 * Template yang berlaku untuk seorang anak: unitnya cocok dan tingkat
 * kelasnya masuk rentang. Bila lebih dari satu cocok, yang rentangnya paling
 * sempit menang — format khusus kelas 6 mengalahkan format umum kelas 1-6.
 */
export function templateUntuk(
  daftar: RaporTemplate[],
  jenjang: Jenjang,
  kelas: string | null,
): RaporTemplate | null {
  const tingkat = tingkatOf(kelas)
  const cocok = daftar.filter(t =>
    t.aktif && t.jenjang === jenjang && (tingkat === null || (tingkat >= t.tingkat_min && tingkat <= t.tingkat_max)),
  )
  if (cocok.length === 0) return null
  return cocok.sort((a, b) => (a.tingkat_max - a.tingkat_min) - (b.tingkat_max - b.tingkat_min))[0]
}
