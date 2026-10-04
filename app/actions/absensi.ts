'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { halaqohSesiGuru } from '@/lib/data/setoran-sesi'
import { STATUS_ABSENSI, type StatusAbsensi } from '@/lib/rq/absensi'

type Hasil = { error?: string; success?: true }

export interface IsianAbsensi {
  student_id: string
  status: StatusAbsensi
  catatan?: string
}

/**
 * Simpan absensi satu pertemuan — MENGGANTI seluruh baris tanggal itu.
 *
 * Anak yang tidak ikut dikirim barisnya dihapus, bukan dibiarkan: guru yang
 * membetulkan absensi kemarin mengirim keadaan akhir layarnya, dan baris
 * sisa dari kiriman sebelumnya akan diam-diam ikut terhitung di rapor.
 */
export async function simpanAbsensiAction(
  sesiId: string,
  tanggal: string,
  isian: IsianAbsensi[],
): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  // Id sesi bisa sesi gabungan guru tahsin (beberapa halaqoh sekaligus).
  const halaqohIds = await halaqohSesiGuru(session.teacherId, sesiId)
  if (!halaqohIds) return { error: 'Anda bukan pengampu sesi ini.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: 'Tanggal tidak sah.' }
  if (isian.some(i => !STATUS_ABSENSI.includes(i.status))) return { error: 'Status kehadiran tidak dikenal.' }

  const supabase = createServerClient()

  // Hanya siswa aktif sesi ini yang boleh diabsen di sini. Tiap baris dicatat
  // atas halaqoh anak itu sendiri — rekap koordinator tetap per halaqoh.
  const ids = [...new Set(isian.map(i => i.student_id))]
  const halaqohAnak = new Map<string, string>()
  if (ids.length > 0) {
    const { data: siswa } = await supabase.from('students').select('id, halaqoh_id')
      .in('id', ids).in('halaqoh_id', halaqohIds).eq('is_active', true)
    if ((siswa ?? []).length !== ids.length) return { error: 'Ada anak yang bukan siswa aktif di sesi ini.' }
    for (const s of siswa ?? []) halaqohAnak.set(s.id as string, s.halaqoh_id as string)
  }

  const { data: lama, error: galatBaca } = await supabase
    .from('absensi_harian').select('student_id')
    .in('halaqoh_id', halaqohIds).eq('tanggal', tanggal)
  if (galatBaca) return { error: 'Tabel absensi belum ada. Jalankan migrasi 0081 lebih dulu.' }

  const dibuang = (lama ?? []).map(r => r.student_id as string).filter(id => !ids.includes(id))
  if (dibuang.length > 0) {
    await supabase.from('absensi_harian').delete().eq('tanggal', tanggal).in('student_id', dibuang)
  }

  if (isian.length > 0) {
    const { error } = await supabase.from('absensi_harian').upsert(
      isian.map(i => ({
        student_id: i.student_id,
        tanggal,
        halaqoh_id: halaqohAnak.get(i.student_id),
        status: i.status,
        catatan: (i.catatan ?? '').trim(),
        dicatat_oleh: session.teacherId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'student_id,tanggal' },
    )
    if (error) return { error: 'Gagal menyimpan absensi.' }
  }

  revalidatePath('/guru/absensi')
  return { success: true }
}
