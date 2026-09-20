'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { KODE_MEDAN } from '@/lib/rapor/medan'

type Hasil = { error?: string; success?: true }

/**
 * Simpan tulisan guru untuk satu anak di satu semester.
 *
 * Yang tersimpan hanya yang DITULIS guru — deskripsi naratif dan timpaan
 * angka. Rata-rata nilai, capaian, dan kehadiran tidak ikut: semuanya
 * dihitung ulang dari setoran dan absensi tiap kali rapor dibuka (0082).
 */
export async function simpanRaporIsianAction(
  studentId: string,
  termId: string,
  templateId: string | null,
  deskripsi: string,
  timpaan: Record<string, string>,
): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students').select('halaqoh_id').eq('id', studentId).maybeSingle()
  if (!siswa) return { error: 'Siswa tidak ditemukan.' }
  if (!siswa.halaqoh_id || !(await getTeacherHalaqohIds(session.teacherId)).includes(siswa.halaqoh_id as string)) {
    return { error: 'Anak ini bukan anggota sesi Anda.' }
  }

  // Timpaan hanya boleh menyebut medan yang dikenal, dan yang diisi guru
  // lewat kotak deskripsi tidak ikut lewat jalur ini.
  const bersih: Record<string, string> = {}
  for (const [kode, isi] of Object.entries(timpaan)) {
    if (!(KODE_MEDAN as readonly string[]).includes(kode)) continue
    if (kode === 'deskripsi' || kode === 'tetap' || kode === 'kosongkan') continue
    const nilai = String(isi ?? '').trim()
    if (nilai) bersih[kode] = nilai.slice(0, 120)
  }

  const { error } = await supabase.from('rapor_isian').upsert(
    {
      student_id: studentId,
      term_id: termId,
      template_id: templateId,
      deskripsi: deskripsi.trim(),
      timpaan: bersih,
      diisi_oleh: session.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,term_id' },
  )
  if (error) return { error: 'Gagal menyimpan. Pastikan migrasi 0082 sudah dijalankan.' }

  revalidatePath('/guru/rapor-quran')
  revalidatePath(`/guru/rapor-quran/${studentId}`)
  return { success: true }
}
