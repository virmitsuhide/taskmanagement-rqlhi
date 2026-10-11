import { createServerClient } from '@/lib/supabase/server'
import { tanggalWIB } from '@/lib/rq/ujian'
import { BATAS_MUNDUR_HARI, hariJumat, tambahHari } from '@/lib/rq/tahsin-rekomendasi'

/**
 * Tahsin Rekomendasi SDIT LHI (0115) — kelompok, peserta, kehadiran Jum'at.
 * Lihat drizzle/0115_tahsin_rekomendasi_PASTE_TO_SUPABASE.sql.
 *
 * Pembaca di sini tahan terhadap 0115 yang belum dijalankan: tabel yang tidak
 * ada dibaca sebagai kosong, dan getKelompokTR mengembalikan null supaya
 * halaman koordinator bisa menampilkan petunjuk menjalankan migrasinya.
 */

export type StatusHadirTR = 'hadir' | 'izin' | 'sakit' | 'alfa'

export const hariIniTR = () => tanggalWIB(new Date())

// ─── Kelompok (pengampu) ─────────────────────────────────────────────────────

export interface KelompokTR {
  teacher_id: string
  username: string
  /** Nama pengampu yang sekarang memegang akun ini. */
  full_name: string
  gender: 'L' | 'P' | null
  tempat: string
  urutan: number
  aktif: boolean
}

const urutUsername = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true })

/** Semua kelompok TR, urut TR1, TR2, …  `null` = tabel 0115 belum ada. */
export async function getKelompokTR(): Promise<KelompokTR[] | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('tr_pengampu').select('teacher_id, tempat, urutan')
  if (error) return null
  const rows = (data ?? []) as { teacher_id: string; tempat: string; urutan: number }[]
  if (rows.length === 0) return []
  const { data: guru } = await supabase
    .from('teachers').select('id, username, full_name, gender, is_active').in('id', rows.map(r => r.teacher_id))
  const g = new Map(((guru ?? []) as { id: string; username: string; full_name: string; gender: 'L' | 'P' | null; is_active: boolean | null }[]).map(x => [x.id, x]))
  return rows
    .map(r => {
      const t = g.get(r.teacher_id)
      return {
        teacher_id: r.teacher_id, username: t?.username ?? '—', full_name: t?.full_name ?? '—', gender: t?.gender ?? null,
        tempat: r.tempat, urutan: r.urutan, aktif: t?.is_active !== false,
      }
    })
    .sort((a, b) => a.urutan - b.urutan || urutUsername(a.username, b.username))
}

/** Apakah guru ini pengampu (akun) Tahsin Rekomendasi. */
export async function punyaKelompokTR(teacherId: string): Promise<boolean> {
  const { data, error } = await createServerClient().from('tr_pengampu').select('teacher_id').eq('teacher_id', teacherId).maybeSingle()
  return !error && Boolean(data)
}

export async function getKelompokTRGuru(teacherId: string): Promise<KelompokTR | null> {
  if (!(await punyaKelompokTR(teacherId))) return null
  return (await getKelompokTR())?.find(k => k.teacher_id === teacherId) ?? null
}

// ─── Peserta ─────────────────────────────────────────────────────────────────

export interface PesertaTR {
  id: string
  full_name: string
  kelas: string | null
  gender: 'L' | 'P' | null
  halaqoh_name: string | null
  teacher_id: string
  capaian_awal: string
  /** Posisi tahsin sekarang, mis. "Jilid 2 hal. 31" — ikut maju oleh setoran sekolah maupun TR. */
  posisi: string | null
  drill: boolean
  lulus_tahsin: boolean
}

/** Peserta TR (aktif), semua kelompok atau satu kelompok. Urut kelas lalu nama. */
export async function getPesertaTR(teacherId?: string): Promise<PesertaTR[]> {
  const supabase = createServerClient()
  let q = supabase.from('tr_peserta').select('student_id, teacher_id, capaian_awal')
  if (teacherId) q = q.eq('teacher_id', teacherId)
  const { data, error } = await q
  if (error || !data?.length) return []
  const rows = data as { student_id: string; teacher_id: string; capaian_awal: string }[]

  const { data: siswa } = await supabase
    .from('students')
    .select('id, full_name, kelas, gender, is_active, current_jilid_page, tahsin_drill_sejak, halaqoh:halaqoh!students_halaqoh_id_fkey(name), jilid:jilid_levels!students_current_jilid_id_fkey(label, is_terminal, total_pages)')
    .in('id', rows.map(r => r.student_id))
  type Siswa = {
    id: string; full_name: string; kelas: string | null; gender: 'L' | 'P' | null; is_active: boolean | null
    current_jilid_page: number | null; tahsin_drill_sejak: string | null
    halaqoh: { name: string } | null; jilid: { label: string; is_terminal: boolean; total_pages: number | null } | null
  }
  const s = new Map(((siswa ?? []) as unknown as Siswa[]).map(x => [x.id, x]))

  return rows
    .flatMap(r => {
      const x = s.get(r.student_id)
      if (!x || x.is_active === false) return []
      const posisi = x.jilid
        ? x.jilid.is_terminal || !x.current_jilid_page || !x.jilid.total_pages
          ? x.jilid.label
          : `${x.jilid.label} hal. ${x.current_jilid_page}`
        : null
      return [{
        id: x.id, full_name: x.full_name, kelas: x.kelas, gender: x.gender, halaqoh_name: x.halaqoh?.name ?? null,
        teacher_id: r.teacher_id, capaian_awal: r.capaian_awal, posisi,
        drill: Boolean(x.tahsin_drill_sejak), lulus_tahsin: Boolean(x.jilid?.is_terminal),
      }]
    })
    .sort((a, b) => (a.kelas ?? '').localeCompare(b.kelas ?? '', 'id', { numeric: true }) || a.full_name.localeCompare(b.full_name, 'id'))
}

/** Siswa SDIT aktif yang belum masuk kelompok mana pun — pilihan tambah peserta. */
export async function getKandidatTR(): Promise<{ id: string; full_name: string; kelas: string | null }[]> {
  const supabase = createServerClient()
  const [siswaRes, ikutRes] = await Promise.all([
    supabase.from('students').select('id, full_name, kelas').eq('is_active', true).eq('jenjang', 'sd').order('kelas').order('full_name'),
    supabase.from('tr_peserta').select('student_id'),
  ])
  const ikut = new Set(((ikutRes.data ?? []) as { student_id: string }[]).map(r => r.student_id))
  return ((siswaRes.data ?? []) as { id: string; full_name: string; kelas: string | null }[]).filter(s => !ikut.has(s.id))
}

// ─── Akses setoran & kehadiran ───────────────────────────────────────────────

/**
 * Pengampu TR boleh mencatat seorang anak pada sebuah tanggal bila:
 * anak itu peserta kelompoknya, tanggalnya Jum'at yang sudah tiba, dan
 * tidak lebih dari BATAS_MUNDUR_HARI ke belakang.
 *
 * Dikunci ke Jum'at karena akun TR bukan guru anak itu di hari lain —
 * setoran yang ia catat di hari sekolah biasa akan terbaca sebagai setoran
 * halaqoh yang bukan miliknya.
 */
export async function bolehTR(teacherId: string, studentId: string, tanggal: string): Promise<boolean> {
  const hariIni = hariIniTR()
  if (!hariJumat(tanggal) || tanggal > hariIni || tanggal < tambahHari(hariIni, -BATAS_MUNDUR_HARI)) return false
  const supabase = createServerClient()
  const [pesertaRes, siswaRes] = await Promise.all([
    supabase.from('tr_peserta').select('teacher_id').eq('student_id', studentId).maybeSingle(),
    supabase.from('students').select('is_active').eq('id', studentId).maybeSingle(),
  ])
  const milik = pesertaRes.data as { teacher_id: string } | null
  if (pesertaRes.error || milik?.teacher_id !== teacherId) return false
  return (siswaRes.data as { is_active: boolean | null } | null)?.is_active !== false
}

// ─── Satu Jum'at ─────────────────────────────────────────────────────────────

export async function getHadirTR(tanggal: string, studentIds: string[]): Promise<Record<string, StatusHadirTR>> {
  if (studentIds.length === 0) return {}
  const { data } = await createServerClient().from('tr_hadir').select('student_id, status').eq('tanggal', tanggal).in('student_id', studentIds)
  return Object.fromEntries(((data ?? []) as { student_id: string; status: StatusHadirTR }[]).map(r => [r.student_id, r.status]))
}

export interface SetoranTR {
  teks: string
  status: string | null
  nilai: number | null
}

/** Setoran bertanda TR sekelompok anak pada satu Jum'at, urut waktu dicatat. */
export async function getSetoranTR(tanggal: string, studentIds: string[]): Promise<Map<string, SetoranTR[]>> {
  const hasil = new Map<string, SetoranTR[]>()
  if (studentIds.length === 0) return hasil
  const supabase = createServerClient()
  const [ts, suratRes] = await Promise.all([
    supabase.from('tahsin_logs')
      .select('student_id, halaman, baris_ke, status, nilai_tahsin, drill, quran_surat_id, quran_ayat_dari, quran_ayat_ke, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label, baca_quran)')
      .in('student_id', studentIds).eq('setoran_date', tanggal).eq('tahsin_rekomendasi', true).order('created_at'),
    supabase.from('surat_master').select('id, name_latin'),
  ])
  const surat = new Map(((suratRes.data ?? []) as { id: number; name_latin: string }[]).map(s => [s.id, s.name_latin]))
  for (const r of (ts.data ?? []) as unknown as {
    student_id: string; halaman: number | null; baris_ke: number | null; status: string | null; nilai_tahsin: number | null; drill: boolean | null
    quran_surat_id: number | null; quran_ayat_dari: number | null; quran_ayat_ke: number | null
    jilid: { label: string; baca_quran: boolean } | null
  }[]) {
    const quran = r.quran_surat_id
      ? `${surat.get(r.quran_surat_id) ?? ''} ${r.quran_ayat_dari ?? ''}${r.quran_ayat_ke && r.quran_ayat_ke !== r.quran_ayat_dari ? `–${r.quran_ayat_ke}` : ''}`.trim()
      : null
    const halaman = r.halaman ? `hal. ${r.halaman}${r.baris_ke ? ` s.d. baris ${r.baris_ke}` : ''}` : null
    const teks = [r.jilid?.label, r.drill ? 'drill' : null, r.jilid?.baca_quran && quran ? quran : halaman ?? quran].filter(Boolean).join(' ') || 'Tahsin'
    hasil.set(r.student_id, [...(hasil.get(r.student_id) ?? []), { teks, status: r.status, nilai: r.nilai_tahsin === null ? null : Number(r.nilai_tahsin) }])
  }
  return hasil
}
