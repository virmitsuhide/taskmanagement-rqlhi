import type { Jenjang } from '@/types'

/**
 * Sesi belajar Al-Qur'an — tiga gelombang per hari.
 *
 * Sesi ditentukan TINGKAT KELAS, bukan jenjang saja, dan urutannya bukan
 * urutan kelas: SD sesi 1 justru kelas 3 & 4, bukan kelas 1. Karena itu
 * pemetaannya ditulis apa adanya di sini alih-alih dihitung dari nomor kelas.
 */
export const SESI_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08.00', end: '09.00' },
  2: { start: '09.30', end: '10.30' },
  3: { start: '10.45', end: '11.45' },
}

/** Tingkat kelas per sesi, dipisah menurut jenjang. */
const SESI_KELAS: Record<'sd' | 'smp', Record<number, number[]>> = {
  sd: { 1: [3, 4], 2: [1, 2], 3: [5, 6] },
  smp: { 1: [9], 2: [7], 3: [8] },
}

/**
 * Sesi seorang siswa dari jenjang & kelasnya. Mengembalikan null kalau
 * kelasnya tidak terbaca — pemanggil yang memutuskan apa artinya.
 *
 * Kelas ditulis bebas di sumber data ('1A', '9C', bahkan '4.0' dari Excel),
 * jadi yang dipakai hanya angka pertamanya.
 */
export function sesiOf(jenjang: Jenjang | string, kelas: string | null): number | null {
  const tingkat = Number(String(kelas ?? '').match(/\d+/)?.[0])
  if (!tingkat) return null

  // SD Juara mengikuti pembagian SD.
  const group = jenjang === 'smp' || jenjang === 'sma' ? 'smp' : 'sd'
  for (const [sesi, tingkatList] of Object.entries(SESI_KELAS[group])) {
    if (tingkatList.includes(tingkat)) return Number(sesi)
  }
  return null
}

/** '08.00–09.00' */
export function sesiJam(sesi: number | null): string {
  const t = sesi ? SESI_TIMES[sesi] : null
  return t ? `${t.start}–${t.end}` : '—'
}

/** 'Sesi 1 · 08.00–09.00' */
export function sesiLabel(sesi: number | null): string {
  if (!sesi) return 'Tanpa sesi'
  return `Sesi ${sesi} · ${sesiJam(sesi)}`
}

/** Kelas apa saja yang masuk sesi ini, mis. 'kelas 3 & 4'. */
export function sesiKelasLabel(jenjang: Jenjang | string, sesi: number | null): string {
  if (!sesi) return ''
  const group = jenjang === 'smp' || jenjang === 'sma' ? 'smp' : 'sd'
  const list = SESI_KELAS[group][sesi]
  if (!list) return ''
  return `kelas ${list.join(' & ')}`
}
