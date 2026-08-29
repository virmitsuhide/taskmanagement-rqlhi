import { KPI_INDIKATOR, levelDari, type KpiHasil } from './hitung'
import { paramFor, type KpiParam } from './parameter'
import type { Jenjang, KpiMonthly } from '@/types'

/**
 * Model rapor KPI bulanan satu guru — bahan untuk lembar cetak A4.
 *
 * Modul murni: tidak menyentuh database, tidak membaca sesi. Ia mengubah satu
 * baris kpi_monthly menjadi kalimat-kalimat yang layak dibaca guru yang
 * bersangkutan, dan seluruh angkanya berasal dari mesin yang sama yang dipakai
 * halaman KPI (lib/kpi/hitung.ts) — rapor ini tidak pernah menghitung sendiri.
 *
 * KENAPA TIDAK ADA KOLOM BOBOT
 *
 * Contoh rancangan yang jadi acuan memuat kolom "Bobot (%)" yang berbeda-beda
 * tiap indikator. Rubrik RQ tidak begitu: Nilai Rapot = total ÷ 11, jadi
 * kesebelas indikator berbobot sama persis. Mencetak kolom bobot berisi
 * angka-angka yang tidak dipakai rumus mana pun akan membuat guru mengira
 * sebagian indikator lebih menentukan daripada yang lain — dan itu keliru.
 * Yang dicetak sebagai gantinya adalah capaian riil, yang memang ada datanya.
 */

/** Satu baris tabel indikator di lembar rapor. */
export interface BarisIndikator {
  no: number
  nama: string
  /** Nama pendek untuk sumbu grafik radar. */
  singkat: string
  /** Sasaran menurut rubrik, mis. "≤ 20 menit". */
  target: string
  /** Yang benar-benar tercatat bulan itu, mis. "12 menit". */
  capaian: string
  /** Nilai indikator 0–100. */
  nilai: number
  /** Level 1–5 memakai ambang yang sama dengan nilai rapot keseluruhan. */
  level: number
  predikat: string
}

/** Nama pendek 11 indikator — untuk sumbu radar & kepala kolom yang sempit. */
export const KPI_INDIKATOR_SINGKAT = [
  'Hadir Sekolah',
  'Database',
  "Hafalan Qur'an",
  'Tuhfatul Athfal',
  'Bacaan Metode',
  'Seragam',
  'Lapor Ortu',
  'Halaqoh',
  'Buku Pegangan',
  'Buku Perizinan',
  'Cari Pengganti',
] as const

const bulat = (n: number) => Math.round(n * 10) / 10

/** Jumlah isi grid harian; null bila SDM memilih mengisi totalnya langsung. */
const jumlah = (xs: number[] | null): number | null =>
  xs ? xs.reduce((t, x) => t + (Number.isFinite(x) ? x : 0), 0) : null

/**
 * Sasaran tiap indikator menurut rubrik yang berlaku untuk unit itu.
 *
 * Diturunkan dari KpiParam, bukan ditulis sebagai teks tetap: target hafalan
 * SD (3 juz) dan SMP (5 juz) berbeda, dan rapor yang mencetak angka salah satu
 * unit pada rapor unit lain akan dibaca guru sebagai tuntutan yang keliru.
 */
function targetIndikator(P: KpiParam): string[] {
  return [
    '≤ 20 menit',
    'Tepat waktu (0 hari)',
    `${P.targetJuz} juz per tahun`,
    `${P.totalBait} bait`,
    'Nilai ≥ 81',
    `${P.hariPenilaian} hari lengkap`,
    `${P.hariPenilaian} hari melapor`,
    `${P.pertemuanHalaqoh} pertemuan tepat waktu`,
    `${P.pertemuanBukuPegangan} pertemuan terisi`,
    'Tidak ada kasus',
    'Semua tergantikan',
  ]
}

/** Capaian riil tiap indikator, dibaca apa adanya dari isian bulan itu. */
function capaianIndikator(e: KpiMonthly, P: KpiParam): string[] {
  const seragam = jumlah(e.seragam_daily) ?? e.seragam_total
  const lapor = jumlah(e.lapor_ortu_daily) ?? e.lapor_ortu_total
  const hadirHalaqoh = jumlah(e.halaqoh_hadir)
  const akhiriHalaqoh = jumlah(e.halaqoh_akhiri)

  return [
    `${bulat(e.late_minutes)} menit`,
    e.db_late_days <= 0 ? 'Tepat waktu' : `Telat ${bulat(e.db_late_days)} hari`,
    e.hafalan_pages > 0
      ? `${bulat(e.hafalan_juz)} juz ${bulat(e.hafalan_pages)} hlm`
      : `${bulat(e.hafalan_juz)} juz`,
    `${bulat(e.tuhfatul_bait)} bait`,
    `Nilai ${bulat(e.bacaan_score)}`,
    seragam === null ? '—' : `${bulat(seragam)} poin`,
    lapor === null ? '—' : `${bulat(lapor)} poin`,
    hadirHalaqoh !== null && akhiriHalaqoh !== null
      ? `${bulat(hadirHalaqoh)} + ${bulat(akhiriHalaqoh)} poin`
      : e.halaqoh_total === null ? '—' : `${bulat(e.halaqoh_total)} poin`,
    `${bulat(e.buku_pegangan_meetings)} / ${P.pertemuanBukuPegangan} pertemuan`,
    e.izin_wa_cases <= 0 ? 'Tidak ada' : `${bulat(e.izin_wa_cases)} kasus`,
    e.pengganti_cases <= 0
      ? 'Tidak pernah izin'
      : `${bulat(e.pengganti_found)} dari ${bulat(e.pengganti_cases)} kasus`,
  ]
}

export function barisIndikator(e: KpiMonthly, hasil: KpiHasil, unit: Jenjang | null): BarisIndikator[] {
  const P = paramFor(unit)
  const target = targetIndikator(P)
  const capaian = capaianIndikator(e, P)

  return KPI_INDIKATOR.map((nama, i) => {
    const nilai = bulat(hasil.nilai[i])
    const lv = levelDari(hasil.nilai[i])
    return {
      no: i + 1,
      nama,
      singkat: KPI_INDIKATOR_SINGKAT[i],
      target: target[i],
      capaian: capaian[i],
      nilai,
      level: lv.level,
      predikat: lv.predikat,
    }
  })
}

// ─── Apresiasi & area pengembangan ──────────────────────────────────────────

export interface Catatan {
  apresiasi: string[]
  pengembangan: string[]
}

/** Ambang "sudah sangat baik" — batas bawah level 5 pada KPI_LEVELS. */
const AMBANG_APRESIASI = 81

/**
 * Kalimat apresiasi & area pengembangan untuk lembar rapor.
 *
 * Dua sumber, dengan urutan yang jelas: yang DITULIS SDM saat mengisi KPI
 * selalu menang, dan kalimat turunan dari nilai indikator dipakai bila bagian
 * itu dibiarkan kosong.
 *
 * Jaring pengaman turunan itu bukan kemewahan. Rapor terbit tiap bulan untuk
 * puluhan guru; kalau satu-satunya sumbernya isian manual, sebagian besar
 * rapor akan terbit dengan bagian evaluasi kosong — dan bagian kosong terbaca
 * oleh penerimanya sebagai perhatian yang tidak merata. Kalimat turunan selalu
 * ada, selalu merujuk angka yang tercetak di tabel yang sama, jadi ia tidak
 * bisa bertentangan dengan lembarnya sendiri.
 *
 * Keduanya diperiksa per bagian, jadi SDM boleh menulis apresiasinya saja dan
 * membiarkan area pengembangan dihitung, atau sebaliknya.
 *
 * Tindak lanjut pada kalimat turunan diambil dari KPI_LEVELS — kolom yang
 * sudah dipakai rubrik untuk menerangkan apa yang harus dilakukan tiap level.
 */
export function catatanDari(
  baris: BarisIndikator[],
  ditulis?: { apresiasi: string[] | null; pengembangan: string[] | null },
): Catatan {
  // Yang ditulis SDM selalu menang. Kalimat turunan di bawah adalah jaring
  // pengaman supaya rapor tidak pernah terbit dengan bagian kosong — bukan
  // pengganti pengamatan orang yang benar-benar menilai. Keduanya diperiksa
  // per bagian, jadi SDM boleh menulis apresiasinya saja dan membiarkan area
  // pengembangan dihitung, atau sebaliknya.
  const tulisanApresiasi = (ditulis?.apresiasi ?? []).map(t => t.trim()).filter(Boolean)
  const tulisanPengembangan = (ditulis?.pengembangan ?? []).map(t => t.trim()).filter(Boolean)
  const kuat = baris
    .filter(b => b.nilai >= AMBANG_APRESIASI)
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 4)

  const lemah = baris
    .filter(b => b.nilai < AMBANG_APRESIASI)
    .sort((a, b) => a.nilai - b.nilai)
    .slice(0, 4)

  const apresiasi = kuat.length
    ? kuat.map(b => `${b.nama} — ${b.capaian} (nilai ${b.nilai}, ${b.predikat}).`)
    : ['Belum ada indikator yang mencapai predikat Sangat Baik bulan ini. Pilih satu indikator terdekat sebagai sasaran utama bulan depan.']

  const pengembangan = lemah.length
    ? lemah.map(b => `${b.nama} — baru ${b.capaian} (nilai ${b.nilai}). Sasaran: ${b.target}. ${levelDari(b.nilai).tindakLanjut}`)
    : ['Seluruh indikator sudah berpredikat Sangat Baik. Pertahankan, dan bersedialah menjadi mentor bagi rekan yang masih menyesuaikan diri.']

  return {
    apresiasi: tulisanApresiasi.length ? tulisanApresiasi : apresiasi,
    pengembangan: tulisanPengembangan.length ? tulisanPengembangan : pengembangan,
  }
}

// ─── Perbandingan antar periode ─────────────────────────────────────────────

export interface TitikTren {
  year: number
  month: number
  /** Null = bulan itu belum dinilai. */
  rapot: number | null
}

export interface Perbandingan {
  /** Selisih nilai rapot terhadap bulan sebelumnya; null bila belum ada. */
  selisih: number | null
  arah: 'naik' | 'turun' | 'tetap' | 'baru'
}

/**
 * Bandingkan dengan bulan tepat sebelumnya.
 *
 * Yang dibandingkan hanya bulan yang BENAR-BENAR sebelumnya, bukan penilaian
 * terakhir yang kebetulan ada. Guru yang tidak dinilai bulan lalu lalu
 * dibandingkan dengan tiga bulan lalu akan menerima angka "turun 4 poin" untuk
 * rentang yang tidak pernah ia jalani sebagai satu periode.
 */
export function bandingkan(tren: TitikTren[]): Perbandingan {
  if (tren.length < 2) return { selisih: null, arah: 'baru' }
  const kini = tren[tren.length - 1]?.rapot
  const lalu = tren[tren.length - 2]?.rapot
  if (kini == null || lalu == null) return { selisih: null, arah: 'baru' }
  const selisih = bulat(kini - lalu)
  return { selisih, arah: selisih > 0 ? 'naik' : selisih < 0 ? 'turun' : 'tetap' }
}

/** Masa kerja dalam tahun penuh, dihitung sampai akhir periode rapor. */
export function masaKerja(joinedAt: string | null, year: number, month: number): number | null {
  if (!joinedAt) return null
  const [jy, jm] = joinedAt.slice(0, 10).split('-').map(Number)
  if (!jy || !jm) return null
  const bulanTotal = (year - jy) * 12 + (month - jm)
  return bulanTotal < 0 ? 0 : Math.floor(bulanTotal / 12)
}
