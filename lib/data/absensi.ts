import { createServerClient } from '@/lib/supabase/server'
import { hitungRekap, REKAP_KOSONG, type RekapAbsensi, type StatusAbsensi } from '@/lib/rq/absensi'

/**
 * Pembacaan absensi harian (0081).
 *
 * Semua fungsi di sini tahan terhadap tabel yang belum ada: selama migrasi
 * 0081 belum di-paste ke Supabase, layar absensi menampilkan pemberitahuan
 * dan rapor memakai rekap kosong — bukan galat 500.
 */

export interface BarisAbsensi {
  student_id: string
  status: StatusAbsensi
  catatan: string
}

export interface AbsensiSatuHari {
  /** false = migrasi 0081 belum dijalankan. */
  tabelAda: boolean
  /** Kosong berarti pertemuan hari itu belum pernah diabsen. */
  baris: BarisAbsensi[]
}

export async function getAbsensiTanggal(halaqohId: string, tanggal: string): Promise<AbsensiSatuHari> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('absensi_harian')
    .select('student_id, status, catatan')
    .eq('halaqoh_id', halaqohId)
    .eq('tanggal', tanggal)
  if (error) return { tabelAda: false, baris: [] }
  return { tabelAda: true, baris: (data ?? []) as BarisAbsensi[] }
}

/** Tanggal yang sudah pernah diabsen di sesi ini, terbaru dulu. */
export async function getTanggalTerabsen(halaqohId: string, batas = 30): Promise<string[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('absensi_harian')
    .select('tanggal')
    .eq('halaqoh_id', halaqohId)
    .order('tanggal', { ascending: false })
    .limit(batas * 40) // satu tanggal punya sebanyak anggota halaqoh barisnya
  if (error) return []
  return [...new Set((data ?? []).map(r => r.tanggal as string))].slice(0, batas)
}

/**
 * Rekap kehadiran sejumlah anak dalam satu rentang tanggal — bahan rapor.
 *
 * Disaring per siswa, bukan per halaqoh: anak yang pindah sesi di tengah
 * semester tetap membawa seluruh riwayat kehadirannya.
 */
export async function getRekapAbsensi(
  studentIds: string[],
  dari: string,
  sampai: string,
): Promise<{ tabelAda: boolean; per: Record<string, RekapAbsensi> }> {
  if (studentIds.length === 0) return { tabelAda: true, per: {} }
  const supabase = createServerClient()

  const kumpul: { student_id: string; status: StatusAbsensi }[] = []
  // Dipecah supaya daftar id tidak melebihi panjang URL PostgREST.
  for (let i = 0; i < studentIds.length; i += 200) {
    const { data, error } = await supabase
      .from('absensi_harian')
      .select('student_id, status')
      .in('student_id', studentIds.slice(i, i + 200))
      .gte('tanggal', dari)
      .lte('tanggal', sampai)
    if (error) return { tabelAda: false, per: {} }
    kumpul.push(...((data ?? []) as { student_id: string; status: StatusAbsensi }[]))
  }

  const per: Record<string, StatusAbsensi[]> = {}
  for (const r of kumpul) (per[r.student_id] ??= []).push(r.status)

  return {
    tabelAda: true,
    per: Object.fromEntries(studentIds.map(id => [id, per[id] ? hitungRekap(per[id]) : { ...REKAP_KOSONG }])),
  }
}

/**
 * Anggota aktif sebuah sesi — daftar nama saja, tanpa posisi tahsin/tahfidz.
 * Layar absensi tidak butuh capaian; memuatnya hanya memperlambat.
 */
export async function getSiswaSesi(halaqohId: string): Promise<{ id: string; full_name: string; kelas: string | null }[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('students')
    .select('id, full_name, kelas')
    .eq('halaqoh_id', halaqohId)
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as { id: string; full_name: string; kelas: string | null }[]
}
