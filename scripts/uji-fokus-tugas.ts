/**
 * Uji penyaring Fokus Kerja dashboard pengurus — lib/tasks/fokus.ts. Murni, tanpa basis data.
 * Jalankan: npm run uji:fokus-tugas
 */
import { bacaSaring, cocokSaring, ringkasFokus, sisaHari, urutkanFokus } from '../lib/tasks/fokus'
import type { TaskPriority, TaskStatus } from '../types'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

const HARI_INI = '2026-09-23'
const t = (id: string, due_date: string | null, status: TaskStatus = 'todo', priority: TaskPriority = 'middle') =>
  ({ id, due_date, status, priority })

console.log('\n## Sisa hari')
periksa(sisaHari(t('a', '2026-09-23'), HARI_INI) === 0, 'tenggat hari ini = 0, belum terlambat')
periksa(sisaHari(t('a', '2026-09-02'), HARI_INI) === -21, 'lewat 21 hari')
periksa(sisaHari(t('a', '2026-09-30T00:00:00+00:00'), HARI_INI) === 7, 'timestamp dipotong ke tanggal')
periksa(sisaHari(t('a', null), HARI_INI) === null, 'tanpa tenggat = null')

console.log('\n## Saringan')
periksa(cocokSaring(t('a', '2026-09-22'), 'terlambat', HARI_INI), 'kemarin = terlambat')
periksa(!cocokSaring(t('a', '2026-09-23'), 'terlambat', HARI_INI), 'hari ini ≠ terlambat')
periksa(!cocokSaring(t('a', '2026-09-01', 'submitted'), 'terlambat', HARI_INI), 'sudah diserahkan tidak ditagih sebagai terlambat')
periksa(cocokSaring(t('a', '2026-09-30'), 'pekan', HARI_INI) && !cocokSaring(t('a', '2026-10-01'), 'pekan', HARI_INI), '7 hari ke depan inklusif')
periksa(cocokSaring(t('a', null, 'problem'), 'kendala', HARI_INI), 'status problem = ada kendala')

console.log('\n## Urutan & ringkasan')
const daftar = [
  t('tanpa', null, 'todo', 'high'),
  t('besok', '2026-09-24'),
  t('lama', '2026-09-02'),
  t('baru', '2026-09-20', 'todo', 'low'),
  t('baruHigh', '2026-09-20', 'todo', 'high'),
]
periksa(urutkanFokus(daftar, HARI_INI).map(x => x.id).join(',') === 'lama,baruHigh,baru,besok,tanpa',
  'terlambat terlama dulu, seri diputus prioritas, tanpa tenggat terakhir')
const r = ringkasFokus(daftar, 'terlambat', HARI_INI, 2)
periksa(r.hitung.terlambat === 3 && r.totalTersaring === 3 && r.daftar.length === 2, 'hitungan utuh walau daftar dipotong')
periksa(r.hitung.semua === 5 && r.hitung.mendesak === 2, 'hitungan per golongan')
periksa(bacaSaring('ngawur', ['semua', 'terlambat']) === 'semua' && bacaSaring('terlambat', ['semua', 'terlambat']) === 'terlambat', 'nilai URL tak dikenal jatuh ke "semua"')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
process.exit(gagal ? 1 : 0)
