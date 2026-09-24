import { tingkatOf } from '@/lib/rq/sesi'

/**
 * Riyadhoh Qur'an SMP — sesi tambahan hari Sabtu (0087). Murni, tanpa DB.
 *
 * Peserta: seluruh kelas 9 SMP (termasuk QuLS) dan kelas 7–8 berprogram
 * QuLS. Putra dan putri masuk bergantian; koordinator SMP menentukan tiap
 * Sabtu milik kelompok mana.
 */

export type KelompokRiyadhoh = 'L' | 'P'

export const LABEL_KELOMPOK: Record<KelompokRiyadhoh, string> = { L: 'Putra', P: 'Putri' }

/** Program SMP yang termasuk QuLS — kelas 7–8-nya ikut Riyadhoh. */
export const PROGRAM_QULS_SMP = ['fullday_quls', 'boarding_quls']

/** Aturan bawaan peserta, sebelum pengecualian koordinator (riyadhoh_peserta). */
export function pesertaBawaan(s: { jenjang: string; kelas: string | null; program: string | null }): boolean {
  if (s.jenjang !== 'smp') return false
  const tingkat = tingkatOf(s.kelas)
  if (tingkat === 9) return true
  return (tingkat === 7 || tingkat === 8) && PROGRAM_QULS_SMP.includes(s.program ?? '')
}

/** Peserta akhir: pengecualian koordinator menang atas aturan bawaan. */
export function ikutRiyadhoh(
  s: { jenjang: string; kelas: string | null; program: string | null },
  pengecualian: boolean | undefined,
): boolean {
  return pengecualian ?? pesertaBawaan(s)
}

/** Semua Sabtu dalam sebulan, 'YYYY-MM-DD'. `bulan` = 'YYYY-MM'. */
export function sabtuDalamBulan(bulan: string): string[] {
  const [y, m] = bulan.split('-').map(Number)
  const hasil: string[] = []
  // Tanggal dihitung dengan UTC supaya zona waktu server tidak menggeser hari.
  for (let d = 1; d <= 31; d++) {
    const t = new Date(Date.UTC(y, m - 1, d))
    if (t.getUTCMonth() !== m - 1) break
    if (t.getUTCDay() === 6) hasil.push(t.toISOString().slice(0, 10))
  }
  return hasil
}

/** Apakah 'YYYY-MM-DD' jatuh pada hari Sabtu. */
export function hariSabtu(tanggal: string): boolean {
  const [y, m, d] = tanggal.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6
}

/**
 * Isi otomatis jadwal sebulan: bergantian mulai dari `mulai`, meneruskan
 * giliran dari Sabtu terakhir bulan sebelumnya bila diketahui — supaya
 * pergantian bulan tidak membuat satu kelompok masuk dua Sabtu berturut-turut.
 */
export function jadwalBergantian(
  sabtu: string[],
  sebelumnya: KelompokRiyadhoh | null,
  mulai: KelompokRiyadhoh = 'L',
): Record<string, KelompokRiyadhoh> {
  let giliran: KelompokRiyadhoh = sebelumnya ? (sebelumnya === 'L' ? 'P' : 'L') : mulai
  const hasil: Record<string, KelompokRiyadhoh> = {}
  for (const t of sabtu) {
    hasil[t] = giliran
    giliran = giliran === 'L' ? 'P' : 'L'
  }
  return hasil
}
