'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'

type Hasil = { error?: string; success?: true }

export interface IsianKelompokKlasikal {
  nama: string
  anggota: string[]
}

/**
 * Simpan pengaturan kelompok klasikal satu halaqoh — MENGGANTI seluruhnya.
 *
 * Diganti utuh, bukan disunting per baris: layar mengirim keadaan akhir yang
 * dilihat guru, dan menyelaraskan sebagian demi sebagian hanya membuka celah
 * di mana layar dan basis data berbeda pendapat soal siapa ada di mana.
 * Setoran yang sudah tersimpan tidak tersentuh — tersimpan per anak.
 */
export async function simpanKelompokKlasikalAction(halaqohId: string, daftar: IsianKelompokKlasikal[]): Promise<Hasil> {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!(await getTeacherHalaqohIds(session.teacherId)).includes(halaqohId)) {
    return { error: 'Anda bukan pengampu halaqoh ini.' }
  }

  const bersih = daftar
    .map((k, i) => ({ nama: k.nama.trim() || `Kelompok ${i + 1}`, anggota: [...new Set(k.anggota)] }))
    .filter(k => k.anggota.length > 0)
  if (bersih.some(k => k.anggota.length < 2)) {
    return { error: 'Kelompok klasikal minimal 2 anak. Anak yang sendirian cukup setor individual.' }
  }
  const semua = bersih.flatMap(k => k.anggota)
  if (new Set(semua).size !== semua.length) return { error: 'Satu anak hanya boleh ada di satu kelompok.' }

  const supabase = createServerClient()
  if (semua.length > 0) {
    const { data: siswa } = await supabase.from('students').select('id')
      .in('id', semua).eq('halaqoh_id', halaqohId).eq('is_active', true)
    if ((siswa ?? []).length !== semua.length) return { error: 'Ada anggota yang bukan siswa aktif di sesi ini.' }
  }

  // Keanggotaan lama di halaqoh ini, dan keanggotaan anak-anak ini di mana pun
  // (mis. sisa dari halaqoh lama) — satu anak satu kelompok.
  const { data: lama, error: galatBaca } = await supabase.from('kelompok_klasikal').select('id').eq('halaqoh_id', halaqohId)
  if (galatBaca) return { error: 'Tabel kelompok belum ada. Jalankan migrasi 0080 lebih dulu.' }
  if ((lama ?? []).length > 0) {
    await supabase.from('kelompok_klasikal').delete().in('id', (lama ?? []).map(k => k.id))
  }
  if (semua.length > 0) await supabase.from('kelompok_klasikal_anggota').delete().in('student_id', semua)

  for (const [urutan, k] of bersih.entries()) {
    const { data: baru, error } = await supabase.from('kelompok_klasikal')
      .insert({ halaqoh_id: halaqohId, nama: k.nama, urutan, dibuat_oleh: session.teacherId })
      .select('id').single()
    if (error || !baru) return { error: 'Gagal menyimpan kelompok.' }
    const { error: galatAnggota } = await supabase.from('kelompok_klasikal_anggota')
      .insert(k.anggota.map(student_id => ({ kelompok_id: baru.id, student_id })))
    if (galatAnggota) return { error: 'Gagal menyimpan anggota kelompok.' }
  }

  revalidatePath('/guru/setoran/tahsin/sesi')
  revalidatePath('/guru/setoran/tahsin/kelompok')
  return { success: true }
}
