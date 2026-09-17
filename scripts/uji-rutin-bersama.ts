/**
 * Uji aturan tugas rutin bersama — lib/rutin/bersama.ts. Murni, tanpa basis data.
 * Jalankan: npm run uji:rutin-bersama
 */
import { labelPengurus, pengurusDisebut, statusKonfirmasi } from '../lib/rutin/bersama'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

const pengurus = labelPengurus([
  { id: 'kepala', role: 'kepala_rq', display_name: 'Ridwan Fauzi' },
  { id: 'sdm', role: 'sdm', display_name: 'Rina Kartika' },
  { id: 'koorsd', role: 'koor_sd', display_name: 'Hendra' },
  { id: 'qulssd', role: 'koor_qulssd', display_name: 'Dhea' },
  { id: 'humas1', role: 'humas', display_name: 'Ayu Lestari' },
  { id: 'humas2', role: 'humas', display_name: 'Bima Sakti' },
])
const id = (teks: string) => pengurusDisebut(teks, pengurus).map(p => p.userId).sort().join(',')

console.log('\n## Label')
periksa(pengurus.find(p => p.userId === 'sdm')?.label === 'SDM', 'jabatan tunggal → label jabatan saja')
periksa(pengurus.find(p => p.userId === 'humas1')?.label === 'Humas (Ayu)', 'jabatan ganda → diberi nama depan')

console.log('\n## Sebutan @')
periksa(id("Rekrutmen guru Qur'an bersama @SDM") === 'sdm', '"bersama @SDM" → SDM')
periksa(id('rapat bersama @sdm dan @Koor SD') === 'koorsd,sdm', 'huruf kecil & dua sebutan')
periksa(id('evaluasi @Koor QULS SD') === 'qulssd', '"@Koor QULS SD" tidak ikut terbaca "@Koor SD"')
periksa(id('kirim ke sdm@contoh.id tanpa sebutan') === '', 'alamat email bukan sebutan')
periksa(id('bersama @SDMX') === '', '"@SDMX" bukan @SDM')
periksa(id('publikasi bersama @Humas (Bima)') === 'humas2', 'jabatan ganda dipilih lewat nama depan')
periksa(id('publikasi bersama @Humas') === '', '"@Humas" saja ambigu → tidak ada yang diajak')

console.log('\n## Status konfirmasi')
periksa(statusKonfirmasi(['kepala', 'sdm'], 'kepala', []) === 'menunggu', 'dua peserta, belum dikonfirmasi → menunggu')
periksa(statusKonfirmasi(['kepala', 'sdm'], 'kepala', [{ userId: 'sdm', keputusan: 'setuju' }]) === 'selesai', 'rekan setuju → selesai')
periksa(statusKonfirmasi(['kepala', 'sdm'], 'kepala', [{ userId: 'sdm', keputusan: 'tolak' }]) === 'ditolak', 'rekan menolak → ditolak')
periksa(statusKonfirmasi(['kepala', 'sdm', 'koorsd'], 'sdm', [{ userId: 'kepala', keputusan: 'setuju' }]) === 'menunggu', 'tiga peserta, baru satu setuju → masih menunggu')
periksa(statusKonfirmasi(['kepala', 'sdm', 'koorsd'], 'sdm', [{ userId: 'kepala', keputusan: 'setuju' }, { userId: 'koorsd', keputusan: 'tolak' }]) === 'ditolak', 'satu tolak cukup untuk ditolak')
periksa(statusKonfirmasi(['kepala'], 'kepala', []) === 'selesai', 'rekan sudah keluar semua → langsung selesai')
periksa(statusKonfirmasi(['kepala', 'sdm'], 'kepala', [{ userId: 'humas1', keputusan: 'tolak' }]) === 'menunggu', 'keputusan dari bukan peserta diabaikan')

console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
process.exitCode = gagal === 0 ? 0 : 1
