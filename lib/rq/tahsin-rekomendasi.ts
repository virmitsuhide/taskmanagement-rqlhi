/**
 * Tahsin Rekomendasi SDIT LHI (0115) — kelompok tahsin tambahan Jum'at sore.
 * Murni, tanpa DB.
 *
 * Tidak ada tabel jadwal: TR berjalan SETIAP Jum'at. Jum'at libur cukup
 * terbaca dari tidak adanya catatan sama sekali pada hari itu.
 */

/** Username akun bersama pengampu: TR1, TR2, … */
export const POLA_USERNAME_TR = /^TR(\d+)$/

/** Password awal akun TR — pengampunya bergantian, jadi satu sandi yang mudah. */
export const PASSWORD_AWAL_TR = 'bismillah'

/**
 * Seberapa jauh ke belakang pengampu masih boleh mencatat. Pencatatan sering
 * menyusul beberapa hari, tapi Jum'at dua bulan lalu yang baru diisi
 * sekarang lebih mungkin salah pilih tanggal daripada catatan yang tertunda.
 */
export const BATAS_MUNDUR_HARI = 56

const hari = (t: string) => {
  const [y, m, d] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const tambahHari = (t: string, n: number) =>
  new Date(hari(t).getTime() + n * 86400_000).toISOString().slice(0, 10)

/** Apakah 'YYYY-MM-DD' jatuh pada hari Jum'at. */
export function hariJumat(tanggal: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && hari(tanggal).getUTCDay() === 5
}

/** Jum'at terakhir yang sudah tiba (hari ini bila hari ini Jum'at). */
export function jumatTerakhir(hariIni: string): string {
  const mundur = (hari(hariIni).getUTCDay() - 5 + 7) % 7
  return tambahHari(hariIni, -mundur)
}

/** Semua Jum'at di [dari, sampai], urut naik. */
export function jumatDalamRentang(dari: string, sampai: string): string[] {
  const hasil: string[] = []
  const maju = (5 - hari(dari).getUTCDay() + 7) % 7
  for (let t = tambahHari(dari, maju); t <= sampai; t = tambahHari(t, 7)) hasil.push(t)
  return hasil
}

/** Jum'at yang boleh dicatat pengampu hari ini, terbaru dulu. */
export function jumatTerbuka(hariIni: string): string[] {
  return jumatDalamRentang(tambahHari(hariIni, -BATAS_MUNDUR_HARI), hariIni).reverse()
}

/** Nomor TR berikutnya dari username yang sudah ada. */
export function usernameTrBerikutnya(ada: string[]): string {
  const nomor = ada.map(u => Number(POLA_USERNAME_TR.exec(u)?.[1] ?? 0))
  return `TR${Math.max(0, ...nomor) + 1}`
}
