/**
 * Uji aturan sprint bulanan — lib/tasks/sprint.ts. Murni, tanpa basis data.
 * Jalankan: npm run uji:sprint
 */
import {
  akhirPeriode, bolehDitutup, faseSprint, geserPeriode, labelPeriode, masukTengahSprint, menyentuhPeriode,
  parsePeriode, ringkasSprint, terbawaBerapaBulan,
} from '../lib/tasks/sprint'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

console.log('\n## Periode')
periksa(parsePeriode('2026-09') === '2026-09-01' && parsePeriode('2026-13') === null && parsePeriode(undefined) === null, 'parsePeriode menolak bulan tidak sah')
periksa(akhirPeriode('2026-02-01') === '2026-02-28' && akhirPeriode('2028-02-01') === '2028-02-29', 'akhir Februari biasa & kabisat')
periksa(geserPeriode('2026-12-01', 1) === '2027-01-01' && geserPeriode('2026-01-01', -1) === '2025-12-01', 'geser melewati pergantian tahun')
periksa(labelPeriode('2026-09-01') === 'September 2026', 'label periode')

console.log('\n## Fase')
periksa(faseSprint('2026-10-01', '2026-09-25', null) === 'perencanaan', 'bulan depan = perencanaan')
periksa(faseSprint('2026-09-01', '2026-09-30', null) === 'berjalan', 'hari terakhir bulan = masih berjalan')
periksa(faseSprint('2026-09-01', '2026-10-01', null) === 'menunggu_penutupan', 'lewat bulan, belum ditutup')
periksa(faseSprint('2026-09-01', '2026-09-10', '2026-09-30T10:00:00Z') === 'ditutup', 'ditutup mengalahkan tanggal')
periksa(!bolehDitutup('2026-09-01', '2026-09-27', null) && bolehDitutup('2026-09-01', '2026-09-28', null), 'penutupan baru terbuka 3 hari terakhir (28–30 Sep)')
periksa(!bolehDitutup('2026-09-01', '2026-10-05', '2026-10-01T00:00:00Z'), 'yang sudah ditutup tidak ditutup lagi')
periksa(!masukTengahSprint('2026-09-01', '2026-09-07') && masukTengahSprint('2026-09-01', '2026-09-08'), 'pekan pertama (1–7) = perencanaan awal; tanggal 8 = tengah sprint')
periksa(menyentuhPeriode({ start: '2026-08-20', end: '2026-09-02' }, '2026-09-01') && !menyentuhPeriode({ start: '2026-10-01', end: '2026-10-05' }, '2026-09-01'), 'batang yang menyentuh bulan sprint')

console.log('\n## Ringkasan')
const r = ringkasSprint([
  { poin: 3, status: 'done', tengahSprint: false },
  { poin: 2, status: 'submitted', tengahSprint: false },
  { poin: 1, status: 'in_progress', tengahSprint: true },
])
periksa(r.komitmenPoin === 6 && r.selesaiPoin === 3 && r.persen === 50, `poin: ${r.selesaiPoin}/${r.komitmenPoin} = ${r.persen}% (menunggu review belum dihitung selesai)`)
periksa(r.tengahSprint === 1 && r.jumlah === 3 && r.selesai === 1, 'jumlah tugas & yang masuk tengah sprint')
periksa(ringkasSprint([]).persen === null, 'tanpa komitmen → persen null, bukan 0%')

console.log('\n## Terbawa')
periksa(terbawaBerapaBulan('2026-09-01', [{ periode: '2026-08-01', selesai: false }, { periode: '2026-07-01', selesai: false }]) === 2, 'Jul & Agu tidak selesai → terbawa 2 bulan')
periksa(terbawaBerapaBulan('2026-09-01', [{ periode: '2026-07-01', selesai: false }]) === 0, 'Juli saja (Agustus absen) → rantai putus, 0')
periksa(terbawaBerapaBulan('2026-09-01', [{ periode: '2026-08-01', selesai: true }]) === 0, 'selesai di Agustus → tidak terbawa')
periksa(terbawaBerapaBulan('2026-09-01', [{ periode: '2026-07-01', selesai: false }, { periode: '2026-08-01', selesai: false }]) === 2, 'urutan masukan tidak berpengaruh')

console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
process.exitCode = gagal === 0 ? 0 : 1
