/**
 * Menguji lib/rq/target-tahfidz.ts terhadap dua patokan yang disusun TERPISAH:
 *
 *   1. Indeks halaman mushaf (HALAMAN_JUZ) — bobot per ayat harus menjumlah
 *      tepat ke panjang juz yang sudah dipakai rapor.
 *   2. Kolom JUMLAH HALAMAN di lembar Data Induk berkas Excel RQ — materi yang
 *      disalin ke RENCANA harus menghasilkan beban yang sama dengan yang
 *      dihitung penyusun berkasnya.
 *
 * Jalankan: npm run uji:target-tahfidz
 *
 * Panjang surah dibaca dari surat_master, seperti uji:batas-juz.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { AWAL_JUZ_MUSHAF, halamanPerJuz } from '../lib/rq/halaman'
import {
  RENCANA, URUTAN_RENCANA, buatKurva, buatPetaHalaman, capaianSiswa, formatPosisi, kalenderBawaan,
  pilihRencana, posisiPada, progresKalender, semesterKurva, statusTerhadapTarget, targetHalaman,
  tindakLanjutMurojaah, type PetaHalaman,
} from '../lib/rq/target-tahfidz'

config({ path: '.env.local', quiet: true })

let gagal = 0
const periksa = (ok: boolean, pesan: string) => {
  console.log(`${ok ? '✓' : '✗'} ${pesan}`)
  if (!ok) gagal++
}
const dekat = (a: number, b: number, toleransi: number) => Math.abs(a - b) <= toleransi
const f = (n: number) => n.toFixed(2)

/** Beban satu juz menurut batas mushaf RQ, dijumlah dari bobot per ayat. */
function bobotJuz(peta: PetaHalaman, juz: number): number {
  const [s0, a0] = AWAL_JUZ_MUSHAF[juz - 1]
  const berikut = AWAL_JUZ_MUSHAF[juz]
  let total = 0
  for (let s = s0; s <= 114; s++) {
    for (let a = s === s0 ? a0 : 1; a <= peta.panjang(s); a++) {
      if (berikut && (s > berikut[0] || (s === berikut[0] && a >= berikut[1]))) return total
      total += peta.bobot(s, a, a)
    }
  }
  return total
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.from('surat_master').select('id, total_ayat')
  if (error || !data) { console.error('surat_master tidak terbaca:', error?.message); process.exitCode = 1; return }
  const peta = buatPetaHalaman(new Map(data.map(r => [r.id as number, r.total_ayat as number])))

  console.log('\n## Bobot halaman')
  let semua = 0
  for (let s = 1; s <= 114; s++) semua += peta.bobot(s, 1, peta.panjang(s))
  periksa(dekat(semua, 604, 1e-6), `seluruh mushaf = ${f(semua)} halaman (harus 604)`)
  for (const juz of [30, 29, 28, 27, 26, 1, 2, 3]) {
    const b = bobotJuz(peta, juz)
    periksa(dekat(b, halamanPerJuz(juz), 1), `juz ${juz} = ${f(b)} halaman · HALAMAN_JUZ ${halamanPerJuz(juz)}`)
  }

  console.log('\n## Beban tiap semester vs kolom JUMLAH HALAMAN di Data Induk')
  // Toleransinya tidak sama, dan itu disengaja.
  //
  // SDIT menghitung halaman langsung dari mushaf, dibulatkan ke ½ halaman —
  // 1,5 halaman sudah longgar. QuLS menurunkan halaman dari JUMLAH AYAT
  // ("perkiraan hasil konversi", kata lembar Panduan-nya), jadi semester yang
  // berisi surah berayat pendek (juz 30) atau panjang (Al-Baqarah) meleset
  // sampai tiga halaman dari mushaf yang sebenarnya — total setahunnya tetap
  // dekat. Kelengkapan materinya dijaga pemeriksaan "tidak ada ayat terlewat"
  // di bawah, yang tidak bergantung pada angka berkas sama sekali.
  const dataInduk: Record<string, { halaman: number[]; toleransi: number }> = {
    sd_clil: { halaman: [9, 4.5, 4.5, 5, 6.5, 5.5, 4.5, 6.75, 10.5, 6], toleransi: 1.5 },
    sd_quls: { halaman: [8.6, 7.3, 10.9, 9.5, 14.7, 12.5, 14.9, 13.1, 18.3, 16, 19.2, 18.4], toleransi: 3.5 },
  }
  for (const kode of ['sd_clil', 'sd_quls'] as const) {
    const kurva = buatKurva(RENCANA[kode], peta)
    const hafalan = kurva.semester.filter(s => s.jenis === 'hafalan')
    hafalan.forEach((s, i) => {
      const beban = s.akhir - s.mulai
      const berkas = dataInduk[kode].halaman[i]
      periksa(dekat(beban, berkas, dataInduk[kode].toleransi),`${kode} kelas ${s.tingkat} smt ${s.semester}: ${f(beban)} hal · berkas ${berkas} · ${f(s.laju)} hal/pekan`)
    })
  }

  console.log('\n## Total rencana & urutan juz')
  const harapanJuz: Record<string, number[]> = {
    sd_clil: [30, 29, 28],
    sd_quls: [30, 29, 28, 27, 26, 1, 2, 3],
    smp_internal: [30, 29, 28, 27, 26, 1],
    smp_eksternal: [30, 29, 28, 27],
  }
  for (const kode of URUTAN_RENCANA) {
    const kurva = buatKurva(RENCANA[kode], peta)
    const urutan = kurva.akhirJuz.map(j => j.juz)
    periksa(
      JSON.stringify(urutan) === JSON.stringify(harapanJuz[kode]),
      `${kode}: juz ${urutan.join(', ')} · total ${f(kurva.total)} hal`,
    )
    // Tiap juz dalam rencana harus tuntas utuh — materi yang terlewat akan
    // membuat total lebih kecil dari jumlah panjang juz-nya.
    const penuh = harapanJuz[kode].reduce((t, j) => t + bobotJuz(peta, j), 0)
    const kurangAlFatihah = kode === 'smp_internal' ? peta.bobot(1, 1, 7) : 0
    periksa(dekat(kurva.total, penuh - kurangAlFatihah, 1e-6), `${kode}: tidak ada ayat yang terlewat atau terhitung dua kali`)
  }

  console.log('\n## Kalender')
  const kal = kalenderBawaan('2026/2027')
  periksa(kal.filter(b => b.semester === 1).reduce((t, b) => t + b.pekan, 0) === 18, 'ganjil bawaan 18 pekan')
  periksa(kal.filter(b => b.semester === 2).reduce((t, b) => t + b.pekan, 0) === 15, 'genap bawaan 15 pekan')
  const desember = progresKalender(kal, '2026-12-31', true)
  periksa(desember.semester === 1 && dekat(desember.fraksi, 1, 1e-9), 'akhir Desember = ganjil selesai')
  const juli = progresKalender(kal, '2026-07-15', true)
  periksa(dekat(juli.fraksi, 2 / 18, 1e-9), `akhir Juli = 2/18 ganjil (${f(juli.fraksi)})`)
  const tengahSep = progresKalender(kal, '2026-09-15')
  periksa(dekat(tengahSep.fraksi, (6 + 4 * 0.5) / 18, 1e-9), `15 September diprorata = 8/18 (${f(tengahSep.fraksi)})`)
  periksa(progresKalender(kal, '2027-08-01').fraksi === 1, 'setelah Juni = genap selesai')

  console.log('\n## Contoh: QuLS kelas I, target akhir bulan (kalender bawaan)')
  const quls = buatKurva(RENCANA.sd_quls, peta)
  for (const b of kal) {
    const t = targetHalaman(quls, 1, progresKalender(kal, `${b.bulan}-01`, true))!
    console.log(`  ${b.bulan}  s.d. ${formatPosisi(posisiPada(quls, peta, t.halaman), peta).padEnd(22)} ${f(t.halaman)} hal`)
  }
  const akhirMei = targetHalaman(quls, 1, progresKalender(kal, '2027-05-31', true))!
  periksa(formatPosisi(posisiPada(quls, peta, akhirMei.halaman), peta) === 'Al-Mutaffifin' || akhirMei.halaman <= semesterKurva(quls, 1, 2)!.akhir,
    `akhir Mei belum melewati akhir materi kelas I (${formatPosisi(posisiPada(quls, peta, akhirMei.halaman), peta)})`)
  const akhirJuni = targetHalaman(quls, 1, progresKalender(kal, '2027-06-30', true))!
  periksa(formatPosisi(posisiPada(quls, peta, akhirJuni.halaman), peta) === 'Al-Mutaffifin', `akhir Juni = ${formatPosisi(posisiPada(quls, peta, akhirJuni.halaman), peta)} (materi kelas I tuntas)`)

  console.log('\n## Capaian siswa')
  const clil = buatKurva(RENCANA.sd_clil, peta)
  periksa(capaianSiswa(clil, peta, { juzTuntas: 0, ziyadah: [] }) === null, 'tanpa data = belum terukur (null), bukan nol')
  const dariUjian = capaianSiswa(clil, peta, { juzTuntas: 1, ziyadah: [] })!
  periksa(dekat(dariUjian.halaman, bobotJuz(peta, 30), 1e-6) && dariUjian.sumber === 'juz', 'ujian juz 30 = seluruh juz 30, bersumber juz (batas bawah)')
  const sampaiQalam = capaianSiswa(clil, peta, { juzTuntas: 1, ziyadah: [{ surat_id: 68, ayat_ke: 30 }] })!
  periksa(
    dekat(sampaiQalam.halaman, bobotJuz(peta, 30) + peta.bobot(67, 1, 30) + peta.bobot(68, 1, 30), 1e-6) && sampaiQalam.sumber === 'setoran',
    `ziyadah Al-Qalam 30 = juz 30 + Al-Mulk + Al-Qalam 1-30 (${f(sampaiQalam.halaman)}), bersumber setoran`,
  )
  const setoranTertinggal = capaianSiswa(clil, peta, { juzTuntas: 2, ziyadah: [{ surat_id: 67, ayat_ke: 5 }] })!
  periksa(setoranTertinggal.sumber === 'juz', 'setoran lama di belakang juz yang sudah tuntas tidak menurunkan capaian')
  periksa(capaianSiswa(clil, peta, { juzTuntas: 0, ziyadah: [{ surat_id: 2, ayat_ke: 5 }] }) === null, 'setoran di luar rencana diabaikan')

  const eks = buatKurva(RENCANA.smp_eksternal, peta)
  const tl1 = tindakLanjutMurojaah(eks, peta, eks.total, 2)
  periksa(tl1.teks === 'Ujikan juz 28, 27', `tuntas 4 juz, baru diuji 2 → "${tl1.teks}"`)
  const tl2 = tindakLanjutMurojaah(eks, peta, eks.total - 3, 3)
  periksa(tl2.teks === 'Selesaikan hafalan juz 27', `kurang 3 halaman, sudah diuji 3 → "${tl2.teks}"`)
  const tl3 = tindakLanjutMurojaah(eks, peta, eks.total, 4)
  periksa(tl3.teks === 'Tuntas & sudah diujikan', `tuntas & diuji → "${tl3.teks}"`)

  console.log('\n## Pemilihan rencana & status')
  const pilih = (jenjang: 'sd' | 'sd_juara' | 'smp' | 'sma', program: string | null, kelas: string | null, asal = false) =>
    JSON.stringify(pilihRencana({ jenjang, program, kelas, asal_sd_lhi: asal }))
  periksa(pilih('sd', 'clil', '3.0') === '{"kode":"sd_clil","tingkat":3}', 'SD CLIL kelas "3.0" → sd_clil tingkat 3')
  periksa(pilih('sd', 'quls_takhassus', '4A') === '{"alasan":"takhassus"}', 'QuLS Takhassus → tanpa target')
  periksa(pilih('sd_juara', 'reguler', '2B') === '{"kode":"sd_quls","tingkat":2}', 'SD Juara → rencana QuLS')
  periksa(pilih('smp', 'reguler_fd', '8C') === '{"kode":"smp_eksternal","tingkat":8}', 'SMP tanpa tanda internal → eksternal')
  periksa(pilih('smp', 'boarding_quls', '7A', true) === '{"kode":"smp_internal","tingkat":7}', 'SMP bertanda internal → internal')
  periksa(pilih('smp', 'reguler_bd', '4A') === '{"alasan":"kelas_tak_terbaca"}', 'SMP kelas 4 → tidak terbaca')
  periksa(pilih('sma', 'boarding', '10A') === '{"alasan":"belum_ada_rencana"}', 'SMA → belum ada rencana')
  periksa(statusTerhadapTarget(-2.5) === 'di_bawah' && statusTerhadapTarget(-2) === 'sesuai' && statusTerhadapTarget(2.1) === 'di_atas', 'ambang status ±2 pekan')

  console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
  process.exitCode = gagal === 0 ? 0 : 1
}

main()
