import { createServerClient } from '@/lib/supabase/server'
import { type PeriodKey, periodsYearToDate, toPeriodDate } from '@/lib/finance/period'
import { LEVEL_LADDER, mencapaiTarget, parseLevel } from '@/lib/rq/level'
import type { Jenjang } from '@/types'

/**
 * Capaian pembelajaran Al-Qur'an per angkatan — bahan bab 02 Laporan Eksekutif.
 *
 * Dua pertanyaan yang dijawab, keduanya per tingkat kelas:
 *   1. Berapa siswa yang mencapai target semester, dan bagaimana angkanya
 *      bergerak dari bulan ke bulan.
 *   2. Bagaimana sebaran siswa di sepanjang tangga level bulan ini.
 *
 * Levelnya disimpulkan dari catatan bulanan yang ditulis bebas oleh guru
 * (lihat lib/rq/level.ts). Baris yang tidak terbaca sengaja DIHITUNG TERPISAH,
 * bukan diabaikan diam-diam — persentase yang dihitung dari data tak lengkap
 * tanpa memberi tahu pembacanya lebih berbahaya daripada angka yang kosong.
 */

export interface AngkatanBulan {
  period: PeriodKey
  /** Siswa yang levelnya terbaca dan sudah mencapai target. */
  tercapai: number
  /** Siswa yang punya catatan bulan itu, terbaca maupun tidak. */
  tercatat: number
  percent: number
}

export interface AngkatanRow {
  jenjang: Jenjang
  tingkat: number
  totalSiswa: number
  targetTahsin: string
  targetJuz: number | null
  /** Pergerakan tiap bulan sejak Januari tahun berjalan. */
  bulanan: AngkatanBulan[]
  /** Sebaran siswa di tangga level pada bulan terpilih. */
  sebaran: { level: string; jumlah: number }[]
  /** Catatan bulan terpilih yang levelnya tidak terbaca. */
  takTerbaca: number
}

export interface KurikulumData {
  periods: PeriodKey[]
  rows: AngkatanRow[]
}

const EMPTY: KurikulumData = { periods: [], rows: [] }

/** Tingkat kelas dari teks bebas ('1A', '9C', '4.0') — hanya angkanya. */
function tingkatOf(kelas: string | null): number | null {
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** Ambil seluruh baris, menembus batas 1000 baris PostgREST. */
async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<T[]> {
  const SIZE = 1000
  const out: T[] = []
  for (let page = 0; page < 50; page++) {
    const { data, error } = await build().range(page * SIZE, page * SIZE + SIZE - 1)
    if (error) {
      console.error('[kurikulum] gagal mengambil data:', error)
      break
    }
    const batch = (data ?? []) as T[]
    out.push(...batch)
    if (batch.length < SIZE) break
  }
  return out
}

export async function getKurikulum(
  period: PeriodKey,
  jenjangScope: Jenjang[],
): Promise<KurikulumData> {
  if (jenjangScope.length === 0) return EMPTY

  try {
    const supabase = createServerClient()

    const { data: term } = await supabase
      .from('academic_terms').select('id').eq('is_current', true).maybeSingle()
    if (!term) return EMPTY

    const [students, targetRows] = await Promise.all([
      fetchAll<{ id: string; kelas: string | null; jenjang: Jenjang }>(
        () => supabase.from('students').select('id, kelas, jenjang')
          .eq('is_active', true).in('jenjang', jenjangScope),
      ),
      supabase.from('kurikulum_targets')
        .select('jenjang, tingkat, target_tahsin, target_juz')
        .eq('term_id', term.id),
    ])
    if (students.length === 0) return EMPTY

    const periods = periodsYearToDate(period)

    // Disaring per periode saja, bukan per student_id: ratusan UUID membuat
    // URL-nya melampaui batas dan permintaannya ditolak diam-diam.
    const monthly = await fetchAll<{
      student_id: string; period: string; level: string; halaman_akhir_tahsin: string
    }>(
      () => supabase.from('student_monthly')
        .select('student_id, period, level, halaman_akhir_tahsin')
        .in('period', periods.map(toPeriodDate)),
    )

    const target = new Map(
      ((targetRows.data ?? []) as {
        jenjang: string; tingkat: number; target_tahsin: string; target_juz: number | null
      }[]).map(t => [`${t.jenjang}|${t.tingkat}`, t]),
    )

    // Kelompokkan siswa per angkatan (jenjang + tingkat).
    const angkatan = new Map<string, { jenjang: Jenjang; tingkat: number; ids: Set<string> }>()
    for (const s of students) {
      const tingkat = tingkatOf(s.kelas)
      if (!tingkat) continue
      const key = `${s.jenjang}|${tingkat}`
      const e = angkatan.get(key) ?? { jenjang: s.jenjang, tingkat, ids: new Set<string>() }
      e.ids.add(s.id)
      angkatan.set(key, e)
    }

    const rows: AngkatanRow[] = [...angkatan.values()].map(a => {
      const t = target.get(`${a.jenjang}|${a.tingkat}`)
      const targetTahsin = t?.target_tahsin ?? ''

      const bulanan: AngkatanBulan[] = periods.map(p => {
        const catatan = monthly.filter(
          m => m.period.slice(0, 7) === p && a.ids.has(m.student_id),
        )
        const tercapai = catatan.filter(m =>
          mencapaiTarget(parseLevel(m.level, m.halaman_akhir_tahsin), targetTahsin),
        ).length
        return {
          period: p,
          tercapai,
          tercatat: catatan.length,
          // Persentase dihitung terhadap SELURUH siswa angkatan, bukan yang
          // tercatat saja — laporan menulisnya sebagai 40/79, dan penyebutnya
          // memang jumlah siswa. Bulan yang belum diisi wajar terlihat rendah.
          percent: a.ids.size ? Math.round((tercapai / a.ids.size) * 100) : 0,
        }
      })

      const bulanIni = monthly.filter(
        m => m.period.slice(0, 7) === period && a.ids.has(m.student_id),
      )
      const hitung = new Map<string, number>()
      let takTerbaca = 0
      for (const m of bulanIni) {
        const lv = parseLevel(m.level, m.halaman_akhir_tahsin)
        if (!lv) { takTerbaca++; continue }
        hitung.set(lv, (hitung.get(lv) ?? 0) + 1)
      }

      // Seluruh anak tangga ditampilkan walau nol, supaya bentuk tabelnya sama
      // tiap bulan dan pembaca bisa membandingkan sekilas.
      const sebaran = LEVEL_LADDER
        .map(level => ({ level, jumlah: hitung.get(level) ?? 0 }))
        .filter(s => s.jumlah > 0 || s.level === targetTahsin)

      return {
        jenjang: a.jenjang,
        tingkat: a.tingkat,
        totalSiswa: a.ids.size,
        targetTahsin,
        targetJuz: t?.target_juz ?? null,
        bulanan,
        sebaran,
        takTerbaca,
      }
    })

    rows.sort((a, b) => a.jenjang.localeCompare(b.jenjang) || a.tingkat - b.tingkat)

    return { periods, rows }
  } catch {
    return EMPTY
  }
}
