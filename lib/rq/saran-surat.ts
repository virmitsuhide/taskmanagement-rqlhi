import { juzSurah } from '@/lib/rq/batas-juz'

/**
 * Pencarian & saran surat untuk isian setoran tahfidz (PilihSurat).
 *
 * Murni, tanpa basis data — dipakai komponen klien. Datanya dioper pemanggil:
 * daftar surat_master dan posisi hafalan anak (getHafalanSaran).
 */

/** Posisi hafalan seorang anak: juz yang sudah tuntas dan juz yang sedang dihafal. */
export interface HafalanSaran {
  tuntas: number[]
  berjalan: number | null
}

/** Kelompok saran di atas daftar surat. */
export interface SaranSurat {
  judul: string
  ids: number[]
}

/** Surat yang tersentuh sekumpulan juz, urut mushaf — Al-Baqarah ikut juz 1, 2, dan 3. */
export function suratDiJuz(juz: number[]): number[] {
  const set = new Set(juz)
  const hasil: number[] = []
  for (let s = 1; s <= 114; s++) if (juzSurah(s).some(j => set.has(j))) hasil.push(s)
  return hasil
}

const rentangJuz = (juz: number[]) => [...juz].sort((a, b) => a - b).join(', ')

/**
 * Saran per jenis muroja'ah:
 *   - baru : surat di juz yang SEDANG dihafal (bila belum ada, juz tuntas terakhir);
 *   - lama : surat di juz yang sudah tuntas.
 * Ziyadah tidak diberi saran di sini — isiannya sudah melanjutkan setoran terakhir.
 */
export function saranMurojaah(jenis: string, h: HafalanSaran | undefined): SaranSurat | null {
  if (!h) return null
  if (jenis === 'murojaah_baru') {
    const juz = h.berjalan ?? h.tuntas.at(-1) ?? null
    if (juz === null) return null
    return { judul: h.berjalan !== null ? `Juz ${juz} · sedang dihafal` : `Juz ${juz} · tuntas terakhir`, ids: suratDiJuz([juz]) }
  }
  if (jenis === 'murojaah_lama') {
    if (h.tuntas.length === 0) return null
    return { judul: `Juz tuntas · ${rentangJuz(h.tuntas)}`, ids: suratDiJuz(h.tuntas) }
  }
  return null
}

/**
 * Surat yang tercatat dihafal (juz tuntas + juz berjalan). Hanya dipakai untuk
 * keterangan "belum tercatat hafal" — TIDAK untuk menolak: catatan hafalan di
 * sistem belum lengkap, dan pembatasan keras hanya mendorong guru memilih
 * surat yang salah.
 */
export function suratTercatatHafal(h: HafalanSaran | undefined): Set<number> | null {
  if (!h || (h.tuntas.length === 0 && h.berjalan === null)) return null
  return new Set(suratDiJuz([...h.tuntas, ...(h.berjalan !== null ? [h.berjalan] : [])]))
}

// ─── Pencarian ───────────────────────────────────────────────────────────────

/** "An-Nazi‘at" → "annaziat": huruf kecil, tanpa tanda hubung, apostrof, spasi. */
function rapat(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
}

/** Kata sandang di depan nama surat — "Al-", "An-", "Asy-", … */
const SANDANG = /^(al|an|ar|as|asy|ash|at|ad|adh|az|ath)[\s\-‑'’‘]+/i

/** Nama populer yang tidak tertulis di nama latinnya. */
const NAMA_LAIN: Record<string, number> = {
  tabarak: 67, tabaraka: 67, amma: 78, ammayatasaalun: 78, yasin: 36, yaasiin: 36, kahfi: 18, qulhu: 112,
}

/**
 * Apakah kueri cocok dengan sebuah surat. Longgar terhadap ejaan: "naba",
 * "an naba", "An-Naba'" sama; nomor surat juga diterima ("67").
 */
export function cocokSurat(kueri: string, s: { id: number; name_latin: string }): boolean {
  const q = rapat(kueri)
  if (!q) return true
  if (/^\d+$/.test(q)) return String(s.id).startsWith(q)
  const nama = rapat(s.name_latin)
  const inti = rapat(s.name_latin.replace(SANDANG, ''))
  const qInti = rapat(kueri.trim().replace(SANDANG, ''))
  if (NAMA_LAIN[q] === s.id) return true
  return nama.includes(q) || inti.startsWith(qInti) || inti.includes(qInti)
}

/**
 * Peringkat hasil pencarian (kecil = di atas): nama yang persis sama, lalu
 * yang DIAWALI kueri ("mu" → Al-Mulk, Al-Muzzammil, …), lalu yang hanya
 * memuatnya; di dalam tiap kelompok menurut nomor surat.
 */
export function peringkatSurat(kueri: string, s: { id: number; name_latin: string }): number {
  const qInti = rapat(kueri.trim().replace(SANDANG, ''))
  if (!qInti || /^\d+$/.test(qInti)) return s.id
  const inti = rapat(s.name_latin.replace(SANDANG, ''))
  if (inti === qInti) return s.id
  if (inti.startsWith(qInti)) return 1000 + s.id
  return 2000 + s.id
}
