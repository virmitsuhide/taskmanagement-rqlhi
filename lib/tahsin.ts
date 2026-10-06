/**
 * Konstanta & helper domain Tahsin/Tahfidz RQ LHI.
 *
 * File ini bebas dependensi server (boleh di-import client component & server).
 * Sumber kebenaran metode/jilid tetap di database (tabel tahsin_methods &
 * jilid_levels, di-seed via scripts/seed-phase0.ts). Di sini hanya aturan
 * bisnis statis: pemetaan jenjang→metode dan label tampilan.
 */
import { isQulsSdProgram } from '@/lib/rq/programs'
import type { Jenjang, TahfidzKind, TasmiScope } from '@/types'

// Nama metode — harus sama persis dengan kolom `name` di tabel tahsin_methods.
export const METHOD = {
  UMMI: 'UMMI',
  KIBAR: 'KIBAR',
  SYAJAROH: 'Syajaroh',
  IQRO: 'IQRO',
  UMMI_DEWASA: 'UMMI Dewasa',
} as const

/**
 * Metode tahsin yang berlaku per jenjang/unit (kebijakan RQ LHI):
 *  - PAUD          : UMMI
 *  - SD LHI        : UMMI + KIBAR
 *  - SD LHI Juara  : KIBAR (kelas 1) + IQRO (kelas 2-6, sejak 0101)
 *  - SMP           : Syajaroh; angkatan kelas 9 non-QULS (2026/2027) masih
 *                    UMMI Dewasa — 3 jilid → Al-Qur'an T1–T3 → Talaqqi
 *                    Mandiri → Gharib → Tajwid (0112)
 *  - SMA           : Syajaroh
 */
export const JENJANG_METHODS: Record<Jenjang, string[]> = {
  paud: [METHOD.UMMI],
  sd: [METHOD.UMMI, METHOD.KIBAR],
  sd_juara: [METHOD.KIBAR, METHOD.IQRO],
  smp: [METHOD.SYAJAROH, METHOD.UMMI_DEWASA],
  sma: [METHOD.SYAJAROH],
}

/**
 * Metode yang berlaku untuk satu program di dalam jenjangnya.
 *
 * Sejauh ini hanya QULS SD yang lebih sempit daripada unitnya: SD secara umum
 * memakai UMMI dan KIBAR, tapi kelompok QULS SD seluruhnya KIBAR. Aturannya
 * ditaruh di sini, satu tempat, supaya formulir siswa, berkas impor, dan
 * pemeriksaan di server tidak bisa berbeda pendapat.
 */
export function methodsForProgram(jenjang: Jenjang, program: string | null | undefined): string[] | null {
  if (isQulsSdProgram(jenjang, program)) return [METHOD.KIBAR]
  return null
}

/**
 * Saring daftar metode (dari DB) menjadi hanya yang relevan untuk satu jenjang.
 * Jika jenjang tak dikenal, kembalikan semua (fallback aman).
 *
 * `program` opsional: diisi kalau pemanggilnya tahu program siswa/kelompoknya,
 * dan hanya bisa MENYEMPITKAN hasilnya — tidak pernah menambah metode yang
 * tidak berlaku untuk jenjang itu.
 */
export function methodsForJenjang<T extends { name: string }>(
  jenjang: Jenjang | null | undefined,
  methods: T[],
  program?: string | null,
): T[] {
  if (!jenjang) return methods
  const allowed = JENJANG_METHODS[jenjang]
  if (!allowed) return methods
  const perProgram = methodsForProgram(jenjang, program)
  const berlaku = perProgram ? allowed.filter(n => perProgram.includes(n)) : allowed
  return methods.filter(m => berlaku.includes(m.name))
}

/**
 * Tahap metode yang hanya berlaku di unit tertentu — label tahap (huruf kecil)
 * → unit yang memakainya. Tahap yang tidak disebut berlaku di semua unit.
 *
 * KIBAR SD LHI Juara memakai buku "Pra" sebelum Jilid 1 (Pra, Jilid 1–3,
 * Al-Qur'an, Lulus Tahsin); KIBAR SD LHI langsung mulai Jilid 1. Keduanya
 * satu metode di jilid_levels, jadi Pra disembunyikan dari unit lain di sini:
 * formulir siswa, pilihan jilid awal, dan kolom tabel capaian.
 *
 * Begitu pula UMMI: PAUD/TPAIT memulai dari buku "Pra-UMMI" (40 halaman)
 * sebelum Jilid 1, sedangkan siswa SD bermetode UMMI langsung Jilid 1.
 */
const TAHAP_KHUSUS_UNIT: Partial<Record<string, Record<string, Jenjang[]>>> = {
  [METHOD.KIBAR]: { pra: ['sd_juara'] },
  [METHOD.UMMI]: { 'pra-ummi': ['paud'] },
}

/** Apakah tahap `label` metode `metode` berlaku bagi siswa unit `jenjang`. Tanpa jenjang/metode: berlaku. */
export function tahapBerlaku(metode: string | null | undefined, label: string, jenjang: Jenjang | null | undefined): boolean {
  if (!metode || !jenjang) return true
  const khusus = TAHAP_KHUSUS_UNIT[metode]?.[label.trim().toLowerCase()]
  return !khusus || khusus.includes(jenjang)
}

// ─── Tampilan jenis setoran tahfidz ─────────────────────────────────
export interface TahfidzKindMeta {
  label: string
  emoji: string
  hint: string
  /** warna teks & latar untuk badge */
  fg: string
  bg: string
  /** apakah jenis ini menambah progress hafalan juz (hanya ziyadah) */
  addsProgress: boolean
}

export const TAHFIDZ_KIND_META: Record<TahfidzKind, TahfidzKindMeta> = {
  ziyadah: {
    label: 'Ziyadah',
    emoji: '✨',
    hint: 'Tambah hafalan baru — dihitung ke progress juz',
    fg: 'var(--primary)',
    bg: 'var(--primary-wash)',
    addsProgress: true,
  },
  murojaah_baru: {
    label: "Muroja'ah Baru",
    emoji: '🔁',
    hint: 'Mengulang hafalan di juz yang sedang berjalan',
    fg: '#1d4ed8',
    bg: '#dbeafe',
    addsProgress: false,
  },
  murojaah_lama: {
    label: "Muroja'ah Lama",
    emoji: '📚',
    hint: 'Mengulang juz yang sudah diujikan (dijuz’iyahkan)',
    fg: '#7c3aed',
    bg: '#ede9fe',
    addsProgress: false,
  },
  tasmi: {
    label: "Tasmi'",
    emoji: '🎤',
    hint: 'Menyetorkan 3 atau 5 juz sekaligus',
    fg: '#b45309',
    bg: '#fef3c7',
    addsProgress: false,
  },
}

// Urutan jenis yang ditampilkan di form harian (tasmi punya alur sendiri).
export const TAHFIDZ_DAILY_KINDS: TahfidzKind[] = ['ziyadah', 'murojaah_baru', 'murojaah_lama']

// Pilihan cakupan tasmi
export const TASMI_SCOPES: TasmiScope[] = [3, 5]
