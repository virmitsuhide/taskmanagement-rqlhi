import { createServerClient } from '@/lib/supabase/server'
import { ambilPerPotong } from '@/lib/data/capaian-kelas'
import { canManageSetoran, canViewHalaqoh } from '@/lib/auth/permissions'
import type { Jenjang, UserRole } from '@/types'

/**
 * Bahan halaman /setoran — setoran sebulan dipilah per guru, untuk koordinator.
 *
 * Guru → halaqoh yang diampunya (wali + anggota halaqoh_teachers, sama
 * seperti portal guru), hanya halaqoh yang boleh dilihat role ini. Satu guru
 * bisa memegang beberapa sesi, jadi halaqoh tetap dipilih di bawah guru —
 * persis seperti Progres per Sesi di portal guru.
 */

export interface HalaqohGuru {
  id: string
  name: string
  sesi: number | null
  jenjang: Jenjang
  /** Tombol koreksi tampil; server tetap memeriksa ulang per siswa. */
  bisaSunting: boolean
}

export interface GuruSetoran {
  id: string
  nama: string
  halaqoh: HalaqohGuru[]
}

interface HalaqohRow {
  id: string
  name: string
  sesi: number | null
  jenjang: Jenjang
  program: string | null
  wali_teacher_id: string | null
  halaqoh_teachers: { teacher_id: string }[] | null
}

/** Satu baris rekap "Semua guru": kelengkapan capaian awal & akhir bulan satu halaqoh. */
export interface RekapIsianHalaqoh {
  halaqoh: HalaqohGuru
  /** Pengampu halaqoh (wali + anggota), untuk tautan ke rincian per guru. */
  pengampu: { id: string; nama: string }[]
  siswa: number
  awal: number
  akhir: number
  /** Awal DAN akhir terisi. */
  lengkap: number
  belumAwal: string[]
  belumAkhir: string[]
}

/**
 * Rekap pengisian Capaian Bulanan (student_monthly) semua halaqoh yang boleh
 * dilihat role ini, untuk pilihan "Semua guru" di /setoran.
 *
 * Terisi = kolom tahsin ATAU tahfidz-nya terisi (anak yang sudah lulus tahsin
 * hanya punya tahfidz) — sama dengan Analitik Halaqoh.
 */
export async function getRekapIsianBulanan(role: UserRole, periode: string): Promise<RekapIsianHalaqoh[]> {
  const daftarGuru = await getGuruSetoranKoor(role)
  const halaqoh = new Map<string, { h: HalaqohGuru; pengampu: { id: string; nama: string }[] }>()
  for (const g of daftarGuru) for (const h of g.halaqoh) {
    const x = halaqoh.get(h.id) ?? { h, pengampu: [] }
    x.pengampu.push({ id: g.id, nama: g.nama })
    halaqoh.set(h.id, x)
  }
  if (halaqoh.size === 0) return []

  const supabase = createServerClient()
  const ids = [...halaqoh.keys()]
  const siswa = await ambilPerPotong<{ id: string; full_name: string; halaqoh_id: string }>(ids, p => supabase.from('students')
    .select('id, full_name, halaqoh_id').in('halaqoh_id', p).eq('is_active', true).order('full_name'))
  const isian = await ambilPerPotong<{ student_id: string; halaman_awal_tahsin: string | null; tahfidz_awal: string | null; halaman_akhir_tahsin: string | null; tahfidz_akhir: string | null }>(
    siswa.map(s => s.id),
    p => supabase.from('student_monthly')
      .select('student_id, halaman_awal_tahsin, tahfidz_awal, halaman_akhir_tahsin, tahfidz_akhir')
      .in('student_id', p).eq('period', `${periode}-01`).order('student_id'),
  )
  const terisi = (...xs: (string | null)[]) => xs.some(x => !!x?.trim())
  const perSiswa = new Map(isian.map(r => [r.student_id, {
    awal: terisi(r.halaman_awal_tahsin, r.tahfidz_awal),
    akhir: terisi(r.halaman_akhir_tahsin, r.tahfidz_akhir),
  }]))

  const hasil: RekapIsianHalaqoh[] = []
  for (const [id, { h, pengampu }] of halaqoh) {
    const anak = siswa.filter(s => s.halaqoh_id === id)
    // Halaqoh semester lalu yang masih aktif tapi sudah tanpa anggota tidak ditampilkan.
    if (anak.length === 0) continue
    const st = anak.map(s => ({ nama: s.full_name, ...(perSiswa.get(s.id) ?? { awal: false, akhir: false }) }))
    hasil.push({
      halaqoh: h, pengampu, siswa: anak.length,
      awal: st.filter(s => s.awal).length,
      akhir: st.filter(s => s.akhir).length,
      lengkap: st.filter(s => s.awal && s.akhir).length,
      belumAwal: st.filter(s => !s.awal).map(s => s.nama),
      belumAkhir: st.filter(s => !s.akhir).map(s => s.nama),
    })
  }
  return hasil
}

export async function getGuruSetoranKoor(role: UserRole): Promise<GuruSetoran[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('halaqoh')
    .select('id, name, sesi, jenjang, program, wali_teacher_id, halaqoh_teachers(teacher_id)')
    .eq('is_active', true)
    .order('sesi')
    .order('name')

  const perGuru = new Map<string, HalaqohGuru[]>()
  for (const h of (data ?? []) as HalaqohRow[]) {
    if (!canViewHalaqoh(role, h.jenjang, h.program)) continue
    const item: HalaqohGuru = {
      id: h.id,
      name: h.name,
      sesi: h.sesi,
      jenjang: h.jenjang,
      bisaSunting: canManageSetoran(role, h.jenjang, h.program),
    }
    const pengampu = new Set<string>()
    if (h.wali_teacher_id) pengampu.add(h.wali_teacher_id)
    for (const ht of h.halaqoh_teachers ?? []) pengampu.add(ht.teacher_id)
    for (const t of pengampu) perGuru.set(t, [...(perGuru.get(t) ?? []), item])
  }
  if (perGuru.size === 0) return []

  const { data: guru } = await supabase
    .from('teachers')
    .select('id, full_name')
    .in('id', [...perGuru.keys()])
  return ((guru ?? []) as { id: string; full_name: string }[])
    .map(g => ({ id: g.id, nama: g.full_name, halaqoh: perGuru.get(g.id) ?? [] }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
