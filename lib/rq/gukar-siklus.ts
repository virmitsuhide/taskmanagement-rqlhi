import type { PeriodKey } from '@/lib/finance/period'

/**
 * Kalender pembinaan gukar: siklus Senin–Jumat dan kunci setoran bulanan.
 *
 * Modul murni — dipanggil dari server action maupun formulir klien, jadi
 * tidak menyentuh database dan tidak bergantung pada zona waktu mesin.
 * Semua tanggal berupa string 'YYYY-MM-DD' yang sudah dipaku ke WIB oleh
 * pemanggilnya (lihat hariIni() di lib/rutin/periode).
 *
 * KENAPA SIKLUS, BUKAN TANGGAL
 *
 * Satu siklus setoran adalah Senin sampai Jumat. Peserta menyetor di hari
 * yang berbeda-beda di dalam siklus itu, jadi "pekan ke-2" tidak bisa
 * diturunkan dari tanggal 8–14 — tanggal 8 bisa jatuh di hari Kamis, dan
 * setoran Kamis itu sesiklus dengan setoran Senin tanggal 5.
 */

export interface Siklus {
  /** Senin pembuka siklus, 'YYYY-MM-DD'. */
  senin: string
  /** Jumat penutup siklus, 'YYYY-MM-DD'. */
  jumat: string
}

// Aritmetika tanggal di UTC: 'YYYY-MM-DD' tidak membawa jam, dan UTC tidak
// punya DST yang bisa menggeser hasil tambah-hari ke tanggal sebelahnya.
function keUtc(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function keIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function tambahHari(iso: string, n: number): string {
  const d = keUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return keIso(d)
}

/** Senin = 0 … Ahad = 6. */
function indeksHari(iso: string): number {
  return (keUtc(iso).getUTCDay() + 6) % 7
}

/** Tanggal terakhir sebuah periode, mis. '2026-09' → '2026-09-30'. */
export function akhirBulan(period: PeriodKey): string {
  const [y, m] = period.split('-').map(Number)
  return keIso(new Date(Date.UTC(y, m, 0)))
}

/**
 * Siklus yang memuat tanggal ini. Sabtu & Ahad ikut siklus yang baru saja
 * selesai — setoran susulan di akhir pekan tetap milik pekan itu.
 */
export function siklusDari(iso: string): Siklus {
  const senin = tambahHari(iso, -indeksHari(iso))
  return { senin, jumat: tambahHari(senin, 4) }
}

/**
 * Siklus-siklus Senin–Jumat milik satu bulan — penyebut bawaan kehadiran.
 *
 * Pekan yang tertelak di pergantian bulan (mis. Senin 28 Sep – Jumat 2 Okt)
 * harus masuk ke tepat SATU bulan, supaya satu siklus tidak terhitung dua kali
 * di rekap semester, dan tidak pula hilang dari keduanya.
 */
export function siklusDalamBulan(period: PeriodKey): Siklus[] {
  const awal = `${period}-01`
  const akhir = akhirBulan(period)
  const hasil: Siklus[] = []

  // Kandidat: setiap siklus yang menyentuh bulan ini sedikit pun, mulai dari
  // siklus yang memuat tanggal 1 sampai siklus yang memuat tanggal terakhir.
  for (let s = siklusDari(awal); s.senin <= akhir; s = siklusDari(tambahHari(s.senin, 7))) {
    // TODO(pengguna): tentukan siklus pergantian bulan milik bulan yang mana.
    //   Saat ini `s.senin` dan `s.jumat` tersedia; bandingkan dengan `awal` / `akhir`.
    //   Contoh pilihan aturan:
    //     • ikut bulan hari Seninnya   → s.senin >= awal
    //     • ikut bulan hari Jumatnya   → s.jumat <= akhir
    //     • ikut mayoritas hari (Rabu) → tambahHari(s.senin, 2) antara awal dan akhir
    //     • hanya siklus utuh          → s.senin >= awal && s.jumat <= akhir
    //   Push `s` ke `hasil` bila siklus ini milik bulan `period`.
    void s
  }

  return hasil
}

/** '14–18 Sep' atau '28 Sep – 2 Okt' — label siklus untuk layar. */
export function labelSiklus(s: Siklus): string {
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const [, m1, d1] = s.senin.split('-').map(Number)
  const [, m2, d2] = s.jumat.split('-').map(Number)
  return m1 === m2
    ? `${d1}–${d2} ${BULAN[m2 - 1]}`
    : `${d1} ${BULAN[m1 - 1]} – ${d2} ${BULAN[m2 - 1]}`
}

/** 'Rab 16/9' — tanggal setoran ringkas untuk kartu peserta. */
export function labelHariSetor(iso: string): string {
  const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ahd']
  const [, m, d] = iso.split('-').map(Number)
  return `${HARI[indeksHari(iso)]} ${d}/${m}`
}

// ─── Kunci setoran akhir ─────────────────────────────────────────────────────

export type StatusSetoranBulan =
  /** Setoran masih bisa ditambah; posisi terakhir adalah setoran SEDANG. */
  | 'berjalan'
  /** Pengampu mengunci lebih awal — posisi terakhir sudah menjadi AKHIR. */
  | 'dikunci'
  /** Bulannya sudah lewat; terkunci otomatis. */
  | 'selesai'

/**
 * Status setoran satu bulan.
 *
 * "Selesai" tidak disimpan di database: ia dihitung dari kalender setiap kali
 * dibaca. Kunci otomatis yang ditulis penjadwal bisa terlambat atau terlewat;
 * tanggal hari ini tidak.
 */
export function statusSetoranBulan(
  period: PeriodKey,
  hariIni: string,
  dikunciAt: string | null | undefined,
): StatusSetoranBulan {
  if (hariIni > akhirBulan(period)) return 'selesai'
  if (dikunciAt) return 'dikunci'
  return 'berjalan'
}
