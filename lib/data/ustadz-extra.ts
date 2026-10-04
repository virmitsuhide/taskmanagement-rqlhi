import { createServerClient } from '@/lib/supabase/server'
import { contractDaysLeft } from '@/lib/auth/contract'
import type { KategoriGuru, TeacherEmployment } from '@/types'

export type TeacherListStatus = 'active' | 'inactive' | 'deleted'

/** Baris ringan untuk penghitung — tanpa kolom tampilan. */
export interface BarisHitungGuru {
  id: string
  is_active: boolean
  deleted_at: string | null
  employment_type: TeacherEmployment | null
  contract_end: string | null
  kategori_guru?: KategoriGuru | null
}

export interface LingkupGuru {
  /** null = tidak dibatasi unit (manajemen). */
  unitTeacherIds: string[] | null
  unitScope: string[]
  query: string
  /** false bila kolom kategori_guru (0053) belum ada. */
  denganKategori: boolean
}

export function statusBaris(r: Pick<BarisHitungGuru, 'is_active' | 'deleted_at'>): TeacherListStatus {
  return r.deleted_at ? 'deleted' : r.is_active ? 'active' : 'inactive'
}

/**
 * Semua guru dalam lingkup penglihat (unit & pencarian sama persis dengan
 * daftar di /ustadz), TANPA saringan status maupun kategori — satu select
 * kolom ringan, dipakai menghitung angka chip dan kartu ringkasan.
 */
export async function getBarisHitungGuru(l: LingkupGuru): Promise<BarisHitungGuru[]> {
  const supabase = createServerClient()
  const kolom = 'id, is_active, deleted_at, employment_type, contract_end' + (l.denganKategori ? ', kategori_guru' : '')
  let q = supabase.from('teachers').select(kolom)
  if (l.query) q = q.or(`full_name.ilike.%${l.query}%,username.ilike.%${l.query}%,nip.ilike.%${l.query}%`)
  if (l.unitTeacherIds) {
    const unitFilter = l.unitScope.map(j => `unit.eq.${j}`).join(',')
    q = l.unitTeacherIds.length > 0
      ? q.or(`id.in.(${l.unitTeacherIds.join(',')}),${unitFilter}`)
      : q.or(unitFilter)
  }
  const { data, error } = await q.limit(5000)
  if (error) {
    console.error('[ustadz-extra] gagal memuat penghitung guru:', error)
    return []
  }
  return (data ?? []) as unknown as BarisHitungGuru[]
}

/**
 * Id guru yang mengampu minimal satu halaqoh aktif — sebagai wali
 * (halaqoh.wali_teacher_id) atau pengampu (halaqoh_teachers). Guru tahsin SMA
 * bukan wali halaqoh mana pun, tapi jelas sudah mengampu.
 */
export async function getPengampuHalaqohAktif(): Promise<Set<string>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('halaqoh')
    .select('wali_teacher_id, halaqoh_teachers(teacher_id)')
    .eq('is_active', true)
  const ids = new Set<string>()
  for (const h of (data ?? []) as { wali_teacher_id: string | null; halaqoh_teachers: { teacher_id: string }[] | null }[]) {
    if (h.wali_teacher_id) ids.add(h.wali_teacher_id)
    for (const t of h.halaqoh_teachers ?? []) ids.add(t.teacher_id)
  }
  return ids
}

export interface RingkasanGuru {
  total: number
  tetap: number
  kontrakYys: number
  kontrakRq: number
  kontrakMendesak: number
  belumMengampu: number
  belumKategori: number
}

export function ringkas(rows: BarisHitungGuru[], wali: Set<string>): RingkasanGuru {
  const r: RingkasanGuru = { total: rows.length, tetap: 0, kontrakYys: 0, kontrakRq: 0, kontrakMendesak: 0, belumMengampu: 0, belumKategori: 0 }
  for (const t of rows) {
    if (t.employment_type === 'tetap_yayasan') r.tetap++
    else if (t.employment_type === 'kontrak_yayasan') r.kontrakYys++
    else if (t.employment_type === 'kontrak_rq') r.kontrakRq++
    const d = contractDaysLeft(t.contract_end)
    if (d !== null && d <= 60) r.kontrakMendesak++
    if (!wali.has(t.id)) r.belumMengampu++
    if ('kategori_guru' in t && !t.kategori_guru) r.belumKategori++
  }
  return r
}
