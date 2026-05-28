'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import type { TahsinStatus } from '@/types'

/**
 * KEBIJAKAN POSISI SISWA setelah setoran tahsin (ditetapkan RQ LHI).
 *
 *  - LULUS : maju ke halaman berikutnya (halaman + 1). Form setoran berikutnya
 *            otomatis menunjuk halaman baru. Saat halaman terakhir jilid,
 *            guru centang "naik jilid" yang akan meng-override ke jilid baru.
 *  - ULANG : posisi TIDAK bergeser — pointer tetap di posisi lama sampai
 *            siswa benar-benar lulus halaman tersebut.
 */
function resolveStudentPosition(opts: {
  status: TahsinStatus
  methodId: string | null
  jilidId: string | null
  halaman: number | null
  current: { method_id: string | null; jilid_id: string | null; page: number | null }
}): { current_method_id: string | null; current_jilid_id: string | null; current_jilid_page: number | null } {
  if (opts.status === 'ulang') {
    // Pertahankan posisi lama
    return {
      current_method_id: opts.current.method_id,
      current_jilid_id: opts.current.jilid_id,
      current_jilid_page: opts.current.page,
    }
  }
  // LULUS: maju satu halaman
  return {
    current_method_id: opts.methodId,
    current_jilid_id: opts.jilidId,
    current_jilid_page: opts.halaman !== null ? opts.halaman + 1 : opts.current.page,
  }
}

export async function createTahsinLogAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  // Guru hanya boleh setor untuk siswa di halaqoh yang diampu
  const allowed = await canTeacherAccessStudent(session.teacherId, studentId)
  if (!allowed) return { error: 'Anda tidak mengampu siswa ini.' }

  const methodId = (formData.get('method_id') as string) || null
  const jilidId = (formData.get('jilid_id') as string) || null
  const halaman = formData.get('halaman') ? Number(formData.get('halaman')) : null
  const barisDari = formData.get('baris_dari') ? Number(formData.get('baris_dari')) : null
  const barisKe = formData.get('baris_ke') ? Number(formData.get('baris_ke')) : null
  const nilaiMakhraj = formData.get('nilai_makhraj') ? Number(formData.get('nilai_makhraj')) : null
  const nilaiTajwid = formData.get('nilai_tajwid') ? Number(formData.get('nilai_tajwid')) : null
  const nilaiKelancaran = formData.get('nilai_kelancaran') ? Number(formData.get('nilai_kelancaran')) : null
  const status = ((formData.get('status') as string) || 'lulus') as TahsinStatus
  const catatan = ((formData.get('catatan') as string) || '').trim() || null
  const setoranDate = (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10)
  const naikJilid = formData.get('naik_jilid') === 'on'

  if (!jilidId) return { error: 'Jilid wajib dipilih.' }

  const supabase = createServerClient()

  // Ambil halaqoh & posisi siswa saat ini
  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id, current_method_id, current_jilid_id, current_jilid_page')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return { error: 'Siswa tidak ditemukan.' }

  // 1. Insert log setoran
  const { error: logErr } = await supabase.from('tahsin_logs').insert({
    student_id: studentId,
    teacher_id: session.teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: setoranDate,
    method_id: methodId,
    jilid_id: jilidId,
    halaman: halaman,
    baris_dari: barisDari,
    baris_ke: barisKe,
    nilai_makhraj: nilaiMakhraj,
    nilai_tajwid: nilaiTajwid,
    nilai_kelancaran: nilaiKelancaran,
    status,
    catatan,
  })
  if (logErr) return { error: 'Gagal menyimpan setoran.' }

  // 2. Tentukan update posisi siswa
  const position = resolveStudentPosition({
    status, methodId, jilidId, halaman,
    current: {
      method_id: student.current_method_id,
      jilid_id: student.current_jilid_id,
      page: student.current_jilid_page,
    },
  })
  const studentUpdate: Record<string, unknown> = { ...position }

  // 3. Jika naik jilid: cari jilid berikutnya (order_num + 1) di metode sama
  if (naikJilid && methodId && jilidId) {
    const { data: currentLevel } = await supabase
      .from('jilid_levels')
      .select('order_num')
      .eq('id', jilidId)
      .maybeSingle()

    if (currentLevel) {
      const { data: nextLevel } = await supabase
        .from('jilid_levels')
        .select('id')
        .eq('method_id', methodId)
        .gt('order_num', currentLevel.order_num)
        .order('order_num', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextLevel) {
        // Catat riwayat kenaikan
        await supabase.from('jilid_promotions').insert({
          student_id: studentId,
          from_jilid_id: jilidId,
          to_jilid_id: nextLevel.id,
          promoted_by: session.teacherId,
          promotion_date: setoranDate,
          catatan: catatan,
        })
        // Pindahkan siswa ke jilid baru, halaman reset ke 1
        studentUpdate.current_jilid_id = nextLevel.id
        studentUpdate.current_jilid_page = 1
      }
    }
  }

  await supabase.from('students').update(studentUpdate).eq('id', studentId)

  revalidatePath('/guru/siswa')
  revalidatePath(`/guru/siswa/${studentId}`)
  revalidatePath('/guru')
  redirect(`/guru/siswa/${studentId}?setoran=ok`)
}
