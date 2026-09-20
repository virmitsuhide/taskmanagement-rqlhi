import { createServerClient } from '@/lib/supabase/server'
import { hitungTM, type HariKosong, type JadwalProgram, type SasaranTM } from '@/lib/rq/kalender-quran'
import { tingkatOf } from '@/lib/rq/sesi'
import type { Jenjang } from '@/types'

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

/** Rombel yang ada di sebuah angkatan — pilihan saat menandai satu kelas saja. */
export async function getKelasAngkatan(jenjang: Jenjang, tingkat: number): Promise<string[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('kelas')
    .eq('jenjang', jenjang)
    .eq('is_active', true)
  const kelas = new Set<string>()
  for (const r of (data ?? []) as { kelas: string | null }[]) {
    if (r.kelas && tingkatOf(r.kelas) === tingkat) kelas.add(r.kelas.trim())
  }
  return [...kelas].sort()
}

/** Angkatan yang benar-benar ada di sebuah unit, urut naik. */
export async function getAngkatan(jenjang: Jenjang): Promise<number[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('kelas')
    .eq('jenjang', jenjang)
    .eq('is_active', true)
  const tingkat = new Set<number>()
  for (const r of (data ?? []) as { kelas: string | null }[]) {
    const t = tingkatOf(r.kelas)
    if (t) tingkat.add(t)
  }
  return [...tingkat].sort((a, b) => a - b)
}
