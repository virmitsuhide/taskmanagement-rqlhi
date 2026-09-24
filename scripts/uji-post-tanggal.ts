/**
 * Uji arti tanggal post beranda — lib/home/post-tanggal.ts. Murni, tanpa basis data.
 * Jalankan: npm run uji:post-tanggal
 */
import { labelTanggalPost, lewatTenggatPost } from '../lib/home/post-tanggal'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}

const tugas = (due_date: string | null) => ({ type: 'tugas_guru' as const, due_date })
const pengumuman = (due_date: string | null) => ({ type: 'pengumuman' as const, due_date })

console.log('\n## Label')
periksa(labelTanggalPost('tugas_guru') === 'Tenggat', 'tugas guru = Tenggat')
periksa(labelTanggalPost('pengumuman') === 'Waktu pelaksanaan', 'pengumuman = Waktu pelaksanaan')

console.log('\n## Lewat tenggat')
// 12 Okt 2026 pukul 09.00 WIB — dulu tenggat hari ini sudah "lewat" sejak 07.00.
const pagi = new Date('2026-10-12T09:00:00+07:00')
periksa(!lewatTenggatPost(tugas('2026-10-12'), pagi), 'tenggat hari ini belum lewat di pagi hari (WIB)')
periksa(!lewatTenggatPost(tugas('2026-10-12'), new Date('2026-10-12T23:59:00+07:00')), 'masih berlaku pukul 23.59 WIB')
periksa(lewatTenggatPost(tugas('2026-10-12'), new Date('2026-10-13T00:00:30+07:00')), 'lewat setelah tengah malam WIB')
periksa(lewatTenggatPost(tugas('2026-10-11'), pagi), 'tenggat kemarin = lewat')
periksa(!lewatTenggatPost(pengumuman('2026-10-01'), pagi), 'kegiatan yang sudah berlalu tidak pernah "lewat tenggat"')
periksa(!lewatTenggatPost(tugas(null), pagi), 'tugas tanpa tanggal tidak lewat')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
process.exit(gagal ? 1 : 0)
