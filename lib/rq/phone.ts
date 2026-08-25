/**
 * Merapikan nomor HP menjadi bentuk internasional tanpa tanda baca.
 *
 * Nomor Indonesia ditulis bermacam-macam — 0812…, +62 812-…, 62812…, dan
 * kadang bersela atau bertanda hubung. WhatsApp hanya menerima bentuk
 * 62xxxxxxxxxx, jadi normalisasi dilakukan SEBELUM disimpan: kalau ditunda
 * sampai saat mengirim, tiap tempat yang memakai nomor ini harus mengulang
 * aturan yang sama dan salah satunya pasti ketinggalan.
 */
export function normalkanNomor(raw: string): string | null {
  const digit = raw.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (!digit) return null

  let n = digit
  if (n.startsWith('0')) n = '62' + n.slice(1)
  else if (n.startsWith('8')) n = '62' + n
  // Nomor Indonesia: 62 + 9..13 digit. Batas longgar disengaja — operator baru
  // memakai awalan yang belum tentu dikenal daftar mana pun.
  if (!/^62\d{8,13}$/.test(n)) return null
  return n
}
