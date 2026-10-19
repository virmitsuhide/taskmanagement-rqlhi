'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { isValidPeriod, shiftPeriod, toPeriodDate } from '@/lib/finance/period'
import { tanggalWIB } from '@/lib/rq/ujian'
import { UNIT_ORDER } from '@/lib/rq/programs'
import { ambilPerPotongSejajar } from '@/lib/data/capaian-kelas'
import { hitungRangkumanBulan, type SiswaRangkum } from '@/lib/data/rangkum-bulanan'
import type { Jenjang, UserRole } from '@/types'

/** Yang boleh merangkum seluruh halaqoh satu unit sekaligus. */
const BOLEH: UserRole[] = ['kumik', 'kepala_rq']
/** Halaqoh yang dirangkum bersamaan — tiap halaqoh menjalankan tujuh kueri. */
const SEKALIGUS = 4

export interface HasilRangkumKumik {
  error?: string
  /** Anak yang capaian akhirnya diisi dari setoran. */
  akhirDiisi?: number
  /** Anak yang capaian awalnya diisi dari akhir bulan lalu. */
  awalDiisi?: number
  /** Anak yang capaian akhirnya sudah diisi guru — dibiarkan. */
  akhirSudahAda?: number
}

interface BarisAda {
  student_id: string
  period: string
  halaman_awal_tahsin: string
  tahfidz_awal: string
  halaman_akhir_tahsin: string
  tahfidz_akhir: string
}

const ada = (...xs: (string | null | undefined)[]) => xs.some(x => !!x?.trim())

/**
 * Rangkum Capaian Bulanan seluruh halaqoh satu unit, untuk Kumik.
 *
 * Rumusnya sama persis dengan tombol "Rangkum dari setoran" guru
 * (hitungRangkumanBulan), dengan dua perbedaan:
 *
 *   HANYA MENGISI YANG KOSONG. Capaian akhir yang sudah diisi guru — diketik
 *   atau dirangkum sendiri — tidak ditimpa; capaian awal pun hanya diisi bila
 *   kedua kolomnya masih kosong. Kumik melengkapi, bukan mengoreksi.
 *
 *   CAPAIAN AWAL IKUT DIISI, dari capaian akhir bulan sebelumnya (seperti
 *   tombol salin milik guru), karena sejak Oktober 2026 checklist meminta
 *   awal & akhir bulan.
 *
 * recorded_by dibiarkan kosong: kolom itu menunjuk guru, dan baris yang
 * dirangkum Kumik memang tidak diisi oleh guru mana pun.
 */
export async function rangkumUnitKumikAction(jenjang: Jenjang, periodKey: string): Promise<HasilRangkumKumik> {
  const session = await getSession()
  if (!session || !BOLEH.includes(session.role)) return { error: 'Hanya Kumik yang dapat merangkum capaian seluruh unit.' }
  if (!UNIT_ORDER.includes(jenjang)) return { error: 'Unit tidak dikenali.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }
  if (periodKey > tanggalWIB(new Date()).slice(0, 7)) return { error: 'Bulan ini belum dimulai.' }

  const supabase = createServerClient()
  const [{ data: halaqohRows }, { data: siswaRows, error: errSiswa }] = await Promise.all([
    supabase.from('halaqoh').select('id').eq('is_active', true).eq('jenjang', jenjang),
    supabase.from('students')
      .select('id, full_name, halaqoh_id, jilid:jilid_levels!students_current_jilid_id_fkey(label, is_terminal)')
      .eq('is_active', true).eq('jenjang', jenjang).not('halaqoh_id', 'is', null)
      .limit(5000),
  ])
  if (errSiswa) return { error: errSiswa.message }
  const aktif = new Set(((halaqohRows ?? []) as { id: string }[]).map(h => h.id))
  const siswa = ((siswaRows ?? []) as unknown as (SiswaRangkum & { halaqoh_id: string })[])
    .filter(s => aktif.has(s.halaqoh_id))
  if (siswa.length === 0) return { error: 'Unit ini belum punya siswa di halaqoh aktif.' }

  const ids = siswa.map(s => s.id)
  const periode = toPeriodDate(periodKey)
  const periodeLalu = toPeriodDate(shiftPeriod(periodKey, -1))
  const barisAda = await ambilPerPotongSejajar<BarisAda>(ids, p => supabase.from('student_monthly')
    .select('student_id, period, halaman_awal_tahsin, tahfidz_awal, halaman_akhir_tahsin, tahfidz_akhir')
    .in('student_id', p).in('period', [periode, periodeLalu]).order('id'))
  const kini = new Map(barisAda.filter(b => b.period === periode).map(b => [b.student_id, b]))
  const lalu = new Map(barisAda.filter(b => b.period === periodeLalu).map(b => [b.student_id, b]))

  // ── Capaian akhir dari setoran, per halaqoh ──
  const perHalaqoh = new Map<string, SiswaRangkum[]>()
  for (const s of siswa) perHalaqoh.set(s.halaqoh_id, [...(perHalaqoh.get(s.halaqoh_id) ?? []), s])
  const kelompok = [...perHalaqoh.values()]
  const rangkuman = []
  for (let i = 0; i < kelompok.length; i += SEKALIGUS) {
    const hasil = await Promise.all(kelompok.slice(i, i + SEKALIGUS).map(k => hitungRangkumanBulan(supabase, k, periodKey)))
    rangkuman.push(...hasil.flat())
  }
  const sudahDiisiGuru = (id: string) => ada(kini.get(id)?.halaman_akhir_tahsin, kini.get(id)?.tahfidz_akhir)
  const akhir = rangkuman.filter(b => !sudahDiisiGuru(b.student_id))

  // ── Capaian awal dari akhir bulan lalu ──
  const sekarang = new Date().toISOString()
  const awal = siswa
    .filter(s => !ada(kini.get(s.id)?.halaman_awal_tahsin, kini.get(s.id)?.tahfidz_awal))
    .map(s => ({ s, l: lalu.get(s.id) }))
    .filter(({ l }) => ada(l?.halaman_akhir_tahsin, l?.tahfidz_akhir))
    .map(({ s, l }) => ({
      student_id: s.id,
      period: periode,
      halaman_awal_tahsin: l!.halaman_akhir_tahsin,
      tahfidz_awal: l!.tahfidz_akhir,
      updated_at: sekarang,
    }))

  if (akhir.length === 0 && awal.length === 0) {
    return { akhirDiisi: 0, awalDiisi: 0, akhirSudahAda: rangkuman.length - akhir.length }
  }

  // Dua upsert terpisah, masing-masing dengan kolom yang seragam: kolom yang
  // tidak disebut tetap seperti adanya (baris lama) atau bawaan '' (baris baru).
  if (akhir.length) {
    const { error } = await supabase.from('student_monthly').upsert(akhir, { onConflict: 'student_id,period' })
    if (error) return { error: error.message || 'Gagal menyimpan capaian akhir.' }
  }
  if (awal.length) {
    const { error } = await supabase.from('student_monthly').upsert(awal, { onConflict: 'student_id,period' })
    if (error) return { error: error.message || 'Gagal menyimpan capaian awal.' }
  }

  revalidatePath('/dashboard/analitik/halaqoh')
  revalidatePath('/guru/capaian')
  return { akhirDiisi: akhir.length, awalDiisi: awal.length, akhirSudahAda: rangkuman.length - akhir.length }
}
