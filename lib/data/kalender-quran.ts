import { createServerClient } from '@/lib/supabase/server'
import { hitungTM, type HariKosong, type JadwalProgram, type SasaranTM } from '@/lib/rq/kalender-quran'
import { tingkatOf } from '@/lib/rq/sesi'
import { canManageStudents, kalenderPerProgram } from '@/lib/auth/permissions'
import type { Jenjang, UserRole } from '@/types'

/**
 * Kalender aktif pembelajaran Al-Qur'an (0084).
 *
 * Semua pembacaan tahan terhadap tabel yang belum ada: selama migrasi 0084
 * belum dijalankan, jadwal jatuh ke bawaannya (Senin–Kamis, plus Jum'at untuk
 * QULS) dan tidak ada hari yang ditiadakan. TM tetap terhitung benar untuk
 * keadaan biasa — yang hilang hanya kemampuan menandai hari kosong.
 */

export interface DataKalender {
  /** false = migrasi 0084 belum dijalankan. */
  tabelAda: boolean
  jadwal: JadwalProgram[]
  kosong: HariKosong[]
}

export async function getJadwalKalender(termId: string): Promise<{ tabelAda: boolean; jadwal: JadwalProgram[] }> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kalender_jadwal')
    .select('jenjang, program, hari')
    .eq('term_id', termId)
  if (error) return { tabelAda: false, jadwal: [] }
  return {
    tabelAda: true,
    jadwal: ((data ?? []) as { jenjang: Jenjang; program: string; hari: number[] }[])
      .map(j => ({ jenjang: j.jenjang, program: j.program ?? '', hari: j.hari ?? [] })),
  }
}

/**
 * Hari yang ditiadakan dalam suatu rentang.
 *
 * Disaring per unit karena agenda satu unit tidak mengenai unit lain —
 * SMPIT tetap mengaji saat SDIT mengadakan class meeting.
 */
export async function getHariKosong(
  jenjang: Jenjang[],
  dari: string,
  sampai: string,
): Promise<{ tabelAda: boolean; kosong: HariKosong[] }> {
  const supabase = createServerClient()
  let q = supabase
    .from('kalender_kosong')
    .select('id, tanggal, jenjang, tingkat, kelas, alasan')
    .gte('tanggal', dari)
    .lte('tanggal', sampai)
    .order('tanggal')
  if (jenjang.length > 0) q = q.in('jenjang', jenjang)

  const { data, error } = await q
  if (error) return { tabelAda: false, kosong: [] }
  return { tabelAda: true, kosong: (data ?? []) as HariKosong[] }
}

/** Jadwal + hari kosong sekaligus — bahan tiap layar yang menghitung TM. */
export async function getKalender(
  termId: string,
  jenjang: Jenjang[],
  dari: string,
  sampai: string,
): Promise<DataKalender> {
  const [j, k] = await Promise.all([getJadwalKalender(termId), getHariKosong(jenjang, dari, sampai)])
  return { tabelAda: j.tabelAda && k.tabelAda, jadwal: j.jadwal, kosong: k.kosong }
}

/**
 * TM tiap anak dalam satu rentang.
 *
 * Dihitung per anak, bukan per halaqoh: satu halaqoh bisa berisi anak reguler
 * dan anak QULS sekaligus, dan yang QULS punya satu hari lebih banyak.
 */
export function tmPerSiswa(
  siswa: { id: string; jenjang: Jenjang; kelas: string | null; program: string | null }[],
  kalender: DataKalender,
  dari: string,
  sampai: string,
): Record<string, number> {
  // Sasaran yang sama dihitung sekali lalu dipakai ulang: satu rombel bisa
  // berisi puluhan anak dengan jadwal dan pengecualian yang persis sama.
  const cache = new Map<string, number>()
  const hasil: Record<string, number> = {}

  for (const s of siswa) {
    const sasaran: SasaranTM = {
      jenjang: s.jenjang,
      tingkat: tingkatOf(s.kelas) ?? 0,
      kelas: s.kelas,
      program: s.program,
    }
    const kunci = `${sasaran.jenjang}|${sasaran.tingkat}|${(sasaran.kelas ?? '').toLowerCase()}|${sasaran.program ?? ''}`
    if (!cache.has(kunci)) {
      cache.set(kunci, hitungTM(dari, sampai, kalender.jadwal, kalender.kosong, sasaran))
    }
    hasil[s.id] = cache.get(kunci)!
  }
  return hasil
}

/**
 * Angkatan yang benar-benar ada di sebuah unit beserta rombelnya,
 * mis. { 7: ['7A','7B'], 8: ['8A'] }. Satu pembacaan untuk dua keperluan:
 * pemilih angkatan, dan checklist sasaran saat menandai hari kosong — agenda
 * sering mengenai beberapa angkatan atau sebagian rombel sekaligus.
 */
export async function getKelasPerAngkatan(jenjang: Jenjang, role?: UserRole): Promise<Record<number, string[]>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('kelas, program')
    .eq('jenjang', jenjang)
    .eq('is_active', true)

  // Koor SD / QULS SD hanya mendapat rombel yang SELURUH anaknya ia kelola;
  // rombel campuran jatuh ke luar keduanya dan tetap bisa diurus Kepala RQ.
  const terbatas = role !== undefined && kalenderPerProgram(role, jenjang)
  const per = new Map<number, Set<string>>()
  const ditolak = new Set<string>()
  for (const r of (data ?? []) as { kelas: string | null; program: string | null }[]) {
    const t = tingkatOf(r.kelas)
    if (!t) continue
    const kelas = r.kelas!.trim()
    if (terbatas && !canManageStudents(role, jenjang, r.program ?? '')) ditolak.add(kelas.toLowerCase())
    if (!per.has(t)) per.set(t, new Set())
    per.get(t)!.add(kelas)
  }
  return Object.fromEntries(
    [...per]
      .map(([t, k]) => [t, [...k].filter(x => !ditolak.has(x.toLowerCase())).sort()] as const)
      .filter(([, k]) => k.length > 0),
  )
}
