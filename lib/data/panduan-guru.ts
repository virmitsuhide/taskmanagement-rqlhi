import { createServerClient } from '@/lib/supabase/server'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { isQulsSdProgram } from '@/lib/rq/programs'
import type { SasaranPanduan } from '@/lib/auth/permissions'
import { BUCKET_PANDUAN, type KategoriPanduan } from '@/lib/rq/panduan-guru'
import type { Jenjang } from '@/types'

/** Panduan Guru (0104) — SOP & dokumen PDF, dibaca di portal guru. */

export interface Panduan {
  id: string
  judul: string
  kategori: KategoriPanduan
  keterangan: string
  sasaran: SasaranPanduan
  file_path: string
  file_name: string
  file_size: number | null
  diunggah_oleh: string | null
  created_at: string
  pengunggah: { display_name: string } | null
}

const KOLOM = 'id, judul, kategori, keterangan, sasaran, file_path, file_name, file_size, diunggah_oleh, created_at, pengunggah:users!panduan_guru_diunggah_oleh_fkey(display_name)'

/** null = tabel belum ada (0104 belum dijalankan). */
async function ambil(saring?: SasaranPanduan[]): Promise<Panduan[] | null> {
  let q = createServerClient().from('panduan_guru').select(KOLOM).order('created_at', { ascending: false })
  if (saring) q = q.in('sasaran', saring)
  const { data, error } = await q
  if (error) return null
  return (data ?? []) as unknown as Panduan[]
}

/**
 * Sasaran yang dibaca seorang guru: 'semua', unit penempatannya, unit tiap
 * halaqoh aktif yang ia ampu, dan 'quls_sd' bila ia guru QULS SD atau
 * mengampu kelompok QULS SD.
 */
export async function sasaranGuru(teacherId: string): Promise<SasaranPanduan[]> {
  const supabase = createServerClient()
  const [{ data: guru }, halaqohIds] = await Promise.all([
    supabase.from('teachers').select('unit, kategori_guru').eq('id', teacherId).maybeSingle(),
    getTeacherHalaqohIds(teacherId),
  ])
  const { data: halaqoh } = halaqohIds.length
    ? await supabase.from('halaqoh').select('jenjang, program').in('id', halaqohIds).eq('is_active', true)
    : { data: [] }
  const hasil = new Set<SasaranPanduan>(['semua'])
  const g = guru as { unit: Jenjang | null; kategori_guru: string | null } | null
  if (g?.unit) hasil.add(g.unit)
  if (g?.kategori_guru === 'guru_quls_sd') hasil.add('quls_sd')
  for (const h of (halaqoh ?? []) as { jenjang: Jenjang; program: string | null }[]) {
    hasil.add(h.jenjang)
    if (isQulsSdProgram(h.jenjang, h.program)) hasil.add('quls_sd')
  }
  return [...hasil]
}

export async function getPanduanGuru(teacherId: string): Promise<Panduan[] | null> {
  return ambil(await sasaranGuru(teacherId))
}

/** Untuk pengurus: seluruh dokumen (pengurus boleh membaca semuanya). */
export async function getPanduanSemua(): Promise<Panduan[] | null> {
  return ambil()
}

export async function getPanduan(id: string): Promise<Panduan | null> {
  const { data } = await createServerClient().from('panduan_guru').select(KOLOM).eq('id', id).maybeSingle()
  return (data ?? null) as unknown as Panduan | null
}

/**
 * Tautan bertanda tangan untuk membaca di tempat & mengunduh — berlaku satu
 * jam. Bucket-nya privat, jadi tautan ini satu-satunya jalan ke berkas.
 */
export async function tautanPanduan(p: Pick<Panduan, 'file_path' | 'file_name'>): Promise<{ lihat: string; unduh: string } | null> {
  const storage = createServerClient().storage.from(BUCKET_PANDUAN)
  const [lihat, unduh] = await Promise.all([
    storage.createSignedUrl(p.file_path, 3600),
    storage.createSignedUrl(p.file_path, 3600, { download: p.file_name }),
  ])
  if (!lihat.data?.signedUrl || !unduh.data?.signedUrl) return null
  return { lihat: lihat.data.signedUrl, unduh: unduh.data.signedUrl }
}

