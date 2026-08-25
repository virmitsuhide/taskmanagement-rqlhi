'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'
import type { Jenjang } from '@/types'

const UNIT_SAH: Jenjang[] = ['sd', 'sd_juara', 'smp', 'paud', 'sma']

/**
 * Memindahkan guru ke unit lain — SD ↔ SMP dan sebagainya.
 *
 * Riwayat penilaian TIDAK ikut berpindah, dan itu memang yang diinginkan.
 * Tiap baris kpi_monthly menyimpan sendiri unit tempat guru berada saat
 * dinilai (kolom `unit`, migrasi 0035), jadi bulan-bulan lampau tetap dibaca
 * dengan rubrik yang berlaku waktu itu. Tanpa itu, memindahkan guru dari SD ke
 * SMP akan menghitung ulang seluruh nilai hafalannya dengan target 5 juz —
 * nilai yang dulu 85 mendadak jadi 67, tanpa ada yang menyentuh datanya.
 *
 * Yang berubah hanyalah ke mana ia dinilai MULAI SEKARANG.
 */
export async function pindahUnitGuruAction(
  teacherId: string,
  toUnit: string,
  effectiveDate: string,
  notes: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageTeachers(session.role)) return { error: 'Tidak memiliki izin memindahkan guru.' }

  if (!UNIT_SAH.includes(toUnit as Jenjang)) return { error: 'Unit tujuan tidak sah.' }
  if (!effectiveDate) return { error: 'Tanggal mutasi wajib diisi.' }

  const supabase = createServerClient()
  const { data: guru } = await supabase
    .from('teachers')
    .select('id, full_name, unit')
    .eq('id', teacherId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!guru) return { error: 'Guru tidak ditemukan.' }
  if (guru.unit === toUnit) return { error: 'Guru sudah berada di unit itu.' }

  const { error } = await supabase
    .from('teachers')
    .update({ unit: toUnit, updated_at: new Date().toISOString() })
    .eq('id', teacherId)

  if (error) return { error: 'Gagal memindahkan guru.' }

  // Dicatat SETELAH perpindahan berhasil. Kalau urutannya dibalik dan update
  // gagal, catatannya akan mengaku ada mutasi yang tidak pernah terjadi.
  await supabase.from('teacher_unit_moves').insert({
    teacher_id: teacherId,
    from_unit: guru.unit,
    to_unit: toUnit,
    effective_date: effectiveDate,
    notes: notes.trim() || null,
    moved_by: session.userId,
  })

  revalidatePath('/ustadz')
  revalidatePath(`/ustadz/${teacherId}`)
  revalidatePath('/kpi')
  return { success: true }
}
