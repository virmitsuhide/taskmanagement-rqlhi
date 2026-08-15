import type { Jenjang } from '@/types'

/**
 * KERANGKA TARGET — nilai target per jenjang akan diisi menyusul oleh RQ LHI.
 *
 * Target tahfidz dinyatakan sebagai satu milestone (mis. "Surat Al Bayyinah").
 * `juz` dipakai untuk membandingkan posisi anak (kasar, level juz). `suratId`
 * opsional untuk perbandingan lebih halus (level surat) saat target final.
 */
export interface TahfidzTarget {
  label: string       // teks target, mis. 'Surat Al Bayyinah'
  juz: number         // juz tempat target berada (untuk perbandingan posisi)
  suratId?: number    // opsional: surat spesifik
}

export interface TahsinTarget {
  label: string       // mis. 'Jilid 6 UMMI' / 'Al-Qur\'an'
  order?: number      // order_num jilid target (untuk perbandingan)
}

// Diisi menyusul. null = target belum ditentukan → UI menampilkan status kosong.
// Contoh saat final: paud: { label: 'Surat Al Bayyinah', juz: 30, suratId: 98 }
export const TAHFIDZ_TARGETS: Record<Jenjang, TahfidzTarget | null> = {
  paud: null,
  sd: null,
  sd_juara: null,
  smp: null,
  sma: null,
}

export const TAHSIN_TARGETS: Record<Jenjang, TahsinTarget | null> = {
  paud: null,
  sd: null,
  sd_juara: null,
  smp: null,
  sma: null,
}
