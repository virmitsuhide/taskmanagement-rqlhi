import { createServerClient } from '@/lib/supabase/server'
import { type PeriodKey, periodsYearToDate, toPeriodDate } from '@/lib/finance/period'
import type { Jenjang } from '@/types'

/**
 * Kelengkapan pengisian capaian bulanan.
 *
 * Menjawab satu pertanyaan pengawasan: bulan ini, halaqoh mana yang gurunya
 * belum mengisi capaian anak-anaknya. Ini bukan penilaian mutu — hanya
 * kelengkapan administrasi, dan sengaja dibedakan antara "belum diisi sama
 * sekali" dengan "terisi sebagian", karena keduanya butuh tindakan berbeda.
 *
 * Yang dihitung sebagai TERISI adalah `halaman_akhir_tahsin`. Kolom awal
 * bisa terisi otomatis dari bulan sebelumnya lewat tombol salin, jadi
 * memakainya sebagai penanda akan membuat bulan yang belum dinilai sama
 * sekali terlihat sudah dikerjakan.
 */

export interface KelengkapanRow {
  halaqohId: string
  halaqohName: string
  jenjang: Jenjang
  sesi: number | null
  pengampu: string
  totalSiswa: number
  /** Siswa yang capaian akhir bulannya sudah diisi. */
  terisi: number
  percent: number
}

export interface KelengkapanBulan {
  period: PeriodKey
  totalSiswa: number
  terisi: number
  percent: number
}

export interface KelengkapanData {
  rows: KelengkapanRow[]
  /** Ringkas per bulan sepanjang tahun berjalan, untuk melihat pola. */
  trend: KelengkapanBulan[]
}

const EMPTY: KelengkapanData = { rows: [], trend: [] }

export async function getKelengkapan(
  period: PeriodKey,
  jenjangScope: Jenjang[],
): Promise<KelengkapanData> {
  if (jenjangScope.length === 0) return EMPTY

  try {
    const supabase = createServerClient()

    const { data: term } = await supabase
      .from('academic_terms').select('id').eq('is_current', true).maybeSingle()
    if (!term) return EMPTY

    const { data: halaqohRows } = await supabase
      .from('halaqoh')
      .select('id, name, jenjang, sesi, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(full_name)')
      .eq('term_id', term.id)
      .eq('is_active', true)
      .in('jenjang', jenjangScope)

    const halaqoh = (halaqohRows ?? []) as unknown as {
      id: string; name: string; jenjang: Jenjang; sesi: number | null
      wali_teacher: { full_name: string } | null
    }[]
    if (halaqoh.length === 0) return EMPTY

    // Ambil kolom seminimal mungkin dan naikkan batas baris secara eksplisit:
    // PostgREST memotong di 1000 baris tanpa memberi tahu, dan jumlah siswa
    // sudah mendekati angka itu.
    const { data: studentRows } = await supabase
      .from('students')
      .select('id, halaqoh_id')
      .eq('is_active', true)
      .in('halaqoh_id', halaqoh.map(h => h.id))
      .range(0, 4999)

    const students = (studentRows ?? []) as { id: string; halaqoh_id: string | null }[]
    if (students.length === 0) return EMPTY

    const halaqohOf = new Map(students.map(s => [s.id, s.halaqoh_id]))
    const studentIds = students.map(s => s.id)

    const periods = periodsYearToDate(period)

    // Sengaja TIDAK menyaring dengan .in('student_id', …): 694 UUID membuat
    // URL-nya melampaui batas dan PostgREST menolak dengan "Bad Request"
    // yang, karena dibungkus try/catch, tampak seperti "tidak ada data".
    // Menyaring per periode saja jauh lebih kecil, sisanya dicocokkan di
    // memori — jumlah barisnya hanya ribuan.
    const monthly = await fetchAll<{
      student_id: string; period: string; halaman_akhir_tahsin: string
    }>(
      () => supabase
        .from('student_monthly')
        .select('student_id, period, halaman_akhir_tahsin')
        .in('period', periods.map(toPeriodDate)),
    )

    const milikKita = new Set(studentIds)

    // Terisi untuk bulan yang diminta, dipetakan per halaqoh.
    const terisiBulanIni = new Set(
      monthly
        .filter(m => m.period.slice(0, 7) === period && m.halaman_akhir_tahsin.trim() && milikKita.has(m.student_id))
        .map(m => m.student_id),
    )

    const perHalaqoh = new Map<string, { total: number; terisi: number }>()
    for (const s of students) {
      if (!s.halaqoh_id) continue
      const e = perHalaqoh.get(s.halaqoh_id) ?? { total: 0, terisi: 0 }
      e.total += 1
      if (terisiBulanIni.has(s.id)) e.terisi += 1
      perHalaqoh.set(s.halaqoh_id, e)
    }

    const rows: KelengkapanRow[] = halaqoh.map(h => {
      const e = perHalaqoh.get(h.id) ?? { total: 0, terisi: 0 }
      return {
        halaqohId: h.id,
        halaqohName: h.name,
        jenjang: h.jenjang,
        sesi: h.sesi,
        pengampu: h.wali_teacher?.full_name ?? '—',
        totalSiswa: e.total,
        terisi: e.terisi,
        percent: e.total ? Math.round((e.terisi / e.total) * 100) : 0,
      }
    })

    // Paling mendesak lebih dulu: yang kosong sama sekali, lalu yang paling
    // sedikit terisi. Halaqoh tanpa siswa ditaruh di belakang — tidak ada
    // yang bisa dikerjakan gurunya di sana.
    rows.sort((a, b) => {
      if (a.totalSiswa === 0 && b.totalSiswa !== 0) return 1
      if (b.totalSiswa === 0 && a.totalSiswa !== 0) return -1
      return a.percent - b.percent || b.totalSiswa - a.totalSiswa
    })

    const trend: KelengkapanBulan[] = periods.map(p => {
      const terisi = monthly.filter(
        m => m.period.slice(0, 7) === p && m.halaman_akhir_tahsin.trim() && halaqohOf.has(m.student_id),
      ).length
      return {
        period: p,
        totalSiswa: students.length,
        terisi,
        percent: students.length ? Math.round((terisi / students.length) * 100) : 0,
      }
    })

    return { rows, trend }
  } catch {
    return EMPTY
  }
}

/**
 * Ambil seluruh baris sebuah query, menembus batas 1000 baris PostgREST.
 *
 * `.range(0, 19999)` tidak menolong: batas itu ditetapkan server (max-rows),
 * bukan oleh permintaan. Satu-satunya cara adalah meminta per halaman sampai
 * halaman terakhir tidak penuh. Tanpa ini, tabel yang tumbuh melewati seribu
 * baris akan diam-diam terpotong — persis jenis kesalahan yang tidak terlihat
 * sampai angkanya sudah dipakai mengambil keputusan.
 */
async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<T[]> {
  const SIZE = 1000
  const out: T[] = []

  for (let page = 0; page < 50; page++) {
    const { data, error } = await build().range(page * SIZE, page * SIZE + SIZE - 1)
    if (error) {
      console.error('[kelengkapan] gagal mengambil data:', error)
      break
    }
    const batch = (data ?? []) as T[]
    out.push(...batch)
    if (batch.length < SIZE) break
  }

  return out
}
