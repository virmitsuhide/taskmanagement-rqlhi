/**
 * Uji draf Pembaruan Sistem dari pesan commit — lib/rq/changelog-commit.ts.
 * Murni, tanpa basis data. Jalankan: npm run uji:changelog-commit
 */
import { drafDariCommit } from '../lib/rq/changelog-commit'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

const CO = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

console.log('\n## Dengan blok Pembaruan')
const lengkap = drafDariCommit([
  'feat(siswa): urut menurut capaian resmi & unduh capaian Excel',
  '',
  '- Logika baris dipindah ke lib/data/daftar-siswa.ts',
  '',
  'Pembaruan: Daftar siswa bisa diurutkan menurut capaian',
  'Pembaca: pengurus, guru',
  '- Ada pilihan "Urutkan" di halaman Siswa.',
  '- Tombol "Unduh Excel" menyimpan daftar yang tampil.',
  '',
  CO,
].join('\n'))
periksa(lengkap?.judul === 'Daftar siswa bisa diurutkan menurut capaian', 'judul dari baris Pembaruan')
periksa(lengkap?.jenis === 'baru', 'feat = Fitur baru')
periksa(JSON.stringify(lengkap?.untuk) === '["pengurus","guru"]', 'pembaca dari baris Pembaca')
periksa(lengkap?.isi === '- Ada pilihan "Urutkan" di halaman Siswa.\n- Tombol "Unduh Excel" menyimpan daftar yang tampil.', 'isi berhenti di trailer, catatan teknis tidak ikut')
periksa(lengkap?.sederhana === true, 'ditandai sudah sederhana')

const semua = drafDariCommit('fix(ujian): x\n\nPembaruan: Kartu ujian lebih rapi\nPembaca: semua\n')
periksa(semua?.untuk.length === 3 && semua.jenis === 'perbaikan', 'Pembaca: semua = tiga portal; fix = Perbaikan')

const tanpaPembaca = drafDariCommit('refactor(x): y\n\nPembaruan: Halaman lebih cepat dibuka\n')
periksa(tanpaPembaca !== null && tanpaPembaca.jenis === 'perubahan', 'blok Pembaruan membuat refactor tetap dikabarkan')
periksa(JSON.stringify(tanpaPembaca?.untuk) === '["pengurus"]', 'tanpa Pembaca = pengurus saja')

const salahKetik = drafDariCommit('feat: a\n\nPembaruan: B\nPembaca: wali\n')
periksa(JSON.stringify(salahKetik?.untuk) === '["pengurus"]', 'pembaca tak dikenal jatuh ke pengurus')

periksa(drafDariCommit('feat(x): y\n\nPembaruan: -\n') === null, 'Pembaruan: - = tidak dikabarkan')
periksa(drafDariCommit('feat(x): y\r\n\r\nPembaruan: Ada\r\n')?.judul === 'Ada', 'akhir baris CRLF')

console.log('\n## Tanpa blok')
const polos = drafDariCommit(`feat(ekstra): koor bisa mengaktifkan kembali halaqoh\n\nteknis\n\n${CO}`)
periksa(polos?.judul === 'Koor bisa mengaktifkan kembali halaqoh' && polos.isi === '' && !polos.sederhana, 'feat tanpa blok = draf berjudul subjek, isi kosong')
periksa(drafDariCommit('ci: naikkan actions ke v5') === null, 'ci dilewati')
periksa(drafDariCommit('chore(deps): bump') === null, 'chore dilewati')
periksa(drafDariCommit('Merge branch x') === null, 'merge dilewati')
periksa(drafDariCommit("revert: Pengumuman kembali") === null, 'revert tanpa blok dilewati')
periksa(drafDariCommit('perbaiki tombol') === null, 'subjek tanpa tipe dilewati')
periksa(drafDariCommit('﻿fix(ekstra): label hari')?.judul === 'Label hari', 'BOM di awal subjek')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
if (gagal) process.exit(1)
