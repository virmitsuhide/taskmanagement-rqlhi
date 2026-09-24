'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { getRaporTemplate, bacaJenisRapor } from '@/lib/data/rapor-template'
import { KODE_MEDAN, slotIsianGuru } from '@/lib/rapor/medan'

type Hasil = { error?: string; success?: true }

/**
 * Simpan tulisan guru untuk satu anak di satu semester, untuk satu jenis
 * laporan (ATS atau rapor semester — 0086).
 *
 * Yang tersimpan hanya yang DITULIS guru — deskripsi naratif, isian merah,
 * dan timpaan angka. Rata-rata nilai, capaian, dan kehadiran tidak ikut:
 * semuanya dihitung ulang dari setoran dan absensi tiap kali rapor dibuka.
 */
export async function simpanRaporIsianAction(
  studentId: string,
  termId: string,
  templateId: string | null,
  deskripsi: string,
  timpaan: Record<string, string>,
  jenisMentah: string = 'semester',
  isian: Record<string, string> = {},
): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  const jenis = bacaJenisRapor(jenisMentah)

  const supabase = createServerClient()
  const { data: siswa } = await supabase
    .from('students').select('halaqoh_id').eq('id', studentId).maybeSingle()
  if (!siswa) return { error: 'Siswa tidak ditemukan.' }
  if (!siswa.halaqoh_id || !(await getTeacherHalaqohIds(session.teacherId)).includes(siswa.halaqoh_id as string)) {
    return { error: 'Anak ini bukan anggota sesi Anda.' }
  }

  // Timpaan hanya boleh menyebut medan yang dikenal, dan yang diisi guru
  // lewat kotak deskripsi / isian merah tidak ikut lewat jalur ini.
  const bersih: Record<string, string> = {}
  for (const [kode, isi] of Object.entries(timpaan)) {
    if (!(KODE_MEDAN as readonly string[]).includes(kode)) continue
    if (['deskripsi', 'isian_guru', 'halaman_riyadhoh', 'tetap', 'kosongkan'].includes(kode)) continue
    const nilai = String(isi ?? '').trim()
    if (nilai) bersih[kode] = nilai.slice(0, 120)
  }

  // Isian merah hanya untuk slot yang memang isian guru di template anak
  // ini. Id lain dibuang: tulisan yang menempel pada slot yang tidak ada
  // tidak pernah tercetak, dan menyimpannya hanya menyesatkan.
  const isianBersih: Record<string, string> = {}
  const tpl = templateId ? await getRaporTemplate(templateId) : null
  if (tpl) {
    const boleh = new Set(slotIsianGuru(tpl.blok, tpl.pemetaan).map(s => s.id))
    for (const [id, isi] of Object.entries(isian)) {
      if (boleh.has(id)) isianBersih[id] = String(isi ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
    }
  }

  const baris = {
    student_id: studentId,
    term_id: termId,
    template_id: templateId,
    deskripsi: deskripsi.trim(),
    timpaan: bersih,
    diisi_oleh: session.teacherId,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('rapor_isian')
    .upsert({ ...baris, jenis, isian: isianBersih }, { onConflict: 'student_id,term_id,jenis' })

  if (error) {
    // Sebelum 0086: rapor semester tanpa isian merah masih bisa disimpan
    // dengan bentuk lama; ATS dan isian merah memang butuh kolom barunya.
    if (jenis === 'ats' || Object.keys(isianBersih).length > 0) {
      return { error: 'Gagal menyimpan. Minta admin menjalankan migrasi 0086 (rapor ATS & isian merah).' }
    }
    const lama = await supabase.from('rapor_isian').upsert(baris, { onConflict: 'student_id,term_id' })
    if (lama.error) return { error: 'Gagal menyimpan. Pastikan migrasi 0082 sudah dijalankan.' }
  }

  revalidatePath('/guru/rapor-quran')
  revalidatePath(`/guru/rapor-quran/${studentId}`)
  return { success: true }
}
