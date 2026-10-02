import { createServerClient } from '@/lib/supabase/server'
import type { Jenjang } from '@/types'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { getLevelPerSiswa } from '@/lib/data/asrama'
import type { LevelAsrama } from '@/lib/rq/asrama'
import { getJuzDrillPerSiswa, type JuzDrillSiswa } from '@/lib/data/drill-tahfidz'
import {
  getMateriPerJilid, getHasilMateriPerSiswa, type MateriTahsin, type HasilMateri,
} from '@/lib/data/materi-tahsin'

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
  /** Unit pemilik halaqoh — menentukan template rapor mana yang berlaku (0082). */
  jenjang: Jenjang
}

export async function getHalaqohSesiGuru(teacherId: string): Promise<HalaqohSesi[]> {
  const ids = await getTeacherHalaqohIds(teacherId)
  if (ids.length === 0) return []
  const supabase = createServerClient()
  const { data } = await supabase
    .from('halaqoh')
    .select('id, name, sesi, jenjang')
    .in('id', ids)
    .eq('is_active', true)
    .order('sesi')
  return (data ?? []) as HalaqohSesi[]
}

/** Pilih halaqoh dari query string bila milik guru, selain itu yang pertama. */
export function pilihHalaqoh(daftar: HalaqohSesi[], diminta: string | undefined): HalaqohSesi | null {
  return daftar.find(h => h.id === diminta) ?? daftar[0] ?? null
}

/**
 * Siapa yang disetor dalam satu sesi: anggota sebuah halaqoh (id-nya), atau
 * daftar siswa tertentu — peserta Riyadhoh Sabtu, yang bukan satu halaqoh.
 */
export type SasaranSesi = string | { siswa: string[] }

/** Saringan PostgREST untuk .or(); daftar kosong tidak mencocokkan siapa pun. */
function saringSasaran(sasaran: SasaranSesi): string {
  if (typeof sasaran === 'string') return `halaqoh_id.eq.${sasaran}`
  const ids = sasaran.siswa.filter(id => /^[0-9a-f-]{36}$/i.test(id))
  return ids.length > 0 ? `id.in.(${ids.join(',')})` : 'id.is.null'
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
  /** Tahap ini juga mencatat bacaan mushaf (semua tahap Al-Qur'an + Gharib/Tajwid). */
  baca_quran: boolean
  /** Posisi mushaf terakhir — titik berangkat isian berikutnya. */
  quran: { halaman: number | null; surat_id: number | null; ayat: number | null }
  /** Materi hafalan tahap ini; kosong berarti tahap ini disetor per halaman. */
  materi: MateriTahsin[]
  /** Keadaan terakhir tiap materi; materi yang belum pernah disetor tidak ada di sini. */
  materi_hasil: Record<string, HasilMateri>
  /**
   * Halaman sekarang belum tuntas (0109): setoran terakhir anak berstatus
   * Lanjut di halaman ini. baris_ke = baris terakhir yang sudah dibaca, null
   * bila guru tidak mengisinya. null = mulai halaman dari awal.
   */
  lanjut: { baris_ke: number | null } | null
  /** Level anak boarding (0110); null = bukan anak asrama / belum ditetapkan. */
  level: LevelAsrama | null
}

/**
 * Setoran Lanjut yang masih berlaku per anak: setoran TERAKHIR berstatus
 * lanjut dan masih di jilid & halaman posisi anak sekarang. Begitu ada
 * setoran lain sesudahnya, atau posisinya sudah bergeser, tidak berlaku lagi.
 *
 * Hanya 90 hari terakhir yang dilihat — halaman yang ditinggal lebih lama
 * dari itu memang sebaiknya dimulai dari awal lagi.
 */
export async function lanjutTerbuka(
  supabase: ReturnType<typeof createServerClient>,
  anak: { id: string; current_jilid_id: string | null; current_jilid_page: number | null }[],
): Promise<Map<string, { baris_ke: number | null }>> {
  const hasil = new Map<string, { baris_ke: number | null }>()
  if (anak.length === 0) return hasil
  const sejak = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('tahsin_logs')
    .select('student_id, jilid_id, halaman, status, baris_ke, drill')
    .in('student_id', anak.map(a => a.id))
    .gte('setoran_date', sejak)
    .order('setoran_date', { ascending: false })
    .order('created_at', { ascending: false })
  const posisi = new Map(anak.map(a => [a.id, a]))
  const sudah = new Set<string>()
  for (const l of (data ?? []) as {
    student_id: string; jilid_id: string | null; halaman: number | null
    status: string; baris_ke: number | null; drill: boolean | null
  }[]) {
    if (sudah.has(l.student_id)) continue
    sudah.add(l.student_id)
    const p = posisi.get(l.student_id)
    if (l.status === 'lanjut' && !l.drill && p && l.jilid_id === p.current_jilid_id && l.halaman === p.current_jilid_page) {
      hasil.set(l.student_id, { baris_ke: l.baris_ke })
    }
  }
  return hasil
}

export async function getSiswaSesiTahsin(sasaran: SasaranSesi): Promise<SiswaSesiTahsin[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select(
      'id, full_name, kelas, current_method_id, current_jilid_id, current_jilid_page, tahsin_drill_sejak,' +
      ' current_quran_halaman, current_quran_surat_id, current_quran_ayat,' +
      ' jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, baca_quran, is_terminal)',
    )
    .or(saringSasaran(sasaran))
    .eq('is_active', true)
    .order('full_name')

  const rows = ((data ?? []) as unknown as Array<{
    id: string; full_name: string; kelas: string | null
    current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null
    tahsin_drill_sejak: string | null
    current_quran_halaman: number | null; current_quran_surat_id: number | null; current_quran_ayat: number | null
    jilid: { label: string; total_pages: number | null; baca_quran: boolean; is_terminal: boolean } | null
  }>)
    // Anak yang sudah Lulus Tahsin tidak punya progres tahsin lagi untuk disetor.
    .filter(r => !r.jilid?.is_terminal)

  // Materi dan capaiannya diambil sekali untuk seluruh sesi, bukan per anak:
  // satu halaqoh umumnya berisi anak-anak pada tahap yang sama, sehingga
  // pengambilan per anak berarti mengulang jawaban yang identik belasan kali.
  const [perJilid, hasilMateri, lanjut, level] = await Promise.all([
    getMateriPerJilid(rows.map(r => r.current_jilid_id ?? '')),
    getHasilMateriPerSiswa(rows.map(r => r.id)),
    lanjutTerbuka(supabase, rows),
    getLevelPerSiswa(rows.map(r => r.id)),
  ])

  return rows.map(s => ({
    id: s.id,
    full_name: s.full_name,
    kelas: s.kelas,
    method_id: s.current_method_id,
    jilid_id: s.current_jilid_id,
    jilid_label: s.jilid?.label ?? null,
    total_halaman: s.jilid?.total_pages ?? null,
    halaman: s.current_jilid_page,
    drill_sejak: s.tahsin_drill_sejak,
    baca_quran: Boolean(s.jilid?.baca_quran),
    quran: {
      halaman: s.current_quran_halaman,
      surat_id: s.current_quran_surat_id,
      ayat: s.current_quran_ayat,
    },
    materi: perJilid.get(s.current_jilid_id ?? '') ?? [],
    materi_hasil: Object.fromEntries(hasilMateri.get(s.id) ?? []),
    lanjut: lanjut.get(s.id) ?? null,
    level: level.get(s.id) ?? null,
  }))
}

/** Satu pilihan jilid awal untuk anak yang belum punya posisi tahsin. */
export interface PilihanJilidAwal {
  id: string
  label: string
  total_halaman: number | null
  baca_quran: boolean
}

/**
 * Jilid yang boleh dipilih sebagai titik awal, per metode anak yang belum
 * punya jilid — supaya setoran pertamanya bisa lewat layar sesi, tidak harus
 * setor satu-satu.
 *
 * Tahap terminal (Lulus Tahsin) jelas bukan titik awal. Tahap berbasis materi
 * (Gharib/Tajwid UMMI) juga dikecualikan: isiannya butuh daftar materi yang
 * dimuat per anak, jadi anak yang mulai di sana tetap lewat setor satu-satu.
 */
export async function getPilihanJilidAwal(siswa: SiswaSesiTahsin[]): Promise<Record<string, PilihanJilidAwal[]>> {
  const metode = [...new Set(siswa.filter(s => !s.jilid_id && s.method_id).map(s => s.method_id!))]
  if (metode.length === 0) return {}
  const { data } = await createServerClient()
    .from('jilid_levels')
    .select('id, method_id, label, total_pages, baca_quran')
    .in('method_id', metode)
    .eq('is_terminal', false)
    .order('order_num')
  const baris = (data ?? []) as { id: string; method_id: string; label: string; total_pages: number | null; baca_quran: boolean }[]
  const berMateri = await getMateriPerJilid(baris.map(b => b.id))

  const hasil: Record<string, PilihanJilidAwal[]> = {}
  for (const b of baris) {
    if ((berMateri.get(b.id)?.length ?? 0) > 0) continue
    ;(hasil[b.method_id] ??= []).push({ id: b.id, label: b.label, total_halaman: b.total_pages, baca_quran: Boolean(b.baca_quran) })
  }
  return hasil
}

// ─── Tahfidz ─────────────────────────────────────────────────────────────────

export interface SiswaSesiTahfidz {
  id: string
  full_name: string
  kelas: string | null
  /** Unit siswa — menentukan arah juz 30 (akhirJuzArah). */
  jenjang: Jenjang | null
  /** Setoran ziyadah terakhir — dasar isian awal surat & ayat berikutnya. */
  terakhir: { surat_id: number; surat: string; ayat_ke: number } | null
  /** Juz yang ziyadahnya tuntas tapi ujiannya belum diajukan (0065). */
  drill: JuzDrillSiswa[]
  /** Level anak boarding (0110); null = bukan anak asrama / belum ditetapkan. */
  level: LevelAsrama | null
}

export async function getSiswaSesiTahfidz(sasaran: SasaranSesi): Promise<SiswaSesiTahfidz[]> {
  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas, jenjang')
    .or(saringSasaran(sasaran))
    .eq('is_active', true)
    .order('full_name')
  const rows = (siswa ?? []) as { id: string; full_name: string; kelas: string | null; jenjang: Jenjang | null }[]
  if (rows.length === 0) return []

  const [drill, level] = await Promise.all([
    getJuzDrillPerSiswa(rows.map(r => r.id)),
    getLevelPerSiswa(rows.map(r => r.id)),
  ])

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

  return rows.map(r => ({ ...r, terakhir: terakhir.get(r.id) ?? null, drill: drill.get(r.id) ?? [], level: level.get(r.id) ?? null }))
}
