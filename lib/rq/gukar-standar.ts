/**
 * Standar kepegawaian & penggolongan capaian gukar.
 *
 * Sumber: Laporan Eksekutif SDM — Capaian Tahsin & Tahfidz Guru dan Karyawan
 * SIT LHI, Juni 2026, bab 04 (acuan standar) dan bab 05 (penggolongan).
 * Angkanya sendiri berasal dari Peraturan Kepegawaian Yayasan Pionir
 * Pendidikan Indonesia — SOP Pengajuan Pegawai Tetap 2025.
 *
 * Ditaruh di lib/rq/ dan bukan di database karena ini ATURAN, bukan data:
 * ia berlaku sama untuk semua unit, jarang berubah, dan perubahannya berupa
 * revisi peraturan yayasan yang layak melewati review kode.
 */

import { hafalanDariTeks, predikatHafalan } from './quran'

// ─── Tangga tahap tahsin ─────────────────────────────────────────────────────

/**
 * Pilihan tahap tahsin gukar.
 *
 * Berbeda dari tangga santri (lib/rq/level.ts) pada dua hal yang nyata di
 * lapangan: BPH dibina lewat Metode Syajaroh yang tidak dipetakan ke jilid
 * UMMI sama sekali, dan sebagian pegawai memang belum mulai mengaji — dua
 * keadaan yang perlu bisa dicatat apa adanya, bukan dipaksa jadi "Jilid 1".
 */
export const TAHAP_TAHSIN = [
  'Belum mengaji',
  'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6',
  "Al-Qur'an", 'Ghorib', 'Tajwid', 'Tashih',
  'Syajaroh',
] as const

export type TahapTahsin = (typeof TAHAP_TAHSIN)[number]

/** Tahap yang berada DI ATAS atau setara ambang "Lulus UMMI Jilid 6". */
const TAHAP_LANJUT = new Set<string>(["Al-Qur'an", 'Ghorib', 'Tajwid', 'Tashih'])

export type KategoriTahsin =
  | 'lanjut' | 'jilid_6' | 'jilid_1_5' | 'syajaroh' | 'belum_mengaji' | 'tak_tercatat'

export const LABEL_TAHSIN: Record<KategoriTahsin, string> = {
  lanjut: "Al-Qur'an / Ghorib / Tashih",
  jilid_6: 'Jilid 6',
  jilid_1_5: 'Jilid 1–5',
  syajaroh: 'Metode Syajaroh',
  belum_mengaji: 'Belum mengaji',
  tak_tercatat: 'Belum tercatat',
}

/** Urutan tampil sebaran, dari yang paling maju. */
export const URUTAN_TAHSIN: KategoriTahsin[] = [
  'lanjut', 'jilid_6', 'jilid_1_5', 'syajaroh', 'belum_mengaji', 'tak_tercatat',
]

/**
 * Golongkan tahap tahsin menjadi kategori laporan.
 *
 * Syajaroh sengaja BUKAN "belum memenuhi": BPH dinilai lewat metode itu dan
 * tidak dipetakan ke ambang UMMI sama sekali. Menghitungnya sebagai gagal
 * akan membuat unit BPH tampak nol kesiapan padahal pengukurannya memang
 * memakai tangga yang berbeda — catatan kaki yang ditegaskan laporan.
 */
export function kategoriTahsinDariTahap(tahap: string): KategoriTahsin {
  const t = tahap.trim()
  if (!t) return 'tak_tercatat'
  if (t === 'Syajaroh') return 'syajaroh'
  if (t === 'Belum mengaji') return 'belum_mengaji'
  if (TAHAP_LANJUT.has(t)) return 'lanjut'
  if (t === 'Jilid 6') return 'jilid_6'
  if (/^Jilid [1-5]$/.test(t)) return 'jilid_1_5'
  return 'tak_tercatat'
}

/**
 * Simpulkan tahap tahsin dari catatan bebas pengampu.
 *
 * Dipakai hanya bila kolom terstruktur `tahap_tahsin` masih kosong — yakni
 * untuk seluruh data hasil impor rekap 2026, yang memang ditulis bebas.
 */
export function tahapDariTeks(teks: string): TahapTahsin | '' {
  const t = (teks ?? '').toLowerCase().trim()
  if (!t || t === '-' || t === '—') return ''
  if (/belum\s*(mengaji|ngaji|mulai|dimulai)/.test(t)) return 'Belum mengaji'
  if (/syajaroh|syajarah|sajaroh/.test(t)) return 'Syajaroh'
  if (/tas?hi[hs]|tashih/.test(t)) return 'Tashih'
  if (/gh?[ao]rib/.test(t)) return 'Ghorib'
  if (/tajwid/.test(t)) return 'Tajwid'
  if (/qur.?.?an|mushaf/.test(t)) return "Al-Qur'an"

  // Angka setelah "hal" adalah halaman, bukan nomor jilid.
  const sebelumHalaman = t.split(/\bhal\b|\bhalaman\b/)[0]
  const angka = Number(sebelumHalaman.match(/\d+/)?.[0])
  if (Number.isInteger(angka) && angka >= 1 && angka <= 6) return `Jilid ${angka}` as TahapTahsin

  // Nama surah di kolom tahsin berarti sudah membaca dari mushaf.
  if (/\bayat\b/.test(t) || /^(al|an|ar|as|asy|ash|at|adh|az)[\s-]/.test(t)) return "Al-Qur'an"

  return ''
}

// ─── Standar kepegawaian (bab 04) ────────────────────────────────────────────

export interface StandarPeran {
  key: string
  label: string
  /** Ambang tahsin apa adanya dari peraturan. */
  tahsin: string
  /** Tahap minimum pada TAHAP_TAHSIN yang memenuhi ambang di atas. */
  tahapMinimum: TahapTahsin
  minJuz: number
  nilaiMin: number
  suratPilihan: number
  bahasaInggris: string
  catatan?: string
}

export const STANDAR_PERAN: StandarPeran[] = [
  {
    key: 'guru_kelas',
    label: 'Guru kelas SD/SMP, Musyrif/ah',
    tahsin: 'Lulus UMMI Jilid 6',
    tahapMinimum: 'Jilid 6',
    minJuz: 1, nilaiMin: 75, suratPilihan: 1, bahasaInggris: 'B1',
  },
  {
    key: 'guru_tpait',
    label: 'Guru TPAIT',
    tahsin: 'Lulus UMMI Jilid 6',
    tahapMinimum: 'Jilid 6',
    minJuz: 1, nilaiMin: 75, suratPilihan: 1, bahasaInggris: 'A2',
  },
  {
    key: 'guru_quran',
    label: "Guru Qur'an Rumah Qur'an",
    tahsin: 'Lulus Sertifikasi',
    tahapMinimum: 'Tashih',
    minJuz: 3, nilaiMin: 80, suratPilihan: 3, bahasaInggris: 'A2',
    catatan: 'Surat pilihan di luar juz yang dihafal — acuan Jalur Standar Guru Quls',
  },
  {
    key: 'karyawan_umum',
    label: 'Karyawan (FO, Pustakawan, Laboran, Pengasuh)',
    tahsin: 'Lulus UMMI Jilid 4',
    tahapMinimum: 'Jilid 4',
    minJuz: 1, nilaiMin: 70, suratPilihan: 1, bahasaInggris: '–',
  },
  {
    key: 'karyawan_psikolog',
    label: 'Karyawan (Psikolog)',
    tahsin: 'Lulus UMMI Jilid 6',
    tahapMinimum: 'Jilid 6',
    minJuz: 1, nilaiMin: 75, suratPilihan: 1, bahasaInggris: '–',
  },
  {
    key: 'karyawan_k3',
    label: 'Karyawan (K3, Satpam, Driver)',
    tahsin: 'Lulus UMMI Jilid 3',
    tahapMinimum: 'Jilid 3',
    minJuz: 1, nilaiMin: 60, suratPilihan: 0, bahasaInggris: '–',
  },
  {
    key: 'staff_plc',
    label: 'Staff Pionir Language Center',
    tahsin: 'Lulus UMMI Jilid 6',
    tahapMinimum: 'Jilid 6',
    minJuz: 1, nilaiMin: 75, suratPilihan: 1, bahasaInggris: 'B2',
  },
  {
    key: 'staff_it_humas',
    label: 'Staff IT & Humas Yayasan',
    tahsin: 'Lulus UMMI Jilid 6',
    tahapMinimum: 'Jilid 6',
    minJuz: 1, nilaiMin: 75, suratPilihan: 1, bahasaInggris: 'B1',
  },
]

export const STANDAR_BY_KEY = new Map(STANDAR_PERAN.map(s => [s.key, s]))

/**
 * Ambang inti yang dipakai bila kategori peran seseorang belum ditetapkan.
 *
 * Laporan menghitung "kesiapan gabungan" dengan satu ambang untuk semua —
 * Jilid 6 + 1 juz — justru karena kategori peran belum terpetakan per orang.
 * Selama kolom kategori_peran masih kosong, angka di aplikasi harus tetap
 * bisa dibandingkan dengan laporan itu, jadi ambang ini yang dipakai.
 */
export const AMBANG_INTI = {
  tahapMinimum: 'Jilid 6' as TahapTahsin,
  minJuz: 1,
}

export const LABEL_STATUS_PEGAWAI: Record<string, string> = {
  tetap: 'Pegawai tetap',
  calon_tetap: 'Calon pegawai tetap',
  kontrak: 'Kontrak',
}

// ─── Penilaian satu peserta ──────────────────────────────────────────────────

export interface PenilaianTahsin {
  tahap: string
  kategori: KategoriTahsin
  /** Menyentuh atau melampaui ambang Jilid 6. */
  memenuhi: boolean
  /** Sumber kesimpulan: kolom terstruktur atau tebakan dari teks bebas. */
  tersirat: boolean
}

export interface PenilaianTahfidz {
  label: string
  juz: number | null
  juzTuntas: number | null
  nilai: number | null
  predikat: string
  suratPilihan: number
  /** Sudah menuntaskan minimal satu juz. */
  memenuhi: boolean
  tersirat: boolean
}

/**
 * Kolom terstruktur menang atas teks bebas; teks bebas dipakai bila kosong.
 *
 * Urutan ini yang membuat data lama tetap terbaca tanpa memaksa pengampu
 * mengisi ulang, sekaligus membuat data baru tidak lagi bergantung tebakan.
 */
export function nilaiTahsin(tahapTerstruktur: string, teksBebas: string): PenilaianTahsin {
  const terstruktur = (tahapTerstruktur ?? '').trim()
  const tahap = terstruktur || tahapDariTeks(teksBebas ?? '')
  const kategori = kategoriTahsinDariTahap(tahap)
  return {
    tahap,
    kategori,
    memenuhi: kategori === 'lanjut' || kategori === 'jilid_6',
    tersirat: !terstruktur && Boolean(tahap),
  }
}

export function nilaiTahfidz(
  juzTuntas: number | null,
  juzBerjalan: number | null,
  nilai: number | null,
  suratPilihan: number,
  teksBebas: string,
): PenilaianTahfidz {
  const adaTerstruktur = juzTuntas !== null || juzBerjalan !== null

  if (adaTerstruktur) {
    const tuntas = juzTuntas ?? 0
    const label = juzBerjalan
      ? `${tuntas} juz tuntas · sedang juz ${juzBerjalan}`
      : `${tuntas} juz tuntas`
    return {
      label,
      juz: juzBerjalan,
      juzTuntas: tuntas,
      nilai,
      predikat: predikatHafalan(nilai),
      suratPilihan,
      memenuhi: tuntas >= 1,
      tersirat: false,
    }
  }

  const dariTeks = hafalanDariTeks(teksBebas ?? '')
  return {
    label: dariTeks.label,
    juz: dariTeks.juz,
    juzTuntas: null,
    nilai,
    predikat: predikatHafalan(nilai),
    suratPilihan,
    memenuhi: dariTeks.minSatuJuz,
    tersirat: Boolean(dariTeks.label),
  }
}

export type KategoriTahfidz = 'min_1_juz' | 'proses_juz_30' | 'tak_tercatat'

export const LABEL_TAHFIDZ: Record<KategoriTahfidz, string> = {
  min_1_juz: 'Tuntas ≥ 1 juz',
  proses_juz_30: 'Dalam proses Juz 30',
  tak_tercatat: 'Belum tercatat',
}

export const URUTAN_TAHFIDZ: KategoriTahfidz[] = ['min_1_juz', 'proses_juz_30', 'tak_tercatat']

export function kategoriTahfidz(p: PenilaianTahfidz): KategoriTahfidz {
  if (p.memenuhi) return 'min_1_juz'
  if (p.juz !== null || p.juzTuntas !== null || p.label) return 'proses_juz_30'
  return 'tak_tercatat'
}

/**
 * Status seseorang terhadap standar perannya — kalimat pendek untuk tabel.
 *
 * Bila kategori perannya belum ditetapkan SDM, yang dipakai ambang inti, dan
 * itu dinyatakan terus terang lewat `acuan` supaya pembaca tahu angka mana
 * yang sedang dibandingkan.
 */
export function statusTerhadapStandar(
  tahsin: PenilaianTahsin,
  tahfidz: PenilaianTahfidz,
  kategoriPeran: string,
): { teks: string; memenuhi: boolean; acuan: string } {
  const standar = STANDAR_BY_KEY.get(kategoriPeran)
  const acuan = standar ? standar.label : 'Ambang inti (Jilid 6 + 1 juz)'

  const perluTahsin = standar
    ? !memenuhiTahap(tahsin.tahap, standar.tahapMinimum)
    : !tahsin.memenuhi
  const perluTahfidz = standar
    ? (tahfidz.juzTuntas ?? (tahfidz.memenuhi ? 1 : 0)) < standar.minJuz
    : !tahfidz.memenuhi

  if (tahsin.kategori === 'syajaroh') {
    return { teks: 'Metode Syajaroh — di luar ambang UMMI', memenuhi: false, acuan }
  }
  if (perluTahsin && perluTahfidz) return { teks: 'Perlu tahsin & tahfidz', memenuhi: false, acuan }
  if (perluTahsin) return { teks: 'Tahfidz ✓ — perlu verifikasi tahsin', memenuhi: false, acuan }
  if (perluTahfidz) return { teks: 'Tahsin ✓ — perlu tuntaskan hafalan', memenuhi: false, acuan }
  return { teks: 'Memenuhi ambang', memenuhi: true, acuan }
}

/** Apakah tahap sudah setara atau melampaui tahap minimum yang disyaratkan. */
function memenuhiTahap(tahap: string, minimum: TahapTahsin): boolean {
  const a = (TAHAP_TAHSIN as readonly string[]).indexOf(tahap)
  const b = (TAHAP_TAHSIN as readonly string[]).indexOf(minimum)
  if (a === -1 || b === -1) return false
  // Syajaroh berada di luar tangga UMMI, jadi tidak pernah dianggap memenuhi
  // ambang jilid — perbandingan indeks saja akan keliru menyatakannya lulus.
  if (tahap === 'Syajaroh') return false
  return a >= b
}
