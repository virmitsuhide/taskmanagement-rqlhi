import type { KaldiEvent } from '@/types'

/**
 * Agenda kalender pendidikan (kaldik) — sumbernya aplikasi lain.
 *
 * Dipakai dua tempat: kalender beranda publik dan Kalender Qur'an milik
 * koordinator. Satu modul supaya keduanya membaca agenda yang sama; kalau
 * disalin, dua kalender di aplikasi yang sama bisa menampilkan hari libur
 * yang berbeda.
 *
 * Datanya TIDAK pernah dipakai langsung sebagai keputusan. Di Kalender
 * Qur'an ia hanya usulan yang disahkan koordinator: feed ini milik sistem
 * lain dan bisa berubah kapan saja, sedangkan TM yang sudah jadi penyebut
 * kehadiran di rapor tidak boleh ikut berubah diam-diam.
 */

const KALDI_BASE = 'https://kaldikrqlhi.vercel.app'

/** Identitas logis satu agenda — dipakai membuang duplikat dari sumbernya. */
export function kaldikKey(e: KaldiEvent): string {
  return `${e.date ?? e.start ?? ''}|${e.title}|${e.unit ?? ''}`
}

async function getTahun(year: number): Promise<KaldiEvent[]> {
  try {
    const res = await fetch(`${KALDI_BASE}/api/calendar?year=${year}`, {
      next: { revalidate: 300 }, // 5 menit
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.events ?? []) as KaldiEvent[]
  } catch {
    // Sumber luar yang sedang mati tidak boleh menjatuhkan halaman yang
    // memakainya — kalendernya tetap tampil, hanya tanpa catatan agenda.
    return []
  }
}

/**
 * Agenda beberapa tahun sekaligus, tanpa duplikat.
 *
 * Tahun ajaran membentang dua tahun kalender, jadi pemanggil lazimnya
 * meminta tahun ini dan tahun depan — tanpa itu Januari selalu kosong
 * setiap kali Desember terlewati. Tahun yang belum diisi membalas `[]`.
 */
export async function getKaldikEvents(years: number[]): Promise<KaldiEvent[]> {
  const semua = (await Promise.all(years.map(getTahun))).flat()
  const sudah = new Set<string>()
  const unik: KaldiEvent[] = []
  for (const e of semua) {
    const k = kaldikKey(e)
    if (sudah.has(k)) continue
    sudah.add(k)
    unik.push(e)
  }
  return unik
}

/** Tanggal agenda dalam bentuk 'YYYY-MM-DD', atau null bila tak terbaca. */
export function tanggalKaldik(e: KaldiEvent): string | null {
  const nilai = e.date ?? e.start
  if (typeof nilai !== 'string') return null
  const iso = nilai.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

/**
 * Agenda satu bulan, dikelompokkan per tanggal, disaring untuk satu unit.
 *
 * Agenda ber-unit NASIONAL (dan yang tanpa unit) berlaku untuk semua — libur
 * nasional mengenai seluruh sekolah.
 */
export function agendaPerTanggal(events: KaldiEvent[], unitKode: string): Map<string, KaldiEvent[]> {
  const per = new Map<string, KaldiEvent[]>()
  for (const e of events) {
    const t = tanggalKaldik(e)
    if (!t) continue
    const unit = String(e.unit ?? '').toUpperCase()
    if (unit && unit !== 'NASIONAL' && unit !== unitKode.toUpperCase()) continue
    per.set(t, [...(per.get(t) ?? []), e])
  }
  return per
}

/** Agenda yang bertipe libur — usulan paling kuat untuk ditandai kosong. */
export function adalahLibur(e: KaldiEvent): boolean {
  return String(e.type ?? '').toLowerCase().includes('libur')
}
