import type { Task } from '@/types'

/**
 * Penyaring "Fokus Kerja" di dashboard pengurus — murni, tanpa basis data.
 *
 * Kartu KPI lama menghitung "Mendesak" dan "Deadline Dekat" tapi tidak pernah
 * menghitung tugas yang SUDAH lewat tenggat. Akibatnya dashboard Koor SD bisa
 * menampilkan "Deadline dekat 0" di atas empat tugas yang terlambat 12–21 hari:
 * keadaan paling mendesak justru tak punya angka. Di sini terlambat jadi
 * golongan pertama, dan urutan daftar mendahulukannya.
 *
 * Semua hitungan tanggal memakai tanggal kalender WIB (YYYY-MM-DD) yang
 * diberikan pemanggil, bukan jam server — server Vercel berjalan di UTC, dan
 * tugas bertenggat hari ini tidak boleh jadi "terlambat" pukul 07.00 pagi.
 */

export type SaringTugas = 'semua' | 'terlambat' | 'pekan' | 'mendesak' | 'kendala' | 'review'

export const LABEL_SARING: Record<SaringTugas, string> = {
  semua: 'Semua',
  terlambat: 'Terlambat',
  pekan: '7 hari ke depan',
  mendesak: 'Prioritas tinggi',
  kendala: 'Ada kendala',
  review: 'Menunggu review',
}

/** Bentuk minimal yang dibutuhkan — cukup kolom tugas, tanpa relasi. */
type TugasMinimal = Pick<Task, 'status' | 'priority' | 'due_date'>

/** Selisih hari kalender dari `hariIni` ke tenggat; negatif = sudah lewat. Null bila tanpa tenggat. */
export function sisaHari(t: Pick<Task, 'due_date'>, hariIni: string): number | null {
  if (!t.due_date) return null
  const tenggat = t.due_date.slice(0, 10)
  return Math.round((Date.parse(`${tenggat}T00:00:00Z`) - Date.parse(`${hariIni}T00:00:00Z`)) / 86_400_000)
}

export function cocokSaring(t: TugasMinimal, saring: SaringTugas, hariIni: string): boolean {
  const sisa = sisaHari(t, hariIni)
  switch (saring) {
    case 'semua': return true
    // Tugas yang sudah diserahkan untuk review tidak lagi ditagih ke
    // pelaksananya — bolanya ada di pemberi tugas.
    case 'terlambat': return sisa !== null && sisa < 0 && t.status !== 'submitted'
    case 'pekan': return sisa !== null && sisa >= 0 && sisa <= 7
    case 'mendesak': return t.priority === 'high'
    case 'kendala': return t.status === 'problem'
    case 'review': return t.status === 'submitted'
  }
}

/**
 * Urutan baca: yang terlambat paling lama di atas, lalu tenggat terdekat,
 * lalu prioritas. Tugas tanpa tenggat di paling bawah — tidak ada tanggal
 * yang bisa mendahuluinya.
 */
export function urutkanFokus<T extends TugasMinimal>(daftar: T[], hariIni: string): T[] {
  const bobotPrioritas = { high: 0, middle: 1, low: 2 } as const
  return [...daftar].sort((a, b) => {
    const sa = sisaHari(a, hariIni)
    const sb = sisaHari(b, hariIni)
    if (sa === null && sb !== null) return 1
    if (sb === null && sa !== null) return -1
    if (sa !== null && sb !== null && sa !== sb) return sa - sb
    return bobotPrioritas[a.priority] - bobotPrioritas[b.priority]
  })
}

export interface RingkasanFokus<T> {
  hitung: Record<SaringTugas, number>
  /** Tugas yang lolos saringan, sudah diurutkan dan dipotong. */
  daftar: T[]
  /** Jumlah yang lolos saringan sebelum dipotong — untuk "+N lainnya". */
  totalTersaring: number
}

export function ringkasFokus<T extends TugasMinimal>(
  semua: T[],
  saring: SaringTugas,
  hariIni: string,
  batas = 8,
): RingkasanFokus<T> {
  const hitung = Object.fromEntries(
    (Object.keys(LABEL_SARING) as SaringTugas[]).map(k => [k, semua.filter(t => cocokSaring(t, k, hariIni)).length]),
  ) as Record<SaringTugas, number>
  const tersaring = urutkanFokus(semua.filter(t => cocokSaring(t, saring, hariIni)), hariIni)
  return { hitung, daftar: tersaring.slice(0, batas), totalTersaring: tersaring.length }
}

export function bacaSaring(nilai: string | undefined, boleh: SaringTugas[]): SaringTugas {
  return boleh.includes(nilai as SaringTugas) ? (nilai as SaringTugas) : 'semua'
}
