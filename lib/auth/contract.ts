/**
 * Masa berlaku kontrak guru.
 *
 * Guru kontrak RQ (OS) berganti hampir tiap tahun ajaran, jadi pencabutan
 * aksesnya tidak boleh bergantung pada ada yang ingat menonaktifkan satu per
 * satu. `contract_end` menjadi penentunya, dan dicek di dua tempat: saat
 * login (agar pesannya jelas) dan saat sesi diperiksa (agar sesi lama yang
 * masih hidup ikut gugur).
 */

/**
 * Tanggal hari ini sebagai 'YYYY-MM-DD' menurut waktu lokal server.
 *
 * `toISOString()` sengaja dihindari: ia mengubah ke UTC, sehingga sepanjang
 * malam di WIB (UTC+7) tanggalnya masih tanggal kemarin — kontrak yang
 * berakhir hari ini akan terhitung masih berlaku sampai pukul 07.00.
 */
export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Kontrak sudah lewat?
 *
 * `contract_end` kosong berarti tanpa batas — dipakai guru tetap yayasan.
 * Tanggalnya inklusif: pada hari terakhir kontrak, guru masih bisa masuk.
 */
export function isContractExpired(contractEnd: string | null | undefined): boolean {
  if (!contractEnd) return false
  return todayIso() > contractEnd
}

/** Sisa hari kontrak — negatif kalau sudah lewat, null kalau tanpa batas. */
export function contractDaysLeft(contractEnd: string | null | undefined): number | null {
  if (!contractEnd) return null
  const end = Date.parse(`${contractEnd}T00:00:00`)
  const today = Date.parse(`${todayIso()}T00:00:00`)
  return Math.round((end - today) / 86_400_000)
}
