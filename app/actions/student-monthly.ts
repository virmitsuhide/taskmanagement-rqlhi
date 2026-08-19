'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canTeacherAccessStudent } from '@/lib/data/teacher'
import { isValidPeriod, toPeriodDate } from '@/lib/finance/period'

type Result = { error?: string; success?: boolean }

/**
 * Capaian awal & akhir bulan seorang siswa.
 *
 * Izinnya bukan soal role melainkan penugasan: guru hanya boleh mengisi anak
 * di halaqoh yang diampunya. Dicek lewat canTeacherAccessStudent tiap kali —
 * id siswa datang dari peramban dan karenanya tidak boleh dipercaya.
 */
export async function saveStudentMonthlyAction(_: unknown, formData: FormData): Promise<Result> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid. Silakan masuk ulang.' }

  const studentId = (formData.get('student_id') as string) ?? ''
  const periodKey = (formData.get('period') as string) ?? ''
  if (!studentId) return { error: 'Siswa tidak dikenali.' }
  if (!isValidPeriod(periodKey)) return { error: 'Periode tidak valid.' }

  const boleh = await canTeacherAccessStudent(session.teacherId, studentId)
  if (!boleh) return { error: 'Siswa ini bukan anggota halaqoh Anda.' }

  const halaman = Number((formData.get('capaian_halaman') as string) ?? '0')
  const text = (key: string) => ((formData.get(key) as string) ?? '').trim()

  const supabase = createServerClient()
  const { error } = await supabase.from('student_monthly').upsert(
    {
      student_id: studentId,
      period: toPeriodDate(periodKey),
      level: text('level'),
      halaman_awal_tahsin: text('halaman_awal_tahsin'),
      halaman_akhir_tahsin: text('halaman_akhir_tahsin'),
      tahfidz_awal: text('tahfidz_awal'),
      tahfidz_akhir: text('tahfidz_akhir'),
      capaian_halaman: Number.isFinite(halaman) && halaman > 0 ? Math.round(halaman) : 0,
      catatan: text('catatan'),
      recorded_by: session.teacherId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,period' },
  )

  if (error) return { error: error.message || 'Gagal menyimpan capaian.' }

  revalidatePath('/guru/capaian')
  return { success: true }
}

/**
 * Salin capaian akhir bulan lalu jadi capaian awal bulan ini, untuk seluruh
 * anak di satu halaqoh sekaligus.
 *
 * Titik berangkat sebuah bulan hampir selalu sama dengan titik akhir bulan
 * sebelumnya. Tanpa ini guru harus mengetik ulang dua kolom untuk tiap anak
 * di awal bulan — pekerjaan yang paling mungkin ditunda, dan begitu ditunda
 * patokan bulanannya hilang.
 */
export async function carryOverMonthlyAction(halaqohId: string, periodKey: string, previousKey: string): Promise<Result> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!isValidPeriod(periodKey) || !isValidPeriod(previousKey)) return { error: 'Periode tidak valid.' }

  const supabase = createServerClient()

  const { data: halaqoh } = await supabase
    .from('halaqoh').select('id, wali_teacher_id').eq('id', halaqohId).maybeSingle()
  if (!halaqoh) return { error: 'Halaqoh tidak ditemukan.' }
  if (halaqoh.wali_teacher_id !== session.teacherId) {
    return { error: 'Anda bukan wali halaqoh ini.' }
  }

  const { data: studentRows } = await supabase
    .from('students').select('id').eq('halaqoh_id', halaqohId).eq('is_active', true)
  const studentIds = ((studentRows ?? []) as { id: string }[]).map(s => s.id)
  if (studentIds.length === 0) return { error: 'Halaqoh ini belum punya siswa.' }

  const { data: prevRows } = await supabase
    .from('student_monthly')
    .select('student_id, level, halaman_akhir_tahsin, tahfidz_akhir')
    .in('student_id', studentIds)
    .eq('period', toPeriodDate(previousKey))

  const prev = (prevRows ?? []) as {
    student_id: string; level: string; halaman_akhir_tahsin: string; tahfidz_akhir: string
  }[]
  if (prev.length === 0) return { error: 'Bulan sebelumnya belum ada catatan untuk disalin.' }

  // Hanya kolom AWAL yang diisi. Kolom akhir dibiarkan kosong supaya jelas
  // mana yang sudah dinilai bulan ini dan mana yang baru titik berangkatnya.
  const { error } = await supabase.from('student_monthly').upsert(
    prev.map(p => ({
      student_id: p.student_id,
      period: toPeriodDate(periodKey),
      level: p.level,
      halaman_awal_tahsin: p.halaman_akhir_tahsin,
      tahfidz_awal: p.tahfidz_akhir,
      recorded_by: session.teacherId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'student_id,period', ignoreDuplicates: false },
  )

  if (error) return { error: error.message || 'Gagal menyalin capaian.' }

  revalidatePath('/guru/capaian')
  return { success: true }
}
