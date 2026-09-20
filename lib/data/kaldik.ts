import { createServerClient } from '@/lib/supabase/server'
import type { KaldiEvent } from '@/types'

/**
 * Agenda kalender pendidikan (kaldik).
 *
 * Dulu tinggal di aplikasi terpisah (kaldikrqlhi) dan dibaca lewat HTTP;
 * sejak 0085 ia tabel biasa di basis data yang sama, dan aplikasi lama itu
 * sudah dipensiunkan. Yang berubah bukan cuma tempatnya: agenda kini
 * disunting dengan akun yang sama, tunduk pada RBAC yang sama, dan terbaca
 * seketika — bukan setelah singgahan lima menit.
 *
 * Dipakai dua tempat: kalender beranda publik dan Kalender Qur'an milik
 * koordinator. Satu modul supaya keduanya membaca agenda yang sama.
 *
 * Di Kalender Qur'an, agenda tetap hanya USULAN yang disahkan koordinator.
 * Agenda boleh berubah kapan saja, sedangkan TM yang sudah jadi penyebut
 * kehadiran di rapor tidak boleh ikut berubah diam-diam.
 */

export const KALDIK_UNIT = ['NASIONAL', 'SD', 'SMP', 'RQ'] as const
export type KaldikUnit = (typeof KALDIK_UNIT)[number]

export const KALDIK_TIPE = ['agenda', 'libur_nasional', 'libur_semester', 'ramadhan', 'kegiatan_bersama'] as const
export type KaldikTipe = (typeof KALDIK_TIPE)[number]

export const TIPE_LABEL: Record<KaldikTipe, string> = {
  agenda: 'Agenda',
  libur_nasional: 'Libur nasional',
  libur_semester: 'Libur semester',
  ramadhan: 'Ramadhan',
  kegiatan_bersama: 'Kegiatan bersama',
}

/** Warna bawaan tiap tipe — mengikuti kalender lama supaya tidak asing. */
export const TIPE_WARNA: Record<KaldikTipe, string> = {
  agenda: '#3B82F6',
  libur_nasional: '#EF4444',
  libur_semester: '#DC2626',
  ramadhan: '#F97316',
  kegiatan_bersama: '#8B5CF6',
}

/** Identitas logis satu agenda — dipakai membuang duplikat. */
export function kaldikKey(e: KaldiEvent): string {
  return `${e.date ?? e.start ?? ''}|${e.title}|${e.unit ?? ''}`
}

/**
 * Agenda beberapa tahun sekaligus, tanpa duplikat.
 *
 * Tahun ajaran membentang dua tahun kalender, jadi pemanggil lazimnya meminta
 * tahun ini dan tahun depan — tanpa itu Januari selalu kosong setiap kali
 * Desember terlewati.
 */
export async function getKaldikEvents(years: number[]): Promise<KaldiEvent[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kaldik_events')
    .select('id, date, title, description, unit, type, color, year')
    .in('year', years)
    .order('date')

  // Galat dibiarkan menjadi daftar kosong, bukan jatuh ke sumber lain:
  // aplikasi kaldik lama sudah tidak ada, dan tabel ini satu-satunya sumber.
  const baris = error ? [] : ((data ?? []) as KaldiEvent[])

  const sudah = new Set<string>()
  const unik: KaldiEvent[] = []
  for (const e of baris) {
    const k = kaldikKey(e)
    if (sudah.has(k)) continue
    sudah.add(k)
    unik.push(e)
  }
  return unik
}

/** Satu tahun penuh, untuk layar kalender. */
export async function getKaldikTahun(year: number): Promise<{ tabelAda: boolean; events: KaldiEvent[] }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kaldik_events')
    .select('id, date, title, description, unit, type, color, year')
    .eq('year', year)
    .order('date')
  if (error) return { tabelAda: false, events: [] }
  return { tabelAda: true, events: (data ?? []) as KaldiEvent[] }
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
 * nasional mengenai seluruh sekolah. Begitu pula RQ, yang agendanya menyentuh
 * seluruh unit yang diampunya.
 */
export function agendaPerTanggal(events: KaldiEvent[], unitKode: string): Map<string, KaldiEvent[]> {
  const per = new Map<string, KaldiEvent[]>()
  for (const e of events) {
    const t = tanggalKaldik(e)
    if (!t) continue
    const unit = String(e.unit ?? '').toUpperCase()
    if (unit && unit !== 'NASIONAL' && unit !== 'RQ' && unit !== unitKode.toUpperCase()) continue
    per.set(t, [...(per.get(t) ?? []), e])
  }
  return per
}

/** Agenda yang bertipe libur — usulan paling kuat untuk ditandai kosong. */
export function adalahLibur(e: KaldiEvent): boolean {
  return String(e.type ?? '').toLowerCase().includes('libur')
}
