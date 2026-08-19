/**
 * Uji penyimpulan capaian gukar terhadap standar kepegawaian.
 * Jalankan: npm run uji:gukar
 *
 * Kasus ujinya diambil apa adanya dari Laporan Eksekutif SDM Juni 2026 —
 * tabel bab 6.1 memuat sembilan orang beserta kesimpulan status yang sudah
 * disepakati manusia, jadi itulah patokan yang harus tetap cocok. Parser ini
 * menentukan siapa yang tampak siap diajukan jadi pegawai tetap, jadi
 * perubahannya perlu diuji ulang, bukan dipercaya begitu saja.
 *
 * Tidak menyentuh database sama sekali: murni fungsi lib/rq.
 */

import { hafalanDariTeks, surahTerjauh, predikatHafalan } from '../lib/rq/quran'
import { nilaiTahsin, nilaiTahfidz, statusTerhadapStandar } from '../lib/rq/gukar-standar'

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${nama}  → ${JSON.stringify(dapat)}${ok ? '' : ` (harap ${JSON.stringify(harap)})`}`)
}

console.log('── Tahsin (bab 6.1 laporan) ──')
const tahsinCases: [string, string, boolean][] = [
  ['Jilid 4', 'Jilid 4', false],
  ['Jilid 5', 'Jilid 5', false],
  ['Jilid 4 (drill)', 'Jilid 4', false],
  ['Jilid 6', 'Jilid 6', true],
  ['Al-Baqarah (mushaf)', "Al-Qur'an", true],
  ['Ghorib', 'Ghorib', true],
  ['Syajaroh 1 hal 32', 'Syajaroh', false],
  ['Jilid 2 Dewasa', 'Jilid 2', false],
  ["Al-Qur'an", "Al-Qur'an", true],
  ['AL QUR\'AN', "Al-Qur'an", true],
  ['JIlid 6 drill', 'Jilid 6', true],
  ['Tajwid', 'Tajwid', true],
  ['', '', false],
  ['(belum tercatat)', '', false],
  ['Tahfidz juz 29', '', false],
]
for (const [teks, tahap, memenuhi] of tahsinCases) {
  const hasil = nilaiTahsin('', teks)
  cek(`tahsin "${teks}"`, [hasil.tahap, hasil.memenuhi], [tahap, memenuhi])
}

console.log('\n── Surah terjauh ──')
cek('Al-Lahab–Al-Kafirun', surahTerjauh('Al-Lahab–Al-Kafirun')?.nama, 'Al-Kafirun')
cek('An-Naba', surahTerjauh("An-Naba'")?.nomor, 78)
cek('Al-Kautsar', surahTerjauh('Al-Kautsar')?.nomor, 108)
cek('Al-Kawthar', surahTerjauh('Al-Kawthar')?.nomor, 108)
cek('At-Takathur', surahTerjauh('At-Takathur')?.nomor, 102)
cek('Asy-Syams', surahTerjauh('Asy-Syams')?.nomor, 91)
cek('Ash-Shams', surahTerjauh('Ash-Shams')?.nomor, 91)
cek('Nuh', surahTerjauh('Nuh')?.nomor, 71)
cek('Al-Mursalat', surahTerjauh('Al-Mursalat')?.nomor, 77)
cek('Al-Mulk', surahTerjauh('Al-Mulk')?.nomor, 67)
cek('Al-Baqarah', surahTerjauh('Al-Baqarah')?.nomor, 2)
cek('bukan surah', surahTerjauh('Jilid 4 drill hal 12'), null)

console.log('\n── Tahfidz (bab 5.2 & 6.1 laporan) ──')
const tahfidzCases: [string, boolean][] = [
  ['Al-Buruj (Juz 30)', false],
  ['Al-Lail (Juz 30)', false],
  ['Al-Lahab–Al-Kafirun (Juz 30)', false],
  ['Nuh — selesai (Juz 29)', true],
  ['Persiapan ujian Juz 30 (± juz)', false],
  ['Juz 30 selesai', true],
  ["An-Naba'", true],
  ['Tahfidz juz 29', true],
  ['3 juz', true],
  ['', false],
]
for (const [teks, memenuhi] of tahfidzCases) {
  const hasil = nilaiTahfidz(null, null, null, 0, teks)
  cek(`tahfidz "${teks}"`, hasil.memenuhi, memenuhi)
}

console.log('\n── Kolom terstruktur menang atas teks bebas ──')
cek(
  'tahap terstruktur dipakai',
  nilaiTahsin('Tashih', 'Jilid 2').tahap,
  'Tashih',
)
cek(
  'juz terstruktur dipakai',
  nilaiTahfidz(2, 28, 88, 3, 'Al-Lail (Juz 30)').memenuhi,
  true,
)
cek('predikat 88', predikatHafalan(88), 'Jayyid Jiddan')
cek('predikat 96', predikatHafalan(96), 'Mumtaz')
cek('predikat 65', predikatHafalan(65), 'Maqbul')

console.log('\n── Status vs standar ──')
const reni = statusTerhadapStandar(
  nilaiTahsin('', 'Al-Baqarah (mushaf)'),
  nilaiTahfidz(null, null, null, 0, 'Al-Lahab–Al-Kafirun (Juz 30)'),
  '',
)
cek('Reni Hartati', reni.teks, 'Tahsin ✓ — perlu tuntaskan hafalan')

const annisa = statusTerhadapStandar(
  nilaiTahsin('', '(belum tercatat)'),
  nilaiTahfidz(null, null, null, 0, 'Nuh — selesai (Juz 29)'),
  '',
)
cek('Annisa Zulfa', annisa.teks, 'Tahfidz ✓ — perlu verifikasi tahsin')

const dewi = statusTerhadapStandar(
  nilaiTahsin('', 'Jilid 4'),
  nilaiTahfidz(null, null, null, 0, ''),
  '',
)
cek('Dewi Wulandari', dewi.teks, 'Perlu tahsin & tahfidz')

const quls = statusTerhadapStandar(
  nilaiTahsin('Tashih', ''),
  nilaiTahfidz(3, 27, 82, 3, ''),
  'guru_quran',
)
cek('Guru Quls terpenuhi', [quls.teks, quls.memenuhi], ['Memenuhi ambang', true])

const qulsKurang = statusTerhadapStandar(
  nilaiTahsin('Jilid 6', ''),
  nilaiTahfidz(1, 29, 80, 1, ''),
  'guru_quran',
)
cek('Guru Quls belum', qulsKurang.memenuhi, false)

const syajaroh = statusTerhadapStandar(
  nilaiTahsin('', 'Syajaroh 1 hal 32'),
  nilaiTahfidz(null, null, null, 0, ''),
  '',
)
cek('BPH Syajaroh', syajaroh.teks, 'Metode Syajaroh — di luar ambang UMMI')

console.log(`\n${gagal === 0 ? 'Semua uji lulus.' : `${gagal} uji GAGAL.`}`)
process.exit(gagal === 0 ? 0 : 1)
