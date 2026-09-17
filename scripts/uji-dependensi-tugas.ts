/**
 * Uji aturan dependensi antar tugas — lib/tasks/dependensi.ts.
 *
 * Murni, tanpa basis data. Jalankan: npm run uji:dependensi
 */
import { keadaanRelasi, membentukLingkaran, usulanGeser } from '../lib/tasks/dependensi'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

console.log('\n## Lingkaran')
const sisi = [
  { task_id: 'B', depends_on_id: 'A' }, // B menunggu A
  { task_id: 'C', depends_on_id: 'B' }, // C menunggu B
]
periksa(membentukLingkaran(sisi, 'A', 'C'), 'A menunggu C menutup lingkaran A←B←C←A')
periksa(membentukLingkaran(sisi, 'A', 'B'), 'A menunggu B menutup lingkaran langsung')
periksa(!membentukLingkaran(sisi, 'D', 'C'), 'D menunggu C aman')
periksa(!membentukLingkaran(sisi, 'C', 'A'), 'C juga menunggu A langsung — rantai ganda, bukan lingkaran')
periksa(membentukLingkaran([], 'X', 'X'), 'menunggu diri sendiri = lingkaran')
const bercabang = [
  { task_id: 'B', depends_on_id: 'A' }, { task_id: 'C', depends_on_id: 'A' },
  { task_id: 'D', depends_on_id: 'B' }, { task_id: 'D', depends_on_id: 'C' },
]
periksa(!membentukLingkaran(bercabang, 'E', 'D'), 'intan (A→B,C→D) tidak dianggap lingkaran')
periksa(membentukLingkaran(bercabang, 'A', 'D'), 'menutup intan dari bawah ke atas = lingkaran')

console.log('\n## Keadaan relasi (hari ini 2026-09-17)')
const H = '2026-09-17'
periksa(keadaanRelasi({ mulai: '2026-09-01' }, { status: 'done', tenggat: '2026-09-30' }, H) === 'selesai', 'penghambat selesai → selesai, apa pun tanggalnya')
periksa(keadaanRelasi({ mulai: '2026-10-05' }, { status: 'in_progress', tenggat: '2026-10-01' }, H) === 'aman', 'mulai sesudah tenggat penghambat → aman')
periksa(keadaanRelasi({ mulai: '2026-10-01' }, { status: 'in_progress', tenggat: '2026-10-01' }, H) === 'bentrok', 'mulai di hari tenggat penghambat → bentrok')
periksa(keadaanRelasi({ mulai: '2026-09-20' }, { status: 'todo', tenggat: '2026-10-01' }, H) === 'bentrok', 'mulai sebelum tenggat penghambat → bentrok')
periksa(keadaanRelasi({ mulai: '2026-09-17' }, { status: 'todo', tenggat: '2026-09-10' }, H) === 'bentrok', 'penghambat telat & belum selesai menghalangi hari ini')
periksa(keadaanRelasi({ mulai: '2026-09-25' }, { status: 'todo', tenggat: '2026-09-10' }, H) === 'aman', 'penghambat telat tapi yang menunggu baru mulai pekan depan → masih aman')
periksa(keadaanRelasi({ mulai: '2026-09-25' }, { status: 'todo', tenggat: null }, H) === 'tanpa_tenggat', 'penghambat tanpa tenggat tidak bisa dinilai')

console.log('\n## Usulan geser jadwal')
const g1 = usulanGeser({ start_date: '2026-09-20', due_date: '2026-09-25' }, '2026-10-01', H)
periksa(g1.start_date === '2026-10-02' && g1.due_date === '2026-10-07', `rentang 5 hari tetap 5 hari: ${g1.start_date}–${g1.due_date}`)
const g2 = usulanGeser({ start_date: null, due_date: '2026-10-20' }, '2026-10-01', H)
periksa(g2.start_date === '2026-10-02' && g2.due_date === '2026-10-20', `tanpa tanggal mulai, tenggat masih muat → tenggat dipertahankan (${g2.due_date})`)
const g3 = usulanGeser({ start_date: null, due_date: '2026-09-28' }, '2026-10-01', H)
periksa(g3.start_date === '2026-10-02' && g3.due_date === '2026-10-02', `tenggat sudah terlewati usulan mulai → ikut digeser (${g3.due_date})`)
const g4 = usulanGeser({ start_date: '2026-09-10', due_date: '2026-09-12' }, '2026-09-05', H)
periksa(g4.start_date === '2026-09-18', `penghambat telat → geser dari hari ini, bukan dari tenggat lamanya (${g4.start_date})`)
const g5 = usulanGeser({ start_date: '2026-09-20', due_date: null }, '2026-10-01', H)
periksa(g5.start_date === '2026-10-02' && g5.due_date === null, 'tanpa tenggat tetap tanpa tenggat')

console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
process.exitCode = gagal === 0 ? 0 : 1
