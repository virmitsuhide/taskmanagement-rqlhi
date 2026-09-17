import { TOTAL_HALAMAN, halamanDariAyat } from '@/lib/rq/batas-halaman'
import { juzMushafDariAyat } from '@/lib/rq/halaman'
import { URUTAN_JUZ, posisiJuz } from '@/lib/rq/hafalan'
import { SURAH } from '@/lib/rq/quran'
import type { Jenjang } from '@/types'

/**
 * Target tahfidz bulanan, diturunkan dari rencana per pekan milik tiap program.
 *
 * ── DARI MANA RENCANANYA ────────────────────────────────────────────────────
 *
 * Empat berkas Excel yang disusun RQ LHI (Downloads\Target Tahfidz\). Yang
 * disalin ke sini adalah lembar DATA INDUK — materi tiap semester — bukan
 * lembar pekanan per kelas. Alasannya dua:
 *
 *   1. Lembar pekanan SDIT memuat baris yang keliru: Kelas IV pekan 21–23
 *      ketiganya "Al-Mursalat 7-14" padahal pekan 20 sudah ayat 36, Kelas III
 *      pekan 29 tumpang tindih dengan pekan 28. Data Induk-nya bersih.
 *   2. Lembar pekanan SDIT dan SMPIT sendiri menyatakan materinya "dialokasikan
 *      proporsional" dari Data Induk. Membagi ulang di sini menghasilkan hal
 *      yang sama — tanpa mewarisi salah ketiknya.
 *
 * ── SATUANNYA HALAMAN MUSHAF, BUKAN BARIS ATAU AYAT ─────────────────────────
 *
 * Kolom "baris" di berkas tidak bisa dipegang: SMPIT menulis juz 30 = 60 baris
 * padahal juz 30 itu 23 halaman (± 345 baris), dan berkasnya sendiri mengakui
 * angka itu "kebijakan, bukan baris riil". Ayat juga tidak adil sebagai satuan
 * beban — satu ayat Al-Baqarah bisa sehalaman penuh, satu halaman juz 30 bisa
 * belasan ayat.
 *
 * Maka tiap ayat diberi bobot 1/(jumlah ayat di halamannya), dari indeks
 * halaman Mushaf Madinah yang sudah dipakai rapor (lib/rq/batas-halaman.ts).
 * Seluruh ayat sebuah halaman berjumlah tepat 1, sehingga beban hafalan
 * terukur dalam halaman dan tetap bisa diterjemahkan balik ke "sampai surat
 * sekian ayat sekian".
 *
 * ── DARI PEKAN KE BULAN ─────────────────────────────────────────────────────
 *
 * Rencana menyebut pekan (SDIT 18+12, QuLS 16+14, SMPIT 15+15 / 17+15), sedang
 * RQ memakai SATU kalender pekan efektif untuk semua program. Keduanya
 * dipertemukan secara proporsional per semester: bila separuh pekan efektif
 * semester ganjil sudah lewat, target berada di separuh materi semester itu.
 * Selisih jumlah pekan rencana dan kalender dengan begitu tersebar rata, dan
 * mengubah kalender cukup mengubah angka pekan per bulan — materinya tidak
 * disentuh.
 */

// ─── Rencana ──────────────────────────────────────────────────────────────────

/** Satu potong materi dalam urutan hafalan. `ke` null = sampai akhir surah. */
export interface Segmen {
  surat: number
  dari: number
  ke: number | null
}

export type JenisSemester = 'hafalan' | 'murojaah'

export interface SemesterRencana {
  /** Jumlah pekan menurut berkas rencana — hanya menentukan laju per pekan. */
  pekan: number
  jenis: JenisSemester
  segmen: Segmen[]
}

export interface TingkatRencana {
  /** Tingkat kelas sekolah: 1–6 untuk SD, 7–9 untuk SMP. */
  tingkat: number
  semester: [SemesterRencana, SemesterRencana]
}

export type KodeRencana = 'sd_clil' | 'sd_quls' | 'smp_internal' | 'smp_eksternal'

export interface Rencana {
  kode: KodeRencana
  label: string
  keterangan: string
  /** Hafalan yang dianggap sudah dibawa sebelum tingkat pertama rencana. */
  bekal: Segmen[]
  tingkat: TingkatRencana[]
}

const surah = (surat: number, dari = 1, ke: number | null = null): Segmen => ({ surat, dari, ke })

/** Surah utuh dari `dari` sampai `ke`, urut naik — Al-Mulk, Al-Qalam, … */
function maju(dari: number, ke: number): Segmen[] {
  return Array.from({ length: ke - dari + 1 }, (_, i) => surah(dari + i))
}

/** Surah utuh dari `dari` turun ke `ke` — An-Nas, Al-Falaq, … (juz 30 SD). */
function mundur(dari: number, ke: number): Segmen[] {
  return Array.from({ length: dari - ke + 1 }, (_, i) => surah(dari - i))
}

const smt = (pekan: number, segmen: Segmen[]): SemesterRencana => ({ pekan, jenis: 'hafalan', segmen })
const murojaah = (pekan: number): SemesterRencana => ({ pekan, jenis: 'murojaah', segmen: [] })

export const RENCANA: Record<KodeRencana, Rencana> = {
  // Target_Tahfidz SDIT_LHI_-_Mingguan.xlsx — Data Induk. Smt 1 = 18 pekan, Smt 2 = 12.
  sd_clil: {
    kode: 'sd_clil',
    label: 'SDIT CLIL',
    keterangan: '3 juz (30, 29, 28) saat lulus kelas VI',
    bekal: [],
    tingkat: [
      { tingkat: 1, semester: [smt(18, mundur(114, 93)), smt(12, mundur(92, 87))] },
      { tingkat: 2, semester: [smt(18, mundur(86, 82)), smt(12, mundur(81, 78))] },
      { tingkat: 3, semester: [smt(18, maju(67, 69)), smt(12, maju(70, 72))] },
      { tingkat: 4, semester: [smt(18, maju(73, 75)), smt(12, [...maju(76, 77), surah(58)])] },
      { tingkat: 5, semester: [smt(18, maju(59, 63)), smt(12, maju(64, 66))] },
      { tingkat: 6, semester: [murojaah(18), murojaah(12)] },
    ],
  },

  // Target_Tahfidz_QuLS_SDIT_LHI_8_Juz.xlsx — Data Induk. Smt 1 = 16 pekan, Smt 2 = 14.
  // Juz 27 dimulai Az-Zariyat ayat 1, sesuai mushaf RQ (lihat AWAL_JUZ_MUSHAF).
  //
  // Berkasnya menutup juz 3 di Ali Imran 92, tapi di mushaf RQ ayat 92 adalah
  // ayat PERTAMA juz 4. Rencana berhenti di ayat 91: target "8 juz" berarti
  // juz 3 tuntas, bukan juz 3 tuntas ditambah satu ayat juz 4 — satu ayat itu
  // cukup untuk membuat hitungan juz tuntas meleset.
  sd_quls: {
    kode: 'sd_quls',
    label: 'SDIT QuLS & SD Juara',
    keterangan: '8 juz (30–26, 1, 2, 3) saat lulus kelas VI',
    bekal: [],
    tingkat: [
      { tingkat: 1, semester: [smt(16, [...mundur(114, 91), surah(90, 1, 14)]), smt(14, [surah(90, 15), ...mundur(89, 83)])] },
      { tingkat: 2, semester: [smt(16, [...mundur(82, 78), surah(67), surah(68, 1, 40)]), smt(14, [surah(68, 41), ...maju(69, 73)])] },
      { tingkat: 3, semester: [smt(16, [...maju(74, 77), surah(58), surah(59, 1, 16)]), smt(14, [surah(59, 17), ...maju(60, 65)])] },
      { tingkat: 4, semester: [smt(16, [surah(66), ...maju(51, 54), surah(55, 1, 24)]), smt(14, [surah(55, 25), ...maju(56, 57), surah(46)])] },
      { tingkat: 5, semester: [smt(16, [...maju(47, 50), surah(1), surah(2, 1, 28)]), smt(14, [surah(2, 29, 141)])] },
      { tingkat: 6, semester: [smt(16, [surah(2, 142, 261)]), smt(14, [surah(2, 262), surah(3, 1, 91)])] },
    ],
  },

  // Target TAHFIDZ SMPT LHI BOARDING (INTERNAL).xlsx — lulusan SD LHI.
  // Berkasnya menganggap juz 30 sudah tuntas di SD; Al-Fatihah tidak dihitung.
  //
  // Bekal SENGAJA hanya juz 30, bukan 3 juz sesuai target SDIT CLIL. Target
  // CLIL adalah cita-cita; bekal ini kenyataan. Data alumni kelas 6 CLIL yang
  // masuk kelas 7 TA 2026/2027: 25 dari 27 anak sudah ujian juz 30, hanya
  // segelintir yang lebih. Menaikkan bekal ke 3 juz akan membuat hampir semua
  // lulusan SD LHI terbaca tertinggal dua juz sejak hari pertama SMP.
  smp_internal: {
    kode: 'smp_internal',
    label: 'SMPIT Internal',
    keterangan: 'Lulusan SD LHI — 5 juz baru (29, 28, 27, 26, 1)',
    bekal: maju(78, 114),
    tingkat: [
      { tingkat: 7, semester: [smt(15, maju(67, 77)), smt(15, maju(58, 66))] },
      { tingkat: 8, semester: [smt(15, maju(51, 57)), smt(15, maju(46, 50))] },
      { tingkat: 9, semester: [smt(17, [surah(2, 1, 141)]), murojaah(15)] },
    ],
  },

  // Target TAHFIDZ SMPIT LHI BOARDING (EKSTERNAL).xlsx — selain lulusan SD LHI.
  smp_eksternal: {
    kode: 'smp_eksternal',
    label: 'SMPIT Eksternal',
    keterangan: '4 juz baru (30, 29, 28, 27)',
    bekal: [],
    tingkat: [
      { tingkat: 7, semester: [smt(15, maju(78, 114)), smt(15, maju(67, 77))] },
      { tingkat: 8, semester: [smt(15, maju(58, 66)), smt(15, maju(51, 54))] },
      { tingkat: 9, semester: [smt(17, maju(55, 57)), murojaah(15)] },
    ],
  },
}

export const URUTAN_RENCANA: KodeRencana[] = ['sd_clil', 'sd_quls', 'smp_internal', 'smp_eksternal']

// ─── Siswa → rencana ──────────────────────────────────────────────────────────

export type AlasanTanpaTarget =
  | 'takhassus'           // QuLS Takhassus: mengejar sebanyak-banyaknya, tanpa patokan
  | 'program_kosong'      // program siswa belum ditandai
  | 'belum_ada_rencana'   // unit tanpa berkas target (PAUD, SMA)
  | 'kelas_tak_terbaca'   // kelas kosong, atau tingkatnya di luar rencana

export const LABEL_ALASAN: Record<AlasanTanpaTarget, string> = {
  takhassus: 'QuLS Takhassus — tanpa target',
  program_kosong: 'Program belum ditandai',
  belum_ada_rencana: 'Unit belum punya target',
  kelas_tak_terbaca: 'Kelas tidak terbaca',
}

/** '7A' → 7, '3.0' → 3, 'A' → null. Hanya tingkatnya yang dibutuhkan target. */
export function tingkatDariKelas(kelas: string | null | undefined): number | null {
  const m = /^\s*(\d+)/.exec(kelas ?? '')
  return m ? Number(m[1]) : null
}

export function pilihRencana(siswa: {
  jenjang: Jenjang
  program: string | null
  kelas: string | null
  asal_sd_lhi: boolean
}): { kode: KodeRencana; tingkat: number } | { alasan: AlasanTanpaTarget } {
  let kode: KodeRencana
  switch (siswa.jenjang) {
    case 'sd':
      if (siswa.program === 'quls_takhassus') return { alasan: 'takhassus' }
      if (!siswa.program) return { alasan: 'program_kosong' }
      kode = siswa.program === 'quls' ? 'sd_quls' : 'sd_clil'
      break
    case 'sd_juara':
      kode = 'sd_quls'
      break
    case 'smp':
      kode = siswa.asal_sd_lhi ? 'smp_internal' : 'smp_eksternal'
      break
    default:
      return { alasan: 'belum_ada_rencana' }
  }
  const tingkat = tingkatDariKelas(siswa.kelas)
  if (tingkat === null || !RENCANA[kode].tingkat.some(t => t.tingkat === tingkat)) {
    return { alasan: 'kelas_tak_terbaca' }
  }
  return { kode, tingkat }
}

// ─── Bobot halaman ────────────────────────────────────────────────────────────

export interface PetaHalaman {
  panjang(surat: number): number
  /** Beban ayat `dari`..`ke` sebuah surah, dalam halaman (boleh pecahan). */
  bobot(surat: number, dari: number, ke: number): number
}

/**
 * @param panjangSurat nomor surah → jumlah ayat, dari surat_master. Sengaja
 *   dioper, bukan disalin ke berkas ini — lihat scripts/uji-batas-juz.ts.
 */
export function buatPetaHalaman(panjangSurat: Map<number, number>): PetaHalaman {
  const halamanAyat: number[][] = []
  const isiHalaman = new Array<number>(TOTAL_HALAMAN + 1).fill(0)
  for (let s = 1; s <= 114; s++) {
    const baris = [0]
    for (let a = 1; a <= (panjangSurat.get(s) ?? 0); a++) {
      const h = halamanDariAyat(s, a) ?? 0
      baris.push(h)
      isiHalaman[h]++
    }
    halamanAyat[s] = baris
  }

  // Prefiks per surah: kumulatif[s][a] = beban ayat 1..a.
  const kumulatif: number[][] = []
  for (let s = 1; s <= 114; s++) {
    const pre = [0]
    const baris = halamanAyat[s]
    for (let a = 1; a < baris.length; a++) pre.push(pre[a - 1] + 1 / isiHalaman[baris[a]])
    kumulatif[s] = pre
  }

  return {
    panjang: surat => (kumulatif[surat]?.length ?? 1) - 1,
    bobot(surat, dari, ke) {
      const pre = kumulatif[surat]
      if (!pre) return 0
      const akhir = Math.min(ke, pre.length - 1)
      const awal = Math.max(dari, 1)
      return akhir < awal ? 0 : pre[akhir] - pre[awal - 1]
    },
  }
}

// ─── Kurva rencana ────────────────────────────────────────────────────────────

export interface ItemKurva {
  surat: number
  dari: number
  ke: number
  /** Halaman kumulatif rencana sebelum & sesudah potongan ini. */
  mulai: number
  akhir: number
}

export interface SemesterKurva {
  tingkat: number
  semester: 1 | 2
  jenis: JenisSemester
  pekan: number
  mulai: number
  akhir: number
  /** Halaman per pekan. Semester murojaah meminjam laju hafalan terakhir. */
  laju: number
}

export interface KurvaRencana {
  rencana: Rencana
  item: ItemKurva[]
  semester: SemesterKurva[]
  total: number
  /** Juz dalam rencana, urut dihafal, dengan halaman kumulatif saat juz itu tuntas. */
  akhirJuz: { juz: number; akhir: number }[]
}

const EPS = 1e-9

export function buatKurva(rencana: Rencana, peta: PetaHalaman): KurvaRencana {
  const item: ItemKurva[] = []
  const akhirJuz = new Map<number, number>()
  let kum = 0

  const tambah = (seg: Segmen) => {
    const ke = seg.ke ?? peta.panjang(seg.surat)
    const mulai = kum
    // Juz dicatat per ayat hanya bila potongan ini melintasi batas juz.
    const juzAwal = juzMushafDariAyat(seg.surat, seg.dari)
    if (juzAwal === juzMushafDariAyat(seg.surat, ke)) {
      kum += peta.bobot(seg.surat, seg.dari, ke)
      akhirJuz.set(juzAwal, kum)
    } else {
      for (let a = seg.dari; a <= ke; a++) {
        kum += peta.bobot(seg.surat, a, a)
        akhirJuz.set(juzMushafDariAyat(seg.surat, a), kum)
      }
    }
    item.push({ surat: seg.surat, dari: seg.dari, ke, mulai, akhir: kum })
  }

  rencana.bekal.forEach(tambah)
  const semester: SemesterKurva[] = []
  let lajuTerakhir = 1
  for (const t of rencana.tingkat) {
    t.semester.forEach((s, i) => {
      const mulai = kum
      s.segmen.forEach(tambah)
      const laju = s.jenis === 'hafalan' && s.pekan > 0 ? (kum - mulai) / s.pekan : lajuTerakhir
      if (s.jenis === 'hafalan') lajuTerakhir = laju
      semester.push({ tingkat: t.tingkat, semester: (i + 1) as 1 | 2, jenis: s.jenis, pekan: s.pekan, mulai, akhir: kum, laju })
    })
  }

  return {
    rencana, item, semester, total: kum,
    akhirJuz: [...akhirJuz].map(([juz, akhir]) => ({ juz, akhir })).sort((a, b) => a.akhir - b.akhir),
  }
}

export function semesterKurva(kurva: KurvaRencana, tingkat: number, semester: 1 | 2): SemesterKurva | null {
  return kurva.semester.find(s => s.tingkat === tingkat && s.semester === semester) ?? null
}

/** Posisi (surat, ayat) tempat hafalan sepanjang `halaman` berakhir. */
export function posisiPada(kurva: KurvaRencana, peta: PetaHalaman, halaman: number): { surat: number; ayat: number } | null {
  if (halaman <= EPS || kurva.item.length === 0) return null
  for (const it of kurva.item) {
    if (halaman > it.akhir + EPS) continue
    for (let a = it.dari; a <= it.ke; a++) {
      if (it.mulai + peta.bobot(it.surat, it.dari, a) >= halaman - EPS) return { surat: it.surat, ayat: a }
    }
  }
  const akhir = kurva.item[kurva.item.length - 1]
  return { surat: akhir.surat, ayat: akhir.ke }
}

/** "Al-Gasyiyah 16", atau "Al-Gasyiyah" saja bila ayatnya yang terakhir. */
export function formatPosisi(p: { surat: number; ayat: number } | null, peta: PetaHalaman): string {
  if (!p) return 'Belum mulai'
  const nama = SURAH[p.surat - 1]?.nama ?? `Surah ${p.surat}`
  return p.ayat >= peta.panjang(p.surat) ? nama : `${nama} ${p.ayat}`
}

// ─── Kalender pekan efektif ───────────────────────────────────────────────────

export interface BulanKalender {
  /** 'YYYY-MM' */
  bulan: string
  semester: 1 | 2
  pekan: number
}

/** '2026-09-17' → '2026/2027'. Tahun ajaran berganti di bulan Juli. */
export function tahunAjaranDari(tanggal: string): string {
  const y = Number(tanggal.slice(0, 4))
  const m = Number(tanggal.slice(5, 7))
  return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

/**
 * Perkiraan awal, dipakai sampai RQ menyimpan kalendernya sendiri.
 *
 * Ganjil 18 pekan (MPLS di Juli, PTS di Oktober, PAS di Desember); genap 15
 * pekan (libur Idul Fitri ≈ 10 Maret 2027 memotong Maret, PAT di Juni).
 */
const POLA_BAWAAN: { bulanKe: number; semester: 1 | 2; pekan: number }[] = [
  { bulanKe: 7, semester: 1, pekan: 2 }, { bulanKe: 8, semester: 1, pekan: 4 },
  { bulanKe: 9, semester: 1, pekan: 4 }, { bulanKe: 10, semester: 1, pekan: 3 },
  { bulanKe: 11, semester: 1, pekan: 4 }, { bulanKe: 12, semester: 1, pekan: 1 },
  { bulanKe: 1, semester: 2, pekan: 4 }, { bulanKe: 2, semester: 2, pekan: 3 },
  { bulanKe: 3, semester: 2, pekan: 1 }, { bulanKe: 4, semester: 2, pekan: 3 },
  { bulanKe: 5, semester: 2, pekan: 3 }, { bulanKe: 6, semester: 2, pekan: 1 },
]

export function kalenderBawaan(tahunAjaran: string): BulanKalender[] {
  const awal = Number(tahunAjaran.slice(0, 4))
  return POLA_BAWAAN.map(p => ({
    bulan: `${p.bulanKe >= 7 ? awal : awal + 1}-${String(p.bulanKe).padStart(2, '0')}`,
    semester: p.semester,
    pekan: p.pekan,
  }))
}

export interface ProgresKalender {
  semester: 1 | 2
  /** Bagian semester yang sudah lewat, 0–1, diukur dalam pekan efektif. */
  fraksi: number
}

/**
 * Seberapa jauh semester berjalan pada `tanggal`.
 *
 * `akhirBulan` true → dihitung seolah bulan itu sudah habis (untuk tabel
 * target akhir bulan). false → pekan efektif bulan berjalan diprorata menurut
 * tanggal, supaya siswa tidak tampak tertinggal hanya karena target akhir
 * bulan dibandingkan di tanggal 3.
 */
export function progresKalender(kalender: BulanKalender[], tanggal: string, akhirBulan = false): ProgresKalender {
  const kunci = tanggal.slice(0, 7)
  const urut = [...kalender].sort((a, b) => a.bulan.localeCompare(b.bulan))
  if (urut.length === 0) return { semester: 1, fraksi: 0 }
  if (kunci < urut[0].bulan) return { semester: 1, fraksi: 0 }
  const ini = urut.find(b => b.bulan === kunci)
  if (!ini) return { semester: 2, fraksi: 1 }

  const sesemester = urut.filter(b => b.semester === ini.semester)
  const total = sesemester.reduce((t, b) => t + b.pekan, 0)
  if (total <= 0) return { semester: ini.semester, fraksi: 0 }

  const sebelum = sesemester.filter(b => b.bulan < kunci).reduce((t, b) => t + b.pekan, 0)
  const [y, m] = kunci.split('-').map(Number)
  const jumlahHari = new Date(y, m, 0).getDate()
  const porsi = akhirBulan ? 1 : Math.min(1, Number(tanggal.slice(8, 10)) / jumlahHari)
  return { semester: ini.semester, fraksi: Math.min(1, (sebelum + ini.pekan * porsi) / total) }
}

// ─── Target & capaian ─────────────────────────────────────────────────────────

export function targetHalaman(kurva: KurvaRencana, tingkat: number, progres: ProgresKalender): { halaman: number; semester: SemesterKurva } | null {
  const s = semesterKurva(kurva, tingkat, progres.semester)
  if (!s) return null
  return { halaman: s.mulai + progres.fraksi * (s.akhir - s.mulai), semester: s }
}

/** Halaman kumulatif rencana bila hafalan sampai (surat, ayat); null bila posisinya di luar rencana. */
export function halamanPadaPosisi(kurva: KurvaRencana, peta: PetaHalaman, surat: number, ayat: number): number | null {
  const it = kurva.item.find(i => i.surat === surat && i.dari <= ayat && ayat <= i.ke)
  return it ? it.mulai + peta.bobot(surat, it.dari, ayat) : null
}

/**
 * Capaian seorang siswa dalam halaman kumulatif rencananya.
 *
 * Dua sumber, diambil yang lebih jauh:
 *   • juzTuntas — gabungan setoran & ujian (lib/data/hafalan.ts). Juz yang
 *     tuntas berarti seluruh materi rencana di juz itu terhitung.
 *   • setoran ziyadah terjauh dalam urutan rencana. Sesuai kesepakatan
 *     lib/rq/hafalan.ts, anak tidak melompati materi: sampai Al-Qalam 30
 *     berarti materi sebelumnya sudah dilewati.
 *
 * null = belum terukur. Itu BUKAN nol: sebagian besar capaian siswa masih
 * tercatat sebagai teks bebas di rangkuman bulanan, yang tidak dibaca di sini.
 *
 * `sumber` 'juz' berarti angkanya hanya bersandar pada juz yang sudah tuntas
 * (umumnya dari ujian) — itu BATAS BAWAH. Anak yang lulus ujian juz 30 dua
 * tahun lalu lalu tak pernah tercatat lagi terbaca berhenti di juz 30, padahal
 * belum tentu. Layar perlu mengatakannya, bukan menyajikannya seyakin posisi
 * dari setoran pekan ini.
 */
export function capaianSiswa(
  kurva: KurvaRencana,
  peta: PetaHalaman,
  input: { juzTuntas: number; ziyadah: { surat_id: number; ayat_ke: number }[] },
): { halaman: number; sumber: 'setoran' | 'juz' } | null {
  let terbaik: { halaman: number; sumber: 'setoran' | 'juz' } | null = null
  if (input.juzTuntas > 0) {
    const tuntas = new Set(URUTAN_JUZ.slice(0, input.juzTuntas))
    // Akhir juz terjauh yang tuntas, dengan syarat semua juz sebelumnya di
    // rencana juga tuntas — juz yang diujikan tidak membuat materi yang
    // dilompatinya ikut terhitung.
    let h = 0
    for (const j of kurva.akhirJuz) {
      if (!tuntas.has(j.juz)) break
      h = j.akhir
    }
    terbaik = { halaman: h, sumber: 'juz' }
  }
  for (const z of input.ziyadah) {
    const h = halamanPadaPosisi(kurva, peta, z.surat_id, z.ayat_ke)
    if (h !== null && (terbaik === null || h > terbaik.halaman)) terbaik = { halaman: h, sumber: 'setoran' }
  }
  return terbaik
}

export type StatusTarget = 'di_bawah' | 'sesuai' | 'di_atas'

/**
 * Selisih capaian terhadap target, dalam pekan materi.
 *
 * Satu pekan Kelas I QuLS ± ½ halaman, satu pekan Kelas VI ± 1¼ halaman —
 * mengukur dalam pekan membuat ambang yang sama adil untuk semua kelas.
 */
export function selisihPekan(capaian: number, target: number, laju: number): number {
  return laju > 0 ? (capaian - target) / laju : 0
}

/**
 * Ambang "sesuai target".
 *
 * Dua pekan ke tiap arah: data setoran masuk tidak selalu di hari yang sama
 * dengan setorannya, dan target bulan ini diprorata per tanggal — ambang satu
 * pekan akan membuat anak berganti status hanya karena gurunya mencatat hari
 * Senin, bukan Jumat.
 */
export const TOLERANSI_PEKAN = 2

export function statusTerhadapTarget(selisih: number): StatusTarget {
  if (selisih < -TOLERANSI_PEKAN) return 'di_bawah'
  if (selisih > TOLERANSI_PEKAN) return 'di_atas'
  return 'sesuai'
}

/**
 * Tindak lanjut untuk semester murojaah (SDIT kelas VI, SMPIT IX genap).
 *
 * Aturan RQ: yang belum menuntaskan juznya, targetnya menuntaskan hafalan juz
 * itu; yang sudah tuntas, targetnya mengujikan (tasmi') juz tersebut.
 */
export function tindakLanjutMurojaah(
  kurva: KurvaRencana,
  peta: PetaHalaman,
  capaian: number,
  juzUjian: number,
): { teks: string; perluDiujikan: number[] } {
  const bagian: string[] = []
  if (capaian < kurva.total - EPS) {
    const lanjut = posisiPada(kurva, peta, Math.min(kurva.total, capaian + 1e-6))
    if (lanjut) bagian.push(`Selesaikan hafalan juz ${juzMushafDariAyat(lanjut.surat, lanjut.ayat)}`)
  }
  const perluDiujikan = kurva.akhirJuz
    .filter(j => j.akhir <= capaian + EPS && (posisiJuz(j.juz) ?? 0) > juzUjian)
    .map(j => j.juz)
  if (perluDiujikan.length > 0) bagian.push(`Ujikan juz ${perluDiujikan.join(', ')}`)
  return { teks: bagian.length > 0 ? bagian.join(' · ') : 'Tuntas & sudah diujikan', perluDiujikan }
}
