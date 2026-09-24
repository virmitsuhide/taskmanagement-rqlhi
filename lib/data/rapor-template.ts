import { createServerClient } from '@/lib/supabase/server'
import type { Blok } from '@/lib/rapor/docx'
import type { AwalIsian, KodeMedan } from '@/lib/rapor/medan'
import type { JenisRapor } from '@/lib/rapor/jenis'
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
  /** 0086 — laporan tengah semester (ATS) atau rapor akhir semester. */
  jenis: JenisRapor
  /** 0086 — isi awal tiap isian merah (id slot → contoh/kosong/medan). */
  awal_isian: Record<string, AwalIsian>
  updated_at: string
}

export { bacaJenisRapor, LABEL_JENIS_RAPOR, type JenisRapor } from '@/lib/rapor/jenis'

const KOLOM_LAMA =
  'id, nama, jenjang, tingkat_min, tingkat_max, file_path, file_nama, blok, pemetaan,' +
  ' tempat_terbit, nama_koordinator, nip_koordinator, ttd_koordinator_path, aktif, updated_at'
const KOLOM = KOLOM_LAMA + ', jenis, awal_isian'

/**
 * Sebelum migrasi 0086 dijalankan kolom jenis & awal_isian belum ada, dan
 * kueri yang menyebutnya gagal seluruhnya. Template lama tetap harus bisa
 * dipakai — semuanya memang rapor semester — jadi kueri diulang tanpa
 * kolom baru dan nilainya diisi bawaan.
 */
function lengkapi(row: Record<string, unknown>): RaporTemplate {
  return { jenis: 'semester', awal_isian: {}, ...row } as unknown as RaporTemplate
}

/** false = migrasi 0082 belum dijalankan. */
export interface DaftarTemplate {
  tabelAda: boolean
  daftar: RaporTemplate[]
}

export async function getRaporTemplates(jenjang?: Jenjang[]): Promise<DaftarTemplate> {
  const supabase = createServerClient()
  const kueri = (kolom: string) => {
    let q = supabase.from('rapor_templates').select(kolom).order('jenjang').order('tingkat_min')
    if (jenjang && jenjang.length > 0) q = q.in('jenjang', jenjang)
    return q
  }
  let { data, error } = await kueri(KOLOM)
  if (error) ({ data, error } = await kueri(KOLOM_LAMA))
  if (error) return { tabelAda: false, daftar: [] }
  return { tabelAda: true, daftar: ((data ?? []) as unknown as Record<string, unknown>[]).map(lengkapi) }
}

export async function getRaporTemplate(id: string): Promise<RaporTemplate | null> {
  const supabase = createServerClient()
  let { data, error } = await supabase.from('rapor_templates').select(KOLOM).eq('id', id).maybeSingle()
  if (error) ({ data, error } = await supabase.from('rapor_templates').select(KOLOM_LAMA).eq('id', id).maybeSingle())
  return data ? lengkapi(data as unknown as Record<string, unknown>) : null
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
  jenis: JenisRapor = 'semester',
): RaporTemplate | null {
  const tingkat = tingkatOf(kelas)
  const cocok = daftar.filter(t =>
    t.aktif && t.jenis === jenis && t.jenjang === jenjang && (tingkat === null || (tingkat >= t.tingkat_min && tingkat <= t.tingkat_max)),
  )
  if (cocok.length === 0) return null
  return cocok.sort((a, b) => (a.tingkat_max - a.tingkat_min) - (b.tingkat_max - b.tingkat_min))[0]
}
