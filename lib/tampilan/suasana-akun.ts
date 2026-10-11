import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import {
  COOKIE_SUASANA, UMUR_COOKIE_SUASANA, bacaCookieSuasana, normalisasiPref, tulisCookieSuasana,
  type PrefTampilan,
} from './suasana'

/**
 * Sisi server preferensi Tampilan (suasana & ukuran teks) — HANYA untuk
 * server action & server component. Kolomnya dari migrasi 0116; sebelum
 * migrasi itu dijalankan semua fungsi di sini tetap aman dipanggil.
 */

/** Tiga tabel akun yang bisa login: pengurus, guru, karyawan. */
export type TabelAkun = 'users' | 'teachers' | 'employees'

export const KOLOM_SUASANA = 'suasana_terang, suasana_gelap, ukuran_teks'

/** Galat PostgREST/Postgres karena kolom belum ada (migrasi 0116 belum jalan). */
export function kolomBelumAda(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /suasana_|ukuran_teks/.test(error.message ?? '')
}

export async function pasangCookieSuasana(p: PrefTampilan) {
  const store = await cookies()
  store.set(COOKIE_SUASANA, tulisCookieSuasana(p), {
    // Dibaca skrip <head> sebelum halaman dilukis — tidak boleh httpOnly.
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: UMUR_COOKIE_SUASANA,
    path: '/',
  })
}

/** Preferensi tersimpan di akun; null bila belum pernah diisi atau kolomnya belum ada. */
export async function bacaPrefAkun(tabel: TabelAkun, id: string): Promise<PrefTampilan | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.from(tabel).select(KOLOM_SUASANA).eq('id', id).maybeSingle()
    if (error || !data) return null
    const row = data as { suasana_terang: string | null; suasana_gelap: string | null; ukuran_teks: string | null }
    if (!row.suasana_terang && !row.suasana_gelap && !row.ukuran_teks) return null
    return normalisasiPref({ terang: row.suasana_terang, gelap: row.suasana_gelap, ukuran: row.ukuran_teks })
  } catch {
    return null
  }
}

/**
 * Dipanggil login: bila akun punya pilihan tersimpan, pasang cookie-nya supaya
 * suasana ikut ke perangkat ini. Tidak pernah melempar galat — gagal di sini
 * tidak boleh menggagalkan login.
 */
export async function muatSuasanaSaatLogin(tabel: TabelAkun, id: string): Promise<void> {
  try {
    const pref = await bacaPrefAkun(tabel, id)
    if (pref) await pasangCookieSuasana(pref)
  } catch {
    /* abaikan */
  }
}

/**
 * Pilihan awal halaman Tampilan: yang tersimpan di akun (bisa jadi diubah
 * dari perangkat lain), atau — sebelum migrasi / belum pernah memilih — yang
 * terpasang di cookie perangkat ini.
 */
export async function prefAwalTampilan(tabel: TabelAkun, id: string): Promise<PrefTampilan> {
  const dariAkun = await bacaPrefAkun(tabel, id)
  if (dariAkun) return dariAkun
  const store = await cookies()
  return bacaCookieSuasana(store.get(COOKIE_SUASANA)?.value)
}
