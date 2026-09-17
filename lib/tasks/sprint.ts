import { addDays, daysBetween } from '@/lib/tasks/gantt'
import type { TaskStatus, TaskWeight } from '@/types'

/**
 * Aturan sprint bulanan — murni, tanpa basis data. Lihat drizzle/0072.
 *
 * Semua tanggal 'YYYY-MM-DD'. `periode` selalu tanggal 1 bulan sprint.
 */

/** Bobot tugas → poin sprint. Satu sumber, supaya papan & laporan sepakat. */
export const POIN_BOBOT: Record<TaskWeight, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 }

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** '2026-09-17' atau '2026-09' → '2026-09-01'. */
export function periodeDari(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-01`
}

/** Terima '2026-09' dari query string; selain itu null. */
export function parsePeriode(nilai: string | undefined): string | null {
  return nilai && /^\d{4}-(0[1-9]|1[0-2])$/.test(nilai) ? `${nilai}-01` : null
}

export function labelPeriode(periode: string): string {
  return `${NAMA_BULAN[Number(periode.slice(5, 7)) - 1]} ${periode.slice(0, 4)}`
}

export function geserPeriode(periode: string, bulan: number): string {
  const y = Number(periode.slice(0, 4))
  const m = Number(periode.slice(5, 7)) - 1 + bulan
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** Tanggal terakhir bulan sprint. */
export function akhirPeriode(periode: string): string {
  return addDays(geserPeriode(periode, 1), -1)
}

/**
 *   perencanaan         bulannya belum mulai — goal & komitmen disusun
 *   berjalan            di dalam bulan itu
 *   menunggu_penutupan  bulannya lewat, Kepala RQ belum menutup
 *   ditutup             sudah dipotret; tidak bisa diubah lagi
 */
export type FaseSprint = 'perencanaan' | 'berjalan' | 'menunggu_penutupan' | 'ditutup'

export function faseSprint(periode: string, hariIni: string, ditutupAt: string | null): FaseSprint {
  if (ditutupAt) return 'ditutup'
  if (hariIni < periode) return 'perencanaan'
  if (hariIni <= akhirPeriode(periode)) return 'berjalan'
  return 'menunggu_penutupan'
}

/**
 * Sprint hanya boleh ditutup di tiga hari terakhir bulannya atau sesudahnya.
 * Menutup lebih awal memotret tugas yang masih punya waktu untuk selesai,
 * dan laporannya akan menyalahkan orang untuk hari yang belum datang.
 */
export function bolehDitutup(periode: string, hariIni: string, ditutupAt: string | null): boolean {
  return !ditutupAt && hariIni >= addDays(akhirPeriode(periode), -2)
}

/**
 * Penyanggupan setelah pekan pertama dihitung "masuk tengah sprint".
 *
 * Bukan hari pertama: rapat perencanaan RQ biasanya jatuh di pekan pertama
 * bulan berjalan, dan komitmen yang disusun di rapat itu adalah rencana
 * awal, bukan tambahan.
 */
export function masukTengahSprint(periode: string, tanggal: string): boolean {
  return daysBetween(periode, tanggal.slice(0, 10)) >= 7
}

/** Apakah rentang tugas menyentuh bulan sprint. */
export function menyentuhPeriode(range: { start: string; end: string }, periode: string): boolean {
  return range.start <= akhirPeriode(periode) && range.end >= periode
}

export interface ItemUntukRingkas {
  poin: number
  status: TaskStatus
  tengahSprint: boolean
}

export interface RingkasSprint {
  jumlah: number
  selesai: number
  komitmenPoin: number
  selesaiPoin: number
  /** Poin selesai / poin disanggupi, 0–100; null bila belum menyanggupi apa pun. */
  persen: number | null
  tengahSprint: number
}

/**
 * Ringkasan komitmen. "Selesai" berarti status 'done' — tugas yang menunggu
 * review ('submitted') belum dihitung, sebab di aplikasi ini verifikasi
 * pemberi tugas adalah bagian dari definisi selesai.
 */
export function ringkasSprint(items: ItemUntukRingkas[]): RingkasSprint {
  const selesaiItems = items.filter(i => i.status === 'done')
  const komitmenPoin = items.reduce((t, i) => t + i.poin, 0)
  const selesaiPoin = selesaiItems.reduce((t, i) => t + i.poin, 0)
  return {
    jumlah: items.length,
    selesai: selesaiItems.length,
    komitmenPoin,
    selesaiPoin,
    persen: komitmenPoin > 0 ? Math.round((selesaiPoin / komitmenPoin) * 100) : null,
    tengahSprint: items.filter(i => i.tengahSprint).length,
  }
}

/**
 * Berapa bulan berturut-turut, sebelum `periode`, sebuah tugas disanggupi
 * lalu tidak selesai.
 *
 * `riwayat` berisi sprint-sprint sebelumnya untuk tugas ini, terurut dari yang
 * paling baru. Rantai putus begitu ada bulan yang tidak memuat tugas ini —
 * tugas yang disanggupi Juni lalu dibiarkan Juli tidak "terbawa 2 bulan" di
 * Agustus.
 */
export function terbawaBerapaBulan(periode: string, riwayat: { periode: string; selesai: boolean }[]): number {
  let n = 0
  let harap = geserPeriode(periode, -1)
  for (const r of [...riwayat].sort((a, b) => b.periode.localeCompare(a.periode))) {
    if (r.periode !== harap || r.selesai) break
    n++
    harap = geserPeriode(harap, -1)
  }
  return n
}
