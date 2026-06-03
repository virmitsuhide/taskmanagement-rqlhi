'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import type { TahsinStatus, TahfidzKind } from '@/types'

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

// ─── TAHFIDZ ────────────────────────────────────────────────────────
export async function createTahfidzLogAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  const allowed = await canTeacherAccessStudent(session.teacherId, studentId)
  if (!allowed) return { error: 'Anda tidak mengampu siswa ini.' }

  const kind = ((formData.get('kind') as string) || 'ziyadah') as TahfidzKind
  const suratId = formData.get('surat_id') ? Number(formData.get('surat_id')) : null
  const ayatDari = formData.get('ayat_dari') ? Number(formData.get('ayat_dari')) : null
  const ayatKe = formData.get('ayat_ke') ? Number(formData.get('ayat_ke')) : null
  const nilaiMakhraj = formData.get('nilai_makhraj') ? Number(formData.get('nilai_makhraj')) : null
  const nilaiTajwid = formData.get('nilai_tajwid') ? Number(formData.get('nilai_tajwid')) : null
  const nilaiKelancaran = formData.get('nilai_kelancaran') ? Number(formData.get('nilai_kelancaran')) : null
  const catatan = ((formData.get('catatan') as string) || '').trim() || null
  const setoranDate = (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10)
  const naikJuz = formData.get('naik_juz') === 'on'

  if (!suratId) return { error: 'Surat wajib dipilih.' }
  if (!ayatDari || !ayatKe) return { error: 'Rentang ayat wajib diisi.' }
  if (ayatKe < ayatDari) return { error: 'Ayat akhir tidak boleh lebih kecil dari ayat awal.' }

  const supabase = createServerClient()

  // Validasi rentang ayat terhadap data surat
  const { data: surat } = await supabase
    .from('surat_master')
    .select('total_ayat, juz_start, name_latin')
    .eq('id', suratId)
    .maybeSingle()
  if (!surat) return { error: 'Surat tidak ditemukan.' }
  if (ayatKe > surat.total_ayat) {
    return { error: `Surat ${surat.name_latin} hanya punya ${surat.total_ayat} ayat.` }
  }

  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return { error: 'Siswa tidak ditemukan.' }

  // Insert log — trigger DB upsert_juz_progress otomatis menambah ayat_hafal
  // ke juz_progress (hanya untuk kind='ziyadah')
  const { error: logErr } = await supabase.from('tahfidz_logs').insert({
    student_id: studentId,
    teacher_id: session.teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: setoranDate,
    kind,
    surat_id: suratId,
    ayat_dari: ayatDari,
    ayat_ke: ayatKe,
    nilai_makhraj: nilaiMakhraj,
    nilai_tajwid: nilaiTajwid,
    nilai_kelancaran: nilaiKelancaran,
    catatan,
  })
  if (logErr) return { error: 'Gagal menyimpan setoran tahfidz.' }

  // Naik juz: tandai juz surat ini sebagai selesai (mutqin) + catat riwayat.
  // Hanya berlaku untuk ziyadah (penyelesaian hafalan), bukan muroja'ah.
  if (naikJuz && kind === 'ziyadah') {
    const juzNumber = surat.juz_start

    // Tandai mutqin di juz_progress (upsert agar baris pasti ada)
    await supabase.from('juz_progress').upsert(
      { student_id: studentId, juz_number: juzNumber, mutqin: true, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,juz_number' },
    )

    // Catat promosi (unique student+juz; abaikan kalau sudah ada)
    const { error: promErr } = await supabase.from('juz_promotions').insert({
      student_id: studentId,
      juz_number: juzNumber,
      promoted_by: session.teacherId,
      promotion_date: setoranDate,
      catatan,
    })
    // 23505 = sudah pernah dipromosikan; bukan error fatal
    if (promErr && promErr.code !== '23505') {
      // log lain tetap tersimpan; cukup beri tahu sebagian gagal
      return { error: 'Setoran tersimpan, tetapi gagal mencatat kenaikan juz.' }
    }
  }

  revalidatePath('/guru/siswa')
  revalidatePath(`/guru/siswa/${studentId}`)
  revalidatePath('/guru')
  redirect(`/guru/siswa/${studentId}?setoran=tahfidz_ok`)
}

// ─── TASMI' (setoran 3 / 5 juz sekaligus) ───────────────────────────
export async function createTasmiLogAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi guru tidak valid.' }

  const studentId = formData.get('student_id') as string
  if (!studentId) return { error: 'Siswa belum dipilih.' }

  const allowed = await canTeacherAccessStudent(session.teacherId, studentId)
  if (!allowed) return { error: 'Anda tidak mengampu siswa ini.' }

  const scopeJuz = formData.get('scope_juz') ? Number(formData.get('scope_juz')) : null
  const juzFrom = formData.get('juz_from') ? Number(formData.get('juz_from')) : null
  const juzTo = formData.get('juz_to') ? Number(formData.get('juz_to')) : null
  const nilaiMakhraj = formData.get('nilai_makhraj') ? Number(formData.get('nilai_makhraj')) : null
  const nilaiTajwid = formData.get('nilai_tajwid') ? Number(formData.get('nilai_tajwid')) : null
  const nilaiKelancaran = formData.get('nilai_kelancaran') ? Number(formData.get('nilai_kelancaran')) : null
  const status = ((formData.get('status') as string) || 'lulus') as TahsinStatus
  const catatan = ((formData.get('catatan') as string) || '').trim() || null
  const setoranDate = (formData.get('setoran_date') as string) || new Date().toISOString().slice(0, 10)

  if (scopeJuz !== 3 && scopeJuz !== 5) return { error: 'Cakupan tasmi harus 3 atau 5 juz.' }
  if (!juzFrom || !juzTo) return { error: 'Rentang juz wajib diisi.' }
  if (juzFrom < 1 || juzTo > 30 || juzTo < juzFrom) return { error: 'Rentang juz tidak valid (1–30).' }
  if (juzTo - juzFrom + 1 !== scopeJuz) {
    return { error: `Rentang juz tidak sesuai: tasmi ${scopeJuz} juz harus ${scopeJuz} juz berurutan.` }
  }

  const supabase = createServerClient()
  const { data: student } = await supabase
    .from('students')
    .select('halaqoh_id')
    .eq('id', studentId)
    .maybeSingle()
  if (!student) return { error: 'Siswa tidak ditemukan.' }

  const { error: logErr } = await supabase.from('tasmi_logs').insert({
    student_id: studentId,
    teacher_id: session.teacherId,
    halaqoh_id: student.halaqoh_id,
    setoran_date: setoranDate,
    scope_juz: scopeJuz,
    juz_from: juzFrom,
    juz_to: juzTo,
    nilai_makhraj: nilaiMakhraj,
    nilai_tajwid: nilaiTajwid,
    nilai_kelancaran: nilaiKelancaran,
    status,
    catatan,
  })
  if (logErr) return { error: 'Gagal menyimpan setoran tasmi.' }

  revalidatePath('/guru/siswa')
  revalidatePath(`/guru/siswa/${studentId}`)
  revalidatePath('/guru')
  redirect(`/guru/siswa/${studentId}?setoran=tasmi_ok`)
}
