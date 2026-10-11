'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getEmployeeSession } from '@/lib/auth/employee-session'
import { normalisasiPref } from '@/lib/tampilan/suasana'
import { kolomBelumAda, pasangCookieSuasana, type TabelAkun } from '@/lib/tampilan/suasana-akun'

export type PortalTampilan = 'pengurus' | 'guru' | 'karyawan'

export type HasilSimpanSuasana =
  | { ok: true; /** false = hanya tersimpan di perangkat ini (migrasi 0116 belum dijalankan). */ akun: boolean }
  | { ok: false; error: string }

/**
 * Simpan suasana & ukuran teks untuk akun yang sedang login, lalu pasang
 * cookie-nya. `portal` memberi tahu sesi mana yang dimaksud — seseorang bisa
 * sekaligus memegang sesi pengurus dan sesi guru di peramban yang sama, dan
 * halaman Tampilan tiap portal tahu dirinya sedang di mana. Tanpa `portal`,
 * sesi dicari berurutan seperti login terpadu: pengurus, guru, karyawan.
 *
 * Sebelum migrasi 0116 dijalankan kolomnya belum ada: cookie tetap dipasang
 * dan action tetap berhasil, hanya saja pilihan belum ikut ke perangkat lain.
 */
export async function simpanSuasanaAction(input: {
  terang: string
  gelap: string
  ukuran: string
  portal?: PortalTampilan
}): Promise<HasilSimpanSuasana> {
  const pref = normalisasiPref(input)

  let akun: { tabel: TabelAkun; id: string } | null = null
  const portal = input.portal
  if (!portal || portal === 'pengurus') {
    const s = await getSession()
    if (s) akun = { tabel: 'users', id: s.userId }
  }
  if (!akun && (!portal || portal === 'guru')) {
    const s = await getTeacherSession()
    if (s) akun = { tabel: 'teachers', id: s.teacherId }
  }
  if (!akun && (!portal || portal === 'karyawan')) {
    const s = await getEmployeeSession()
    if (s) akun = { tabel: 'employees', id: s.employeeId }
  }
  if (!akun) return { ok: false, error: 'Sesi tidak valid. Silakan masuk ulang.' }

  await pasangCookieSuasana(pref)

  try {
    const supabase = createServerClient()
    const { error } = await supabase
      .from(akun.tabel)
      .update({ suasana_terang: pref.terang, suasana_gelap: pref.gelap, ukuran_teks: pref.ukuran })
      .eq('id', akun.id)
    if (error) {
      if (kolomBelumAda(error)) return { ok: true, akun: false }
      return { ok: false, error: 'Tampilan sudah dipakai di perangkat ini, tapi gagal disimpan ke akun.' }
    }
  } catch {
    return { ok: false, error: 'Tampilan sudah dipakai di perangkat ini, tapi gagal disimpan ke akun.' }
  }

  return { ok: true, akun: true }
}
