/**
 * Jalur yang pertemuannya berhari tetap: Tahsin Rekomendasi tiap Jum'at
 * sore (0115), Riyadhoh tiap Sabtu (0087). Murni, tanpa basis data — dipakai
 * server (validasi koreksi) maupun dialog (daftar pilihan tanggal).
 */

/** Jalur berhari tetap → hari dalam pekan (0 = Ahad … 6 = Sabtu). */
export const HARI_JALUR = { tr: 5, riyadhoh: 6 } as const
export type JalurBerhari = keyof typeof HARI_JALUR

export const NAMA_HARI_JALUR: Record<JalurBerhari, string> = { tr: 'Jum’at', riyadhoh: 'Sabtu' }

/** Hari dalam pekan untuk 'YYYY-MM-DD', tanpa terpengaruh zona waktu. */
export function hariDalamPekan(tanggal: string): number {
  const [y, m, d] = tanggal.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Tanggal sah untuk memindah setoran sebuah jalur: hari jalurnya di bulan
 * yang sama dengan tanggal asal, tidak melewati hari ini. Tanggal asal selalu
 * ikut, supaya pilihan awal dialog tetap sah walau datanya lama.
 */
export function tanggalJalurSebulan(jalur: JalurBerhari, asal: string, hariIni: string): string[] {
  const [y, m] = asal.split('-').map(Number)
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const hasil: string[] = []
  for (let d = 1; d <= akhir; d++) {
    const t = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (t > hariIni && t !== asal) break
    if (t === asal || hariDalamPekan(t) === HARI_JALUR[jalur]) hasil.push(t)
  }
  return hasil
}
