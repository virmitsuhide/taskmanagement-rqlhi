/**
 * Uji silang helper bacaan mushaf — tanpa database.
 *
 * Dijalankan manual: npx tsx scripts/uji-bacaan-quran.ts
 */
import { awalHalaman, halamanDariAyat, TOTAL_HALAMAN } from '@/lib/rq/batas-halaman'
import { periksaBacaanQuran, posisiLanjut, usulanDariHalaman } from '@/lib/rq/bacaan-quran'

let gagal = 0
function cek(nama: string, benar: boolean, keterangan = '') {
  if (!benar) { gagal++; console.error(`  ✗ ${nama}${keterangan ? ` — ${keterangan}` : ''}`) }
}

// 1) Halaman → posisi → halaman harus kembali ke halaman semula.
for (let h = 1; h <= TOTAL_HALAMAN; h++) {
  const p = awalHalaman(h)!
  cek(`bolak-balik hal ${h}`, halamanDariAyat(p.surat, p.ayat) === h,
    `${p.surat}:${p.ayat} → ${halamanDariAyat(p.surat, p.ayat)}`)
}

// 2) Usulan dari halaman = ayat pembuka halaman itu.
cek('usulan hal 1', JSON.stringify(usulanDariHalaman(1)) === JSON.stringify({ surat_id: 1, ayat_dari: 1 }))
cek('usulan hal 605 di luar mushaf', usulanDariHalaman(605) === null)

// 3) Validasi menolak yang salah, menerima yang benar.
const kosong = { halaman: null, surat_id: null, ayat_dari: null, ayat_ke: null }
cek('kosong + wajib ditolak', periksaBacaanQuran(kosong, { wajib: true }) !== null)
cek('kosong + tidak wajib lolos', periksaBacaanQuran(kosong, { wajib: false }) === null)
cek('ayat mundur ditolak',
  periksaBacaanQuran({ halaman: 2, surat_id: 2, ayat_dari: 5, ayat_ke: 3 }, { wajib: true }) !== null)
cek('ayat melebihi panjang surah ditolak',
  periksaBacaanQuran({ halaman: 604, surat_id: 112, ayat_dari: 1, ayat_ke: 12 }, { totalAyat: 4, wajib: true }) !== null)
cek('halaman tak cocok ditolak',
  periksaBacaanQuran({ halaman: 300, surat_id: 1, ayat_dari: 1, ayat_ke: 7 }, { totalAyat: 7, wajib: true }) !== null)
cek('bacaan melintas halaman diterima',
  periksaBacaanQuran({ halaman: 4, surat_id: 2, ayat_dari: 17, ayat_ke: 25 }, { totalAyat: 286, wajib: true }) === null)
cek('ayat_ke tanpa ayat_dari ditolak',
  periksaBacaanQuran({ halaman: 2, surat_id: 2, ayat_dari: null, ayat_ke: 5 }, { wajib: true }) !== null)

// 4) Posisi lanjut: ayat berikutnya, dan lompat surah saat habis.
const lanjut = posisiLanjut({ halaman: 2, surat_id: 2, ayat_dari: 1, ayat_ke: 5 }, 286)
cek('lanjut ke ayat berikutnya', lanjut.surat_id === 2 && lanjut.ayat === 6)
const habis = posisiLanjut({ halaman: 604, surat_id: 113, ayat_dari: 1, ayat_ke: 5 }, 5)
cek('surah habis → surah berikutnya', habis.surat_id === 114 && habis.ayat === 1,
  `${habis.surat_id}:${habis.ayat}`)
const mentok = posisiLanjut({ halaman: 604, surat_id: 114, ayat_dari: 1, ayat_ke: 6 }, 6)
cek('An-Nas tidak punya penerus', mentok.surat_id === 114 && mentok.ayat === 6)

console.log(gagal === 0 ? `✓ semua uji bacaan mushaf lolos (${TOTAL_HALAMAN} halaman diperiksa)` : `✗ ${gagal} uji gagal`)
process.exit(gagal === 0 ? 0 : 1)
