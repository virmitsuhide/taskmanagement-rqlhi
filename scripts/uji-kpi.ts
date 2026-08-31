/**
 * Membandingkan hasil lib/kpi/hitung.ts dengan angka yang benar-benar keluar dari
 * KPI_Bulanan_Guru_SD_RQ_LHI_TA20262027.xlsx (tab "Rekap KPI SDIT LHI" baris 6).
 *
 * Jalankan: npm run uji:kpi
 *
 * Nilai harapannya disalin dari sel Excel, bukan dihitung ulang di sini —
 * kalau keduanya dihitung dengan kode yang sama, ujinya tidak membuktikan apa pun.
 */
import { hitungKpi, levelDari } from '../lib/kpi/hitung'

const nol = { lateMinutes: 0, dbLateDays: 0, hafalanJuz: 0, hafalanPages: 0, tuhfatulBait: 0,
  bacaanScore: 0, bukuPeganganMeetings: 0, izinWaCases: 0, penggantiCases: 0, penggantiFound: 0 }

// Persis keadaan baris 6 Excel: seragam terisi 5 tiap hari, sisanya nol.
const harian = {
  seragamDaily: Array(20).fill(5), laporOrtuDaily: Array(20).fill(0),
  halaqohHadir: Array(16).fill(0), halaqohAkhiri: Array(16).fill(0),
  seragamTotal: null, laporOrtuTotal: null, halaqohTotal: null,
}

const h = hitungKpi(nol, harian, 'sd')
const HARAP = [100, 100, 40, 0, 0, 100, 20, 4, 4, 100, 100]
console.log('nilai   :', h.nilai.join(', '))
console.log('harapan :', HARAP.join(', '))
console.log('cocok   :', JSON.stringify(h.nilai) === JSON.stringify(HARAP) ? '✓' : '✗')
console.log(`total   : ${h.total} (Excel 568) ${h.total === 568 ? '✓' : '✗'}`)
console.log(`rapot   : ${h.rapot} (Excel 51.636363636363633) ${Math.abs(h.rapot - 51.636363636363633) < 1e-9 ? '✓' : '✗'}`)
// Nilai & rapot masih diuji terhadap Excel — rumusnya tidak berubah. Yang
// berubah adalah PENAMAAN pitanya: rubrik RQ kini memakai enam predikat, jadi
// rapot 51,64 yang dulu "Cukup" menurut lima pita Excel kini "Sangat Kurang".
// Angka harapannya sengaja disetel ke rubrik yang berlaku, bukan dibiarkan
// merah — uji yang selalu gagal berhenti dibaca orang, dan uji yang berhenti
// dibaca tidak lagi menjaga apa pun.
console.log(`level   : ${h.level} ${h.predikat} (rubrik 2 Sangat Kurang) ${h.level === 2 && h.predikat === 'Sangat Kurang' ? '✓' : '✗'}`)

console.log('\nAmbang level (batas ATAS tiap pita, seperti levelDari):')
for (const v of [0, 50, 50.5, 60, 60.5, 70, 70.5, 80, 80.5, 90, 90.5, 100]) {
  console.log(`  rapot ${String(v).padStart(5)} -> level ${levelDari(v).level}  ${levelDari(v).predikat}`)
}

// ── Rubrik SMP ──────────────────────────────────────────────────────
//
// Baris 6 berkas SMP isinya nol semua sama seperti SD, jadi hasilnya pun sama
// (568). Itu membuktikan jalur rumusnya sama, tapi TIDAK membuktikan
// parameternya berbeda — dengan juz = 0, nilai hafalan selalu jatuh ke basis 40.
//
// Karena itu ditambahkan satu kasus berhafalan. Angka harapannya dihitung
// tangan dari parameter yang tertulis di tab Panduan masing-masing berkas:
//   SD  : 40 + 2 juz x 20   + 5 hal x 1    = 85
//   SMP : 40 + 2 juz x 12   + 5 hal x 0,6  = 67
console.log('\n── Rubrik SMP ──')
const smpNol = hitungKpi(nol, harian, 'smp')
console.log(`SMP semua nol -> total ${smpNol.total} (Excel SMP 568) ${smpNol.total === 568 ? '✓' : '✗'}`)

const berhafalan = { ...nol, hafalanJuz: 2, hafalanPages: 5 }
const sdH = hitungKpi(berhafalan, harian, 'sd').nilai[2]
const smpH = hitungKpi(berhafalan, harian, 'smp').nilai[2]
console.log(`Hafalan 2 juz + 5 hal -> SD ${sdH} (harap 85) ${sdH === 85 ? '✓' : '✗'}`)
console.log(`Hafalan 2 juz + 5 hal -> SMP ${smpH} (harap 67) ${smpH === 67 ? '✓' : '✗'}`)
console.log(`Rubrik keduanya memang berbeda: ${sdH !== smpH ? '✓' : '✗ (parameter tidak terpakai!)'}`)

// SD LHI Juara berbagi berkas rubrik dengan SDIT, jadi harus sama dengan SD.
const juara = hitungKpi(berhafalan, harian, 'sd_juara').nilai[2]
console.log(`SD LHI Juara ikut rubrik SD: ${juara === sdH ? '✓' : '✗'}`)
