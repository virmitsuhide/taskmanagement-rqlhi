import type { PetaHalaman } from '@/lib/rq/target-tahfidz'
import { suratDilewati } from '@/lib/rq/rentang-surat'

/**
 * Halaman muroja'ah — berapa halaman mushaf yang dibaca ulang seorang anak.
 *
 * Diukur sebagai VOLUME BACA (keputusan RQ, Sep 2026): tiap setoran dijumlah
 * apa adanya. Al-Mulk dimuroja'ah tiga kali dalam sebulan = 3 × ±2,5 halaman,
 * bukan 2,5 — yang diukur adalah kerja muroja'ahnya, bukan luas hafalan yang
 * tersentuh. Luas hafalan sudah diukur total hafalan (rincianHafalan).
 *
 * Murni, tanpa basis data: peta halaman dioper pemanggil (getPetaHalaman).
 */

export type JenisMurojaah = 'baru' | 'lama'

/**
 * murojaah_baru / murojaah_lama, dan 'murojaah' dari sebelum keduanya
 * dipisah — yang oleh seluruh analitik sudah dibaca sebagai muroja'ah baru.
 */
export function jenisMurojaah(kind: string): JenisMurojaah | null {
  if (kind === 'murojaah_baru' || kind === 'murojaah') return 'baru'
  if (kind === 'murojaah_lama') return 'lama'
  return null
}

/** Nilai `kind` yang dibaca sebagai muroja'ah — untuk .in('kind', …). */
export const KIND_MUROJAAH = ['murojaah_baru', 'murojaah_lama', 'murojaah'] as const

export interface RentangSetoran {
  surat_id: number
  ayat_dari: number | null
  /** Surat akhir muroja'ah lintas surat (0076); null = satu surat. */
  surat_ke_id: number | null
  ayat_ke: number | null
}

/**
 * Halaman sebuah rentang setoran, lintas surat atau tidak. Aturan rentangnya
 * sama dengan lib/rq/rentang-surat.ts: surat awal dari ayat_dari sampai
 * habis, surat di antaranya utuh, surat akhir dari ayat 1 sampai ayat_ke —
 * maju atau mundur menurut nomor surat. Ayat yang kosong = surat utuh.
 */
export function halamanRentang(peta: PetaHalaman, r: RentangSetoran): number {
  if (r.surat_ke_id === null || r.surat_ke_id === r.surat_id) {
    const n = peta.panjang(r.surat_id)
    const a = r.ayat_dari ?? 1
    const b = r.ayat_ke ?? n
    return n ? peta.bobot(r.surat_id, Math.max(1, Math.min(a, b)), Math.min(n, Math.max(a, b))) : 0
  }
  const urut = suratDilewati(r.surat_id, r.surat_ke_id)
  let total = 0
  urut.forEach((s, i) => {
    const n = peta.panjang(s)
    if (!n) return
    const dari = i === 0 ? Math.max(1, r.ayat_dari ?? 1) : 1
    const ke = i === urut.length - 1 ? Math.min(n, r.ayat_ke ?? n) : n
    if (ke >= dari) total += peta.bobot(s, dari, ke)
  })
  return total
}

export interface RekapMurojaah {
  /** Halaman muroja'ah baru / lama (volume baca). */
  baru: number
  lama: number
  /** Berapa kali setor. */
  kaliBaru: number
  kaliLama: number
}

export const REKAP_MUROJAAH_KOSONG: RekapMurojaah = { baru: 0, lama: 0, kaliBaru: 0, kaliLama: 0 }

/** Rekap muroja'ah dari setoran tahfidz apa pun jenisnya — yang bukan muroja'ah dilewati. */
export function rekapMurojaah(peta: PetaHalaman, logs: (RentangSetoran & { kind: string })[]): RekapMurojaah {
  const r = { ...REKAP_MUROJAAH_KOSONG }
  for (const l of logs) {
    const jenis = jenisMurojaah(l.kind)
    if (!jenis) continue
    const h = halamanRentang(peta, l)
    if (jenis === 'baru') { r.baru += h; r.kaliBaru++ } else { r.lama += h; r.kaliLama++ }
  }
  return r
}

/** Rekap per siswa. */
export function rekapMurojaahPerSiswa(
  peta: PetaHalaman,
  logs: (RentangSetoran & { kind: string; student_id: string })[],
): Map<string, RekapMurojaah> {
  const per = new Map<string, (RentangSetoran & { kind: string })[]>()
  for (const l of logs) per.set(l.student_id, [...(per.get(l.student_id) ?? []), l])
  return new Map([...per].map(([id, ls]) => [id, rekapMurojaah(peta, ls)]))
}

/** "6,5" — satu angka desimal, tanpa ",0". */
export function angkaHalaman(n: number): string {
  const b = Math.round(n * 10) / 10
  return Number.isInteger(b) ? String(b) : b.toFixed(1).replace('.', ',')
}
