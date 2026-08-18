import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { UNIT_ORDER } from '@/lib/rq/programs'

export interface HomeStats {
  /** Jumlah unit RQ (PAUD/TPAIT, SDIT, SD Juara, SMPIT, SMA). */
  units: number
  /** Guru/pengampu yang masih aktif. */
  pengampu: number
  /** Siswa yang masih aktif. */
  siswa: number
}

/**
 * Angka ringkas untuk hero beranda.
 *
 * Jumlah unit diambil dari taksonomi di kode, bukan dari `SELECT DISTINCT
 * jenjang` — unit yang belum punya siswa tetap harus terhitung, sama seperti
 * di Analitik RQ.
 *
 * Dihitung lewat `head: true` + `count`, jadi Postgres hanya mengembalikan
 * angkanya tanpa mengirim satu baris pun.
 */
export const getHomeStats = cache(async (): Promise<HomeStats> => {
  const units = UNIT_ORDER.length
  try {
    const supabase = createServerClient()
    const [teachersRes, studentsRes] = await Promise.all([
      supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])
    return {
      units,
      pengampu: teachersRes.count ?? 0,
      siswa: studentsRes.count ?? 0,
    }
  } catch {
    return { units, pengampu: 0, siswa: 0 }
  }
})
