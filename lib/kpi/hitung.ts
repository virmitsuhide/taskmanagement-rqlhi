import { paramFor, KPI_LEVELS, type KpiParam } from './parameter'
import type { Jenjang } from '@/types'

/**
 * Perhitungan 11 indikator KPI bulanan.
 *
 * Tiap fungsi di bawah adalah terjemahan langsung satu rumus dari tab
 * "Rekap KPI" pada spreadsheet KPI, dan rumus aslinya ditulis ulang di atasnya
 * apa adanya. Itu disengaja: kalau nanti hasil aplikasi dan hasil Excel
 * berselisih, yang perlu dibandingkan cuma dua baris yang bersebelahan, bukan
 * menerka-nerka maksud kodenya.
 *
 * Semua indikator menghasilkan 0–100.
 */

/** Isian bulanan — sepadan dengan kolom E–N tab "Input". */
export interface KpiInput {
  /**
   * E — TOTAL keterlambatan hadir sebulan, dalam menit. Bukan rata-rata per
   * hari: ambang terendah rubrik adalah 20 menit, dan tidak ada guru yang
   * rata-rata hariannya menembus itu, sehingga tafsir rata-rata membuat semua
   * orang bernilai 100 dan indikatornya berhenti membedakan siapa pun.
   */
  lateMinutes: number
  /** F — keterlambatan setor database, dalam hari. */
  dbLateDays: number
  /** G — hafalan Al-Qur'an, juz utuh. */
  hafalanJuz: number
  /** H — hafalan Al-Qur'an, sisa halaman. */
  hafalanPages: number
  /** I — hafalan Tuhfatul Athfal, jumlah bait (0–61). */
  tuhfatulBait: number
  /** J — bacaan Al-Qur'an sesuai metode, sudah berupa nilai 0–100. */
  bacaanScore: number
  /** K — buku pegangan guru, jumlah pertemuan terisi (maks 16). */
  bukuPeganganMeetings: number
  /** L — jumlah kasus izin lewat WA tanpa menulis buku. */
  izinWaCases: number
  /** M — jumlah kasus izin yang butuh pengganti. */
  penggantiCases: number
  /** N — jumlah kasus yang berhasil dapat pengganti. */
  penggantiFound: number
}

/** Isian harian. Null berarti SDM memilih mengisi totalnya langsung. */
export interface KpiHarian {
  /** 20 hari × 0–5. */
  seragamDaily: number[] | null
  /** 20 hari × 0–4. */
  laporOrtuDaily: number[] | null
  /** 16 pertemuan × 0–3. */
  halaqohHadir: number[] | null
  /** 16 pertemuan × 0–3. */
  halaqohAkhiri: number[] | null
  /** Dipakai kalau grid hariannya null. */
  seragamTotal: number | null
  laporOrtuTotal: number | null
  halaqohTotal: number | null
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v))
const sum = (xs: number[]) => xs.reduce((t, x) => t + (Number.isFinite(x) ? x : 0), 0)

// 1 ── IF(E<=20,100,IF(E<=50,80,IF(E<=75,60,IF(E<=100,40,20))))
export function nilaiKedisiplinanHadir(lateMinutes: number): number {
  if (lateMinutes <= 20) return 100
  if (lateMinutes <= 50) return 80
  if (lateMinutes <= 75) return 60
  if (lateMinutes <= 100) return 40
  return 20
}

// 2 ── IF(F<=0,100,IF(F<=1,90,IF(F<=2,80,IF(F<=3,70,60))))
export function nilaiPengisianDatabase(dbLateDays: number): number {
  if (dbLateDays <= 0) return 100
  if (dbLateDays <= 1) return 90
  if (dbLateDays <= 2) return 80
  if (dbLateDays <= 3) return 70
  return 60
}

// 3 ── MAX(0,MIN(100, basisHafalan + G*poinPerJuz + H*poinPerHalaman))
export function nilaiHafalanQuran(juz: number, pages: number, P: KpiParam): number {
  return clamp100(P.basisHafalan + juz * P.poinPerJuz + pages * P.poinPerHalaman)
}

// 4 ── MAX(0,MIN(100, IF(I<=0, 0, poinBaitPertama + (I-1)*poinBaitBerikutnya)))
export function nilaiTuhfatulAthfal(bait: number, P: KpiParam): number {
  if (bait <= 0) return 0
  return clamp100(P.poinBaitPertama + (bait - 1) * P.poinBaitBerikutnya)
}

// 6 ── 'Seragam'!X = MIN(100, SUM(20 hari))
export function nilaiSeragam(h: KpiHarian): number {
  if (h.seragamDaily) return clamp100(sum(h.seragamDaily))
  return clamp100(h.seragamTotal ?? 0)
}

// 7 ── 'Lapor Ortu'!Y = MIN(100, SUM(16 hari aktif) + basisLaporOrtu)
export function nilaiLaporOrtu(h: KpiHarian, P: KpiParam): number {
  if (h.laporOrtuDaily) return clamp100(sum(h.laporOrtuDaily) + P.basisLaporOrtu)
  return clamp100(h.laporOrtuTotal ?? 0)
}

// 8 ── 'Halaqoh'!AL = MIN(100, basis + MIN(sumHadir, 16*3) + MIN(sumAkhiri, 16*3))
//
// Dua MIN di dalamnya bukan hiasan: keduanya membatasi tiap sisi secara
// terpisah, sehingga kelebihan poin kehadiran tidak bisa menambal kekurangan
// poin mengakhiri. Membatasi totalnya saja akan memberi hasil berbeda.
export function nilaiHalaqoh(h: KpiHarian, P: KpiParam): number {
  if (h.halaqohHadir && h.halaqohAkhiri) {
    const maxHadir = P.pertemuanHalaqoh * P.poinHadirHalaqoh
    const maxAkhiri = P.pertemuanHalaqoh * P.poinAkhiriHalaqoh
    return clamp100(
      P.basisHalaqoh +
      Math.min(sum(h.halaqohHadir), maxHadir) +
      Math.min(sum(h.halaqohAkhiri), maxAkhiri),
    )
  }
  return clamp100(h.halaqohTotal ?? 0)
}

// 9 ── MAX(0,MIN(100, basisBukuPegangan + K*poinPerPertemuanBuku))
export function nilaiBukuPegangan(meetings: number, P: KpiParam): number {
  return clamp100(P.basisBukuPegangan + meetings * P.poinPerPertemuanBuku)
}

// 10 ── MAX(0, 100 - L*penguranganIzin)
export function nilaiBukuPerizinan(cases: number, P: KpiParam): number {
  return Math.max(0, 100 - cases * P.penguranganIzin)
}

// 11 ── IF(M<=0,100, IF(N/M>=1,100, ... berjenjang 0.8/0.6/0.4/0.2 ... ,0))
//
// M<=0 bernilai 100, bukan 0: guru yang tidak pernah izin tidak pernah perlu
// mencari pengganti, jadi ia tidak boleh dihukum untuk sesuatu yang memang
// tidak pernah terjadi.
export function nilaiCariPengganti(cases: number, found: number): number {
  if (cases <= 0) return 100
  const rasio = found / cases
  if (rasio >= 1) return 100
  if (rasio >= 0.8) return 80
  if (rasio >= 0.6) return 60
  if (rasio >= 0.4) return 40
  if (rasio >= 0.2) return 20
  return 0
}

/** Nama & urutan 11 indikator — sama dengan kolom C–M tab "Rekap KPI". */
export const KPI_INDIKATOR = [
  'Kedisiplinan Hadir di Sekolah',
  'Pengisian Database',
  "Hafalan Al-Qur'an",
  'Hafalan Tuhfatul Athfal',
  "Bacaan Al-Qur'an Sesuai Metode",
  'Pemakaian Seragam / Sesuai Aturan',
  'Laporan Grup Orang Tua',
  'Kedisiplinan Hadir & Mengakhiri Halaqoh',
  'Pengisian Buku Pegangan Guru',
  'Mengisi Buku Perizinan Tepat Waktu',
  'Kemampuan Mencari Pengganti',
] as const

export interface KpiHasil {
  /** 11 nilai indikator, urutannya sama dengan KPI_INDIKATOR. */
  nilai: number[]
  /** N — jumlah 11 indikator. */
  total: number
  /** O — Total ÷ 11. */
  rapot: number
  /** P — 1..5 */
  level: number
  /** Q */
  predikat: string
  tindakLanjut: string
}

/**
 * Menghitung seluruh indikator untuk satu guru pada satu bulan.
 *
 * `unit` menentukan rubrik mana yang dipakai. SD dan SMP berbagi rumus yang
 * sama persis, tapi tuntutan hafalannya berbeda — SMP menargetkan 5 juz dengan
 * 12 poin per juz, SD 3 juz dengan 20 poin. Karena itu unit WAJIB ikut
 * disertakan, dan yang benar adalah unit tempat guru berada SAAT dinilai,
 * bukan unit tempat ia berada sekarang. Guru yang pindah dari SD ke SMP tidak
 * boleh membuat nilai SD-nya di bulan-bulan lalu ikut dihitung ulang dengan
 * rubrik SMP.
 */
export function hitungKpi(input: KpiInput, harian: KpiHarian, unit: Jenjang | null | undefined): KpiHasil {
  const P = paramFor(unit)
  const nilai = [
    nilaiKedisiplinanHadir(input.lateMinutes),
    nilaiPengisianDatabase(input.dbLateDays),
    nilaiHafalanQuran(input.hafalanJuz, input.hafalanPages, P),
    nilaiTuhfatulAthfal(input.tuhfatulBait, P),
    clamp100(input.bacaanScore),
    nilaiSeragam(harian),
    nilaiLaporOrtu(harian, P),
    nilaiHalaqoh(harian, P),
    nilaiBukuPegangan(input.bukuPeganganMeetings, P),
    nilaiBukuPerizinan(input.izinWaCases, P),
    nilaiCariPengganti(input.penggantiCases, input.penggantiFound),
  ]
  const total = sum(nilai)
  const rapot = total / P.jumlahIndikator
  return { nilai, total, rapot, ...levelDari(rapot) }
}

/**
 * Nilai 0–100 → level & predikatnya, memakai ambang di KPI_LEVELS.
 *
 * Enam pita sejak rubriknya diperbarui: ≤50 Sangat Kurang Sekali, lalu tiap
 * sepuluh angka naik satu tingkat sampai 91–100 Sangat Baik. Sebelumnya lima
 * pita selebar dua puluh angka, warisan rumus di berkas Excel-nya.
 *
 * Yang dipakai adalah batas ATAS tiap level (`max`), bukan batas bawahnya.
 * Tabel rubriknya menulis rentang sebagai "51 - 60", padahal nilai rapot
 * adalah pembagian dan kerap berkoma — 50,4 jatuh di celah menurut tabel, tapi
 * jelas masuk pita terbawah menurut batas atas. Membandingkan dengan `max`
 * membuat setiap nilai yang mungkin punya tempat, tanpa celah.
 */
export function levelDari(rapot: number): { level: number; predikat: string; tindakLanjut: string } {
  const naik = [...KPI_LEVELS].reverse()
  const found = naik.find(l => rapot <= l.max) ?? naik[naik.length - 1]
  return { level: found.level, predikat: found.predikat, tindakLanjut: found.tindakLanjut }
}
