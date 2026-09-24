/**
 * Uji aturan Riyadhoh Sabtu — lib/rq/riyadhoh.ts. Murni, tanpa basis data.
 * Jalankan: npm run uji:riyadhoh
 */
import { hariSabtu, ikutRiyadhoh, jadwalBergantian, pesertaBawaan, sabtuDalamBulan } from '../lib/rq/riyadhoh'

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}
const smp = (kelas: string, program: string | null = 'reguler_fd') => ({ jenjang: 'smp', kelas, program })

console.log('\n## Peserta bawaan')
periksa(pesertaBawaan(smp('9A')) && pesertaBawaan(smp('9B', 'boarding_quls')), 'seluruh kelas 9 ikut, QuLS maupun reguler')
periksa(pesertaBawaan(smp('7A', 'fullday_quls')) && pesertaBawaan(smp('8C', 'boarding_quls')), 'QuLS kelas 7–8 ikut')
periksa(!pesertaBawaan(smp('7A')) && !pesertaBawaan(smp('8B', 'reguler_bd')), 'kelas 7–8 non-QuLS tidak ikut')
periksa(!pesertaBawaan({ jenjang: 'sd', kelas: '9', program: null }) && !pesertaBawaan(smp('')), 'bukan SMP / kelas kosong tidak ikut')
periksa(ikutRiyadhoh(smp('7A'), true) && !ikutRiyadhoh(smp('9A'), false) && ikutRiyadhoh(smp('9A'), undefined),
  'pengecualian koordinator menang atas aturan')

console.log('\n## Sabtu')
periksa(JSON.stringify(sabtuDalamBulan('2026-10')) === JSON.stringify(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']),
  'Oktober 2026: lima Sabtu')
periksa(sabtuDalamBulan('2026-02').length === 4 && sabtuDalamBulan('2026-02').every(hariSabtu), 'Februari: semua hari Sabtu')
periksa(hariSabtu('2026-10-03') && !hariSabtu('2026-10-04'), 'hariSabtu')

console.log('\n## Jadwal bergantian')
const okt = sabtuDalamBulan('2026-10')
const awal = jadwalBergantian(okt, null)
periksa(Object.values(awal).join('') === 'LPLPL', 'tanpa riwayat: mulai putra, bergantian')
periksa(Object.values(jadwalBergantian(okt, 'L')).join('') === 'PLPLP', 'meneruskan giliran bulan lalu (terakhir putra → putri dulu)')
periksa(Object.values(jadwalBergantian(sabtuDalamBulan('2026-11'), awal[okt[okt.length - 1]])).join('').startsWith('P'),
  'pergantian bulan tidak membuat kelompok yang sama masuk dua Sabtu berturut-turut')

console.log(gagal ? `\n${gagal} gagal` : '\nSemua lulus')
process.exit(gagal ? 1 : 0)
