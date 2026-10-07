import type { Jenjang } from '@/types'
import { ROMBEL_SMP } from '@/lib/rq/kelas'

/**
 * Kenaikan lintas unit LHI — bagian murni, dipakai pratinjau (klien) dan
 * pelaksanaan (server) supaya pilihan yang ditawarkan sama dengan yang sah.
 *
 *   TPAIT (TKB)        → SD LHI (1A…) atau SD LHI Juara (1)
 *   SD LHI / SD Juara 6 → SMPIT LHI (7A–7D)
 *   SMPIT LHI 9        → SMA LHI (10)
 *   SMA LHI 12         → alumni (dicentang dulu)
 */
export const UNIT_LANJUTAN: Record<Jenjang, Jenjang[]> = {
  paud: ['sd', 'sd_juara'],
  sd: ['smp'],
  sd_juara: ['smp'],
  smp: ['sma'],
  sma: [],
}

/**
 * Rombel SD LHI: empat per tingkat, A–D (ditetapkan RQ 2026-10-07).
 *
 * Rombel D adalah kelas QULS, dimulai angkatan yang kini kelas 1–3 dan
 * tumbuh satu tingkat tiap tahun (tahun depan 1D–4D, lalu 1D–5D). Program
 * anak ikut naik bersama kelasnya, jadi cukup anak BARU di kelas 1 yang
 * perlu ditetapkan: 1D QULS, 1A–1C CLIL. 4D/5D/6D angkatan lama tetap CLIL.
 */
export const ROMBEL_SD = ['A', 'B', 'C', 'D'] as const
export const ROMBEL_QULS_SD = 'D'

/**
 * Program SD tahun depan untuk anak yang NAIK di SD. QULS Takhassus — program
 * khusus untuk anak QULS di angkatan yang tak punya kelas QULS — berakhir:
 * anaknya kembali fokus akademik (CLIL). Selain itu program tetap.
 */
export function programNaikSd(program: string | null): string | null {
  return program === 'quls_takhassus' ? 'clil' : program
}

/**
 * Rombel SMP bawaan dari gender: fullday putra C, putri D. SD tidak punya
 * program boarding, jadi kumik tinggal menggantinya ke A/B untuk anak yang
 * masuk asrama.
 */
export function rombelSmpBawaan(gender: 'L' | 'P' | null): string {
  return gender === 'P' ? 'D' : 'C'
}

/** Kelas awal di unit tujuan. `rombel` hanya dipakai SD LHI & SMP. */
export function kelasAwalUnit(ke: Jenjang, rombel: string | null): string | null {
  if (ke === 'sd') return rombel ? `1${rombel}` : null
  if (ke === 'sd_juara') return '1'
  if (ke === 'smp') return rombel && ROMBEL_SMP[rombel] ? `7${rombel}` : null
  if (ke === 'sma') return '10'
  return null
}

/**
 * Program di unit tujuan. SMP mengikuti huruf rombel (A/B boarding, C/D
 * fullday) — keduanya dijaga galatRombelSmp — dan anak QULS SD tetap QULS.
 * SD LHI: 1D QULS, 1A–1C CLIL (lihat ROMBEL_SD).
 */
export function programLanjutan(ke: Jenjang, kelas: string, programLama: string | null): string | null {
  if (ke === 'smp') {
    const r = ROMBEL_SMP[kelas.slice(-1).toUpperCase()]
    // QULS Takhassus berakhir (fokus akademik) — lanjut sebagai reguler.
    const quls = programLama === 'quls'
    if (!r) return null
    return r.boarding ? (quls ? 'boarding_quls' : 'reguler_bd') : (quls ? 'fullday_quls' : 'reguler_fd')
  }
  if (ke === 'sd') return kelas.toUpperCase().endsWith(ROMBEL_QULS_SD) ? 'quls' : 'clil'
  if (ke === 'sd_juara') return 'reguler'
  if (ke === 'sma') return 'boarding'
  return null
}
