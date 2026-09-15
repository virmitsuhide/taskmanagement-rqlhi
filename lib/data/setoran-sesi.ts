import { createServerClient } from '@/lib/supabase/server'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { getJuzDrillPerSiswa, type JuzDrillSiswa } from '@/lib/data/drill-tahfidz'

/**
 * Bahan halaman "setor satu sesi sekaligus" — tahsin dan tahfidz.
 *
 * Satu halaqoh = satu sesi seorang guru (lihat pengajuan ujian tahsin), jadi
 * memilih halaqoh sama dengan memilih sesi. Semua anak halaqoh itu dimuat
 * sekaligus beserta posisi terakhirnya, supaya guru cukup mengubah yang
 * berbeda alih-alih mengetik ulang dari nol untuk tiap anak.
 */

export interface HalaqohSesi {
  id: string
  name: string
  sesi: number | null
}

export async function getHalaqohSesiGuru(teacherId: string): Promise<HalaqohSesi[]> {
  const ids = await getTeacherHalaqohIds(teacherId)
  if (ids.length === 0) return []
  const supabase = createServerClient()
  const { data } = await supabase
    .from('halaqoh')
    .select('id, name, sesi')
    .in('id', ids)
    .eq('is_active', true)
    .order('sesi')
  return (data ?? []) as HalaqohSesi[]
}

/** Pilih halaqoh dari query string bila milik guru, selain itu yang pertama. */
export function pilihHalaqoh(daftar: HalaqohSesi[], diminta: string | undefined): HalaqohSesi | null {
  return daftar.find(h => h.id === diminta) ?? daftar[0] ?? null
}

// ─── Tahsin ──────────────────────────────────────────────────────────────────

export interface SiswaSesiTahsin {
  id: string
  full_name: string
  kelas: string | null
  method_id: string | null
  jilid_id: string | null
  jilid_label: string | null
  total_halaman: number | null
  halaman: number | null
  drill_sejak: string | null
}

export async function getSiswaSesiTahsin(halaqohId: string): Promise<SiswaSesiTahsin[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select(
      'id, full_name, kelas, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak,' +
      ' jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages)',
    )
    .eq('halaqoh_id', halaqohId)
    .eq('is_active', true)
    .order('full_name')

  return ((data ?? []) as unknown as Array<{
    id: string; full_name: string; kelas: string | null
    current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null
    tahsin_drill_sejak: string | null
    jilid: { label: string; total_pages: number | null } | null
  }>).map(s => ({
    id: s.id,
    full_name: s.full_name,
    kelas: s.kelas,
    method_id: s.current_method_id,
    jilid_id: s.current_jilid_id,
    jilid_label: s.jilid?.label ?? null,
    total_halaman: s.jilid?.total_pages ?? null,
    halaman: s.current_jilid_page,
    drill_sejak: s.tahsin_drill_sejak,
  }))
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

export interface SiswaSesiTahfidz {
  id: string
  full_name: string
  kelas: string | null
  /** Setoran ziyadah terakhir — dasar isian awal surat & ayat berikutnya. */
  terakhir: { surat_id: number; surat: string; ayat_ke: number } | null
  /** Juz yang ziyadahnya tuntas tapi ujiannya belum diajukan (0065). */
  drill: JuzDrillSiswa[]
}

export async function getSiswaSesiTahfidz(halaqohId: string): Promise<SiswaSesiTahfidz[]> {
  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas')
    .eq('halaqoh_id', halaqohId)
    .eq('is_active', true)
    .order('full_name')
  const rows = (siswa ?? []) as { id: string; full_name: string; kelas: string | null }[]
  if (rows.length === 0) return []

  const drill = await getJuzDrillPerSiswa(rows.map(r => r.id))

  const { data: logs } = await supabase
    .from('tahfidz_logs')
    .select('student_id, surat_id, ayat_ke, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
    .in('student_id', rows.map(r => r.id))
    .eq('kind', 'ziyadah')
    .order('setoran_date', { ascending: false })
    .order('created_at', { ascending: false })

  const terakhir = new Map<string, SiswaSesiTahfidz['terakhir']>()
  for (const l of (logs ?? []) as unknown as Array<{
    student_id: string; surat_id: number; ayat_ke: number; surat: { name_latin: string } | null
  }>) {
    if (!terakhir.has(l.student_id)) {
      terakhir.set(l.student_id, { surat_id: l.surat_id, surat: l.surat?.name_latin ?? '', ayat_ke: l.ayat_ke })
    }
  }

  return rows.map(r => ({ ...r, terakhir: terakhir.get(r.id) ?? null, drill: drill.get(r.id) ?? [] }))
}
