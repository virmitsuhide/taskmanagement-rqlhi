/**
 * Absensi harian — bagian murni (tanpa akses data).
 *
 * Kehadiran dicatat per pertemuan halaqoh, bukan diturunkan dari setoran:
 * anak yang datang tapi belum kebagian giliran setor tetap hadir. Alasan
 * lengkapnya ada di drizzle/0081.
 */

export const STATUS_ABSENSI = ['hadir', 'izin', 'sakit', 'alfa'] as const
export type StatusAbsensi = (typeof STATUS_ABSENSI)[number]

export const ABSENSI_META: Record<StatusAbsensi, { label: string; singkat: string; warna: string }> = {
  hadir: { label: 'Hadir', singkat: 'H', warna: 'var(--chart-2)' },
  izin: { label: 'Izin', singkat: 'I', warna: 'var(--chart-4)' },
  sakit: { label: 'Sakit', singkat: 'S', warna: 'var(--chart-3)' },
  alfa: { label: 'Alfa', singkat: 'A', warna: 'var(--destructive)' },
}

export interface RekapAbsensi {
  hadir: number
  izin: number
  sakit: number
  alfa: number
  /**
   * Pertemuan yang benar-benar terjadi bagi anak ini = jumlah baris absensinya.
   * Pertemuan yang tidak pernah diabsen tidak dihitung; lihat 0081.
   */
  total: number
}

export const REKAP_KOSONG: RekapAbsensi = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 }

export function hitungRekap(status: StatusAbsensi[]): RekapAbsensi {
  const r = { ...REKAP_KOSONG }
  for (const s of status) {
    r[s] += 1
    r.total += 1
  }
  return r
}

/**
 * Persentase kehadiran, dibulatkan. Anak yang belum punya satu pun pertemuan
 * mengembalikan null — bukan 0%, yang akan terbaca sebagai tidak pernah hadir.
 */
export function persenHadir(r: RekapAbsensi): number | null {
  if (r.total === 0) return null
  return Math.round((r.hadir / r.total) * 100)
}

/** "38 hadir · 2 izin · 1 sakit · 1 alfa" — ringkasan satu baris. */
export function ringkasRekap(r: RekapAbsensi): string {
  const bagian = STATUS_ABSENSI.filter(s => r[s] > 0).map(s => `${r[s]} ${ABSENSI_META[s].label.toLowerCase()}`)
  return bagian.length > 0 ? bagian.join(' · ') : 'Belum ada pertemuan'
}

/** Nama hari WIB untuk judul layar absensi, mis. "Senin, 21 September 2026". */
export function labelTanggalPanjang(iso: string): string {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}
