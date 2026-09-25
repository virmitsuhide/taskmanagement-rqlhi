import { SESI_TIMES } from '@/lib/rq/sesi'

/**
 * Menentukan sesi mengajar berikutnya dari daftar halaqoh seorang guru.
 *
 * Murni hitungan dari jam sesi yang sudah baku (lib/rq/sesi.ts) — tidak
 * membaca atau menulis apa pun ke basis data. Dipakai kartu "Sesi berikutnya"
 * di beranda guru dan layar Mulai sesi.
 */

export interface SesiTerjadwal<T> {
  halaqoh: T
  mulai: string
  selesai: string
  /** 'berjalan' = jam sekarang di dalam sesi; 'nanti' = hari ini, belum mulai;
   *  'besok' = semua sesi hari ini sudah lewat (atau hari libur). */
  kapan: 'berjalan' | 'nanti' | 'besok'
  /** Label hari untuk 'besok', mis. "Senin". */
  hariLabel?: string
}

function jamWIB(d: Date): string {
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).replace(':', '.')
}

function hariWIB(d: Date): number {
  // 0 = Ahad … 6 = Sabtu
  const nama = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Jakarta' })
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nama)
}

const HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function sesiBerikutnya<T extends { sesi: number | null }>(
  daftar: T[],
  sekarang: Date = new Date(),
): SesiTerjadwal<T> | null {
  const bersesi = daftar
    .filter(h => h.sesi && SESI_TIMES[h.sesi])
    .sort((a, b) => SESI_TIMES[a.sesi!].start.localeCompare(SESI_TIMES[b.sesi!].start))
  if (bersesi.length === 0) return null

  const jam = jamWIB(sekarang)
  const hari = hariWIB(sekarang)
  const hariBelajar = hari >= 1 && hari <= 5

  if (hariBelajar) {
    for (const h of bersesi) {
      const t = SESI_TIMES[h.sesi!]
      if (jam < t.start) return { halaqoh: h, mulai: t.start, selesai: t.end, kapan: 'nanti' }
      if (jam < t.end) return { halaqoh: h, mulai: t.start, selesai: t.end, kapan: 'berjalan' }
    }
  }

  // Semua sesi hari ini lewat, atau hari ini Sabtu/Ahad → sesi pertama hari belajar berikutnya.
  const besok = hari >= 5 || hari === 0 ? 1 : hari + 1
  const h = bersesi[0]
  const t = SESI_TIMES[h.sesi!]
  return {
    halaqoh: h, mulai: t.start, selesai: t.end, kapan: 'besok',
    hariLabel: besok === hari + 1 ? 'Besok' : HARI[besok],
  }
}
