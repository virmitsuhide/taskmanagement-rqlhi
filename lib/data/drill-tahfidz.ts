import { createServerClient } from '@/lib/supabase/server'
import { batasJuz } from '@/lib/rq/batas-juz'
import { cakupanJuz, juzTersentuh, type SetoranAyat } from '@/lib/rq/cakupan-juz'

/**
 * Drill tahfidz per juz (0065): dari ziyadah tuntas sampai ujian 1 juz diajukan.
 *
 * Kedua fungsi penulis di sini sengaja tidak pernah melempar galat. Setoran
 * dan pengajuan ujian adalah pekerjaan inti; pencatatan drill hanya bahan
 * analitik. Kalau tabelnya belum ada (0065 belum dijalankan) atau satu kueri
 * gagal, setoran guru tetap tersimpan seperti biasa.
 */

/** Dipanggil setelah setoran ziyadah tersimpan. */
export async function catatDrillSetelahZiyadah(
  studentId: string,
  log: SetoranAyat & { id: string | null; setoran_date: string },
): Promise<void> {
  try {
    const supabase = createServerClient()

    for (const juz of juzTersentuh(log)) {
      const batas = batasJuz(juz)
      if (!batas) continue

      const { data: ada, error: galatAda } = await supabase
        .from('tahfidz_juz_drill')
        .select('id')
        .eq('student_id', studentId)
        .eq('juz_number', juz)
        .maybeSingle()
      if (galatAda || ada) continue

      const [{ data: logs }, { data: surat }] = await Promise.all([
        supabase
          .from('tahfidz_logs')
          .select('surat_id, ayat_dari, ayat_ke')
          .eq('student_id', studentId)
          .eq('kind', 'ziyadah')
          .gte('surat_id', batas.mulai.surat)
          .lte('surat_id', batas.selesai.surat),
        supabase
          .from('surat_master')
          .select('id, total_ayat')
          .gte('id', batas.mulai.surat)
          .lte('id', batas.selesai.surat),
      ])

      const panjang = new Map((surat ?? []).map(s => [s.id as number, s.total_ayat as number]))
      if (!cakupanJuz(juz, (logs ?? []) as SetoranAyat[], panjang).tuntas) continue

      // Ujian 1 juz bisa saja sudah diajukan lebih dulu — guru yang
      // mengajukan sebelum ziyadahnya tercatat lengkap. Langsung ditautkan,
      // dan lama persiapannya terbaca nol, bukan dibiarkan "sedang drill".
      const { data: ujian } = await supabase
        .from('ujian_tahfidz')
        .select('id')
        .eq('student_id', studentId)
        .eq('tipe', '1_juz')
        .eq('juz', String(juz))
        .order('created_at', { ascending: false })
        .limit(1)

      await supabase.from('tahfidz_juz_drill').insert({
        student_id: studentId,
        juz_number: juz,
        selesai_ziyadah: log.setoran_date,
        source_log_id: log.id,
        ujian_id: ujian?.[0]?.id ?? null,
      })
    }
  } catch {
    // Lihat catatan di atas berkas.
  }
}

/** Dipanggil setelah pengajuan / riwayat ujian 1 juz tersimpan. */
export async function tautkanUjianKeDrill(studentId: string | null, juz: string, ujianId: string): Promise<void> {
  const nomor = Number(juz)
  if (!studentId || !Number.isInteger(nomor)) return
  try {
    const supabase = createServerClient()
    await supabase
      .from('tahfidz_juz_drill')
      .update({ ujian_id: ujianId })
      .eq('student_id', studentId)
      .eq('juz_number', nomor)
      .is('ujian_id', null)
  } catch {
    // Lihat catatan di atas berkas.
  }
}

export interface JuzDrillSiswa {
  juz: number
  sejak: string
}

/** Juz yang sedang drill untuk sekelompok siswa — untuk penanda di sisi guru. */
export async function getJuzDrillPerSiswa(studentIds: string[]): Promise<Map<string, JuzDrillSiswa[]>> {
  const peta = new Map<string, JuzDrillSiswa[]>()
  if (studentIds.length === 0) return peta
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('tahfidz_juz_drill')
      .select('student_id, juz_number, selesai_ziyadah')
      .in('student_id', studentIds)
      .is('ujian_id', null)
    if (error) return peta
    for (const r of (data ?? []) as { student_id: string; juz_number: number; selesai_ziyadah: string }[]) {
      peta.set(r.student_id, [...(peta.get(r.student_id) ?? []), { juz: r.juz_number, sejak: r.selesai_ziyadah }])
    }
  } catch {
    // Tabel belum ada — penanda cukup tidak tampil.
  }
  return peta
}
