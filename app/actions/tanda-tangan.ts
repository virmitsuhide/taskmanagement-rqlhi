'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { unggahTtd } from '@/lib/kpi/ttd-berkas'
import { ttdFocusFromFormData } from '@/lib/kpi/tanda-tangan'

/**
 * Menyimpan gambar tanda tangan ke profil — pengurus maupun guru.
 *
 * Satu berkas untuk dua jenis sesi karena isinya memang sama: unggah gambar,
 * simpan path & penataannya. Yang berbeda hanya tabel tujuannya, dan
 * memisahkannya menjadi dua berkas akan melahirkan dua tempat yang harus ingat
 * batas ukuran, daftar format, dan pesan galat yang sama.
 *
 * Tanda tangan disimpan SEKALI di profil, lalu disalin ke tiap rapor pada saat
 * ditandatangani. Mengganti gambar di sini tidak mengubah rapor yang sudah
 * terbit — memang begitu maunya.
 */

type Hasil = { error: string } | { success: true }

/** Pengurus: koordinator, SDM, Kepala RQ. */
export async function simpanTtdPengurusAction(_: unknown, formData: FormData): Promise<Hasil> {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const patch: Record<string, unknown> = {
    signature_focus: ttdFocusFromFormData(formData, 'ttd'),
  }

  const berkas = formData.get('ttd_file') as File | null
  if (berkas && berkas.size > 0) {
    const hasil = await unggahTtd(berkas, `pengurus/${session.userId}`)
    if ('error' in hasil) return hasil
    patch.signature_path = hasil.path
  }

  // Menghapus tanda tangan hanya melepas acuannya dari profil; berkasnya
  // ditinggalkan di storage karena rapor-rapor yang sudah terbit masih
  // menunjuk kepadanya. Menghapus berkasnya akan mengosongkan tanda tangan
  // pada dokumen yang sudah diserahkan bertahun lalu.
  if (formData.get('ttd_hapus') === '1') patch.signature_path = null

  const { error } = await supabase.from('users').update(patch).eq('id', session.userId)
  if (error) return { error: galat(error.message) }

  revalidatePath('/profil')
  revalidatePath('/kpi/publikasi')
  return { success: true }
}

/** Guru: dipakai untuk menandatangani rapor KPI-nya sendiri. */
export async function simpanTtdGuruAction(_: unknown, formData: FormData): Promise<Hasil> {
  const guru = await getTeacherSession()
  if (!guru) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const patch: Record<string, unknown> = {
    signature_focus: ttdFocusFromFormData(formData, 'ttd'),
  }

  const berkas = formData.get('ttd_file') as File | null
  if (berkas && berkas.size > 0) {
    const hasil = await unggahTtd(berkas, `guru/${guru.teacherId}`)
    if ('error' in hasil) return hasil
    patch.signature_path = hasil.path
  }

  if (formData.get('ttd_hapus') === '1') patch.signature_path = null

  const { error } = await supabase.from('teachers').update(patch).eq('id', guru.teacherId)
  if (error) return { error: galat(error.message) }

  revalidatePath('/guru/profil')
  revalidatePath('/guru/rapor-kpi')
  return { success: true }
}

function galat(pesan: string): string {
  if (pesan?.includes('signature_path') || pesan?.includes('signature_focus')) {
    return 'Kolom tanda tangan belum ada: jalankan drizzle/0050_rapor_kpi_pengesahan_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  return 'Gagal menyimpan tanda tangan.'
}
