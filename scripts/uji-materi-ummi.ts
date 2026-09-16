/**
 * Uji daftar materi Gharib & Tajwid — tanpa database.
 *
 * Daftarnya disalin tangan dari dokumen Word RQ LHI, dan itulah bagian yang
 * paling mungkin meleset. Yang diperiksa di sini bukan ejaannya (tidak ada
 * yang bisa memeriksa itu selain manusia), melainkan bentuknya: nomor berurut
 * tanpa lompatan, halaman tidak pernah mundur, tidak ada nama ganda, dan
 * jumlahnya cocok dengan panjang buku di jilid_levels.
 *
 * Jalankan: npm run uji:materi
 */
import { GHARIB, TAJWID, periksaMateri } from '@/lib/rq/materi-ummi'
import { ringkasProgres, type HasilMateri, type MateriTahsin } from '@/lib/data/materi-tahsin'

let gagal = 0
function cek(nama: string, benar: boolean, keterangan = '') {
  if (!benar) {
    gagal++
    console.error(`  ✗ ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

for (const [label, daftar, jumlah, halamanBuku] of [
  ['Gharib', GHARIB, 40, 28],
  ['Tajwid', TAJWID, 33, 20],
] as const) {
  cek(`${label}: bentuk daftar sah`, periksaMateri(label, [...daftar]).length === 0)
  cek(`${label}: ${jumlah} materi`, daftar.length === jumlah, `ditemukan ${daftar.length}`)

  const halamanTerbesar = Math.max(...daftar.map(m => m.halaman))
  // Halaman materi terakhir tidak boleh melewati tebal bukunya. Boleh KURANG:
  // halaman reviu/penguatan di ujung buku memang tidak punya materi.
  cek(
    `${label}: halaman materi <= ${halamanBuku} (tebal buku)`,
    halamanTerbesar <= halamanBuku,
    `materi terakhir di halaman ${halamanTerbesar}`,
  )

  // Halaman yang dilewati harus memang halaman tanpa materi baru — dicetak
  // supaya bisa dicocokkan sekilas dengan dokumen aslinya.
  const berisi = new Set(daftar.map(m => m.halaman))
  const kosong = Array.from({ length: halamanBuku }, (_, i) => i + 1).filter(h => !berisi.has(h))
  console.log(`  · ${label}: ${daftar.length} materi, halaman tanpa materi = ${kosong.join(', ') || '(tidak ada)'}`)
}

// Halaman tanpa materi yang diharapkan, menurut dokumen RQ LHI.
const kosongGharib = [14, 24, 25, 26, 27, 28]   // reviu + penguatan
const kosongTajwid = [4, 20]                     // latihan
for (const [label, daftar, harusKosong, halamanBuku] of [
  ['Gharib', GHARIB, kosongGharib, 28],
  ['Tajwid', TAJWID, kosongTajwid, 20],
] as const) {
  const berisi = new Set(daftar.map(m => m.halaman))
  const kosong = Array.from({ length: halamanBuku }, (_, i) => i + 1).filter(h => !berisi.has(h))
  cek(
    `${label}: halaman tanpa materi persis seperti dokumen`,
    kosong.join(',') === harusKosong.join(','),
    `diharapkan ${harusKosong.join(',')} — ditemukan ${kosong.join(',')}`,
  )
}

// ─── Aturan progres tiga-hasil ──────────────────────────────────────────────
const contoh: MateriTahsin[] = GHARIB.slice(0, 5).map((m, i) => ({
  id: `m${i + 1}`, nomor: m.nomor, halaman: m.halaman, nama: m.nama, keterangan: null,
}))
const keadaan = (pasangan: [string, HasilMateri][]) => new Map<string, HasilMateri>(pasangan)

const belumMulai = ringkasProgres(contoh, keadaan([]))
cek('belum mulai: berikutnya = materi pertama', belumMulai.berikutnya?.id === 'm1')
cek('belum mulai: belum tuntas', !belumMulai.tuntas && belumMulai.lulus === 0)

const semuaLulus = ringkasProgres(contoh, keadaan(contoh.map(m => [m.id, 'lulus'])))
cek('semua lulus: tuntas', semuaLulus.tuntas && semuaLulus.lulus === contoh.length)
cek('semua lulus: tidak ada berikutnya', semuaLulus.berikutnya === null)

/*
  Yang paling mudah salah: anak yang materi ke-2-nya BELUM SELESAI harus
  meneruskan materi itu, bukan melompat ke materi ke-3 yang belum tersentuh.
*/
const adaYangBerjalan = ringkasProgres(contoh, keadaan([['m1', 'lulus'], ['m2', 'lanjut']]))
cek('materi berjalan didahulukan', adaYangBerjalan.berikutnya?.id === 'm2',
  `ditemukan ${adaYangBerjalan.berikutnya?.id}`)
cek('lanjut tidak dihitung lulus', adaYangBerjalan.lulus === 1 && adaYangBerjalan.berjalan === 1)

const mengulang = ringkasProgres(contoh, keadaan([['m1', 'ulang']]))
cek('mengulang juga dihitung berjalan', mengulang.berjalan === 1 && mengulang.lulus === 0)
cek('mengulang didahulukan atas materi baru', mengulang.berikutnya?.id === 'm1')

// Tahap yang materinya belum diseed tidak boleh langsung "tuntas" — kalau ya,
// anaknya terlempar ke drill tanpa pernah menyetor apa pun.
cek('daftar kosong tidak pernah tuntas', !ringkasProgres([], keadaan([])).tuntas)

console.log(gagal === 0 ? '✓ semua uji materi lolos' : `✗ ${gagal} uji gagal`)
process.exit(gagal === 0 ? 0 : 1)
