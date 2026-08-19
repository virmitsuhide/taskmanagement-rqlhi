/**
 * Tangga level pembelajaran Al-Qur'an.
 *
 * Laporan Eksekutif menyusun capaian per angkatan sebagai sebaran siswa di
 * sepanjang tangga ini, lalu menghitung berapa yang sudah mencapai target
 * kelasnya. Supaya "mencapai target" bisa dihitung, levelnya harus BERURUT —
 * dan urutan di bawah diambil apa adanya dari tabel Kelas 3 pada laporan:
 * Jilid 4-6, lalu Al-Qur'an, Gharib, Tajwid, Tahfidz.
 */

export const LEVEL_LADDER = [
  'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6',
  "Al-Qur'an", 'Gharib', 'Tajwid', 'Tahfidz',
] as const

export type LevelName = (typeof LEVEL_LADDER)[number]

/** Posisi pada tangga, 1-based. 0 berarti tidak dikenali. */
export function levelOrder(level: string | null): number {
  if (!level) return 0
  const idx = (LEVEL_LADDER as readonly string[]).indexOf(level)
  return idx === -1 ? 0 : idx + 1
}

/**
 * Simpulkan level dari catatan bebas guru.
 *
 * Sumbernya tidak seragam sama sekali — "1 hal 2", "jilid 1 hal 2",
 * "Jilid 2 hal 23", "5 hal. 35", "3 hal 1 drill", "Qur'an T1", "Ghorib".
 * Karena itu dua masukan dipakai sekaligus: kolom `level` yang berisi
 * kategori kasar, dan `halaman` yang memuat nomor jilidnya.
 *
 * Kategori non-jilid menang atas angka, sebab siswa yang sudah di Al-Qur'an
 * kadang catatan halamannya masih menyebut nomor — dan menganggapnya jilid
 * akan melemparkannya mundur beberapa tingkat.
 */
export function parseLevel(level: string | null, halaman: string | null): LevelName | null {
  const kategori = (level ?? '').toLowerCase()
  const teks = (halaman ?? '').toLowerCase()
  const gabungan = `${kategori} ${teks}`

  if (/tahfi[dz]/.test(gabungan)) return 'Tahfidz'
  if (/tajwid/.test(gabungan)) return 'Tajwid'
  if (/gh?[ao]rib/.test(gabungan)) return 'Gharib'
  // "Qur'an", "Quran", "Qur'an T1" — apostrofnya bisa lurus atau melengkung.
  if (/qur.?.?an/.test(gabungan)) return "Al-Qur'an"

  // Sisanya jilid: ambil angka pertama yang masuk akal sebagai nomor jilid.
  // Angka setelah kata "hal" adalah halaman, bukan jilid, jadi dipotong dulu.
  const sebelumHalaman = teks.split(/\bhal\b|\bhalaman\b/)[0]
  const angka = Number(sebelumHalaman.match(/\d+/)?.[0] ?? kategori.match(/\d+/)?.[0])
  if (Number.isInteger(angka) && angka >= 1 && angka <= 6) return `Jilid ${angka}` as LevelName

  // Nama surat di kolom tahsin — "Al-Fajr", "Al-Muthaffifin (ayat 10)".
  // Anak yang bacaannya sudah berupa surat berarti membaca dari mushaf, jadi
  // levelnya Al-Qur'an. Bukan Tahfidz: kolom ini mengukur bacaan, bukan
  // hafalan, dan kolom `level`-nya sendiri sudah usang tertinggal di "Jilid".
  if (/\bayat\b/.test(teks) || /^(al|an|ar|as|asy|ash|at|adh|az)[\s-]/.test(teks.trim())) {
    return "Al-Qur'an"
  }

  return null
}

/** Apakah level siswa sudah memenuhi target kelasnya. */
export function mencapaiTarget(level: string | null, target: string | null): boolean {
  const a = levelOrder(level)
  const b = levelOrder(target)
  if (!a || !b) return false
  return a >= b
}

/** Sesuai target, melampaui, atau belum — dipakai mewarnai tabel. */
export function statusTarget(level: string | null, target: string | null): 'belum' | 'sesuai' | 'melampaui' | null {
  const a = levelOrder(level)
  const b = levelOrder(target)
  if (!a || !b) return null
  if (a > b) return 'melampaui'
  if (a === b) return 'sesuai'
  return 'belum'
}
