import { createServerClient } from '@/lib/supabase/server'
import { batasJuz } from '@/lib/rq/batas-juz'
import { cakupanJuz, juzTersentuh, type SetoranAyat } from '@/lib/rq/cakupan-juz'
import { juzTuntasDiAyat } from '@/lib/rq/target-tahfidz'
import type { Jenjang } from '@/types'

/**
 * Drill tahfidz per juz (0065): dari ziyadah tuntas sampai ujian 1 juz diajukan.
 *
 * Kedua fungsi penulis di sini sengaja tidak pernah melempar galat. Setoran
 * dan pengajuan ujian adalah pekerjaan inti; pencatatan drill hanya bahan
 * analitik. Kalau tabelnya belum ada (0065 belum dijalankan) atau satu kueri
 * gagal, setoran guru tetap tersimpan seperti biasa.
 */

/**
 * Dipanggil setelah setoran ziyadah tersimpan.
 *
 * Sebuah juz masuk drill bila salah satu benar:
 *   • setoran ini berakhir di AYAT TERAKHIR juz menurut arah hafalan unit
 *     anak (akhirJuzArah — juz 30 SD/TPAIT/SD Juara selesai di An-Naba 40,
 *     SMP/SMA di An-Nas 6), atau
 *   • seluruh ayat juz itu sudah tercatat di setoran (cakupanJuz).
 * Yang pertama menampung anak yang setorannya baru tercatat di tengah juz:
 * tanpa itu, juz yang jelas sudah ia tamatkan tidak pernah tertandai drill.
 */
export async function catatDrillSetelahZiyadah(
  studentId: string,
  log: SetoranAyat & { id: string | null; setoran_date: string; surat_ke_id?: number | null },
): Promise<void> {
  try {
    const supabase = createServerClient()

    const { data: siswa } = await supabase.from('students').select('jenjang').eq('id', studentId).maybeSingle()
    const jenjang = (siswa?.jenjang ?? null) as Jenjang | null
    const juzAkhir = log.ayat_ke ? juzTuntasDiAyat(log.surat_ke_id ?? log.surat_id, log.ayat_ke, jenjang) : null
    const calon = new Set([...juzTersentuh(log), ...(juzAkhir ? [juzAkhir] : [])])

    for (const juz of calon) {
      const batas = batasJuz(juz)
      if (!batas) continue

      const { data: ada, error: galatAda } = await supabase
        .from('tahfidz_juz_drill')
        .select('id')
        .eq('student_id', studentId)
        .eq('juz_number', juz)
        .maybeSingle()
      if (galatAda || ada) continue

      if (juz === juzAkhir) {
        await simpanDrill(studentId, juz, log)
        continue
      }

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

      await simpanDrill(studentId, juz, log)
    }
  } catch {
    // Lihat catatan di atas berkas.
  }
}

async function simpanDrill(studentId: string, juz: number, log: { id: string | null; setoran_date: string }): Promise<void> {
  const supabase = createServerClient()
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
