import { createServerClient } from '@/lib/supabase/server'
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
