import type { Jenjang } from '@/types'

/**
 * KERANGKA TARGET TAHSIN — nilai target per jenjang akan diisi menyusul oleh RQ LHI.
 *
 * Target TAHFIDZ tidak lagi di sini: ia sudah diturunkan dari rencana pekanan
 * tiap program menjadi target bulanan — lihat lib/rq/target-tahfidz.ts.
 */
export interface TahsinTarget {
  label: string       // mis. 'Jilid 6 UMMI' / 'Al-Qur\'an'
  order?: number      // order_num jilid target (untuk perbandingan)
}

// Diisi menyusul. null = target belum ditentukan → UI menampilkan status kosong.
export const TAHSIN_TARGETS: Record<Jenjang, TahsinTarget | null> = {
  paud: null,
  sd: null,
  sd_juara: null,
  smp: null,
  sma: null,
}
