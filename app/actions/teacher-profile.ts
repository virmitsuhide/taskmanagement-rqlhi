'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { canManageTeacherProfiles, KATEGORI_GURU_ORDER } from '@/lib/auth/permissions'
import type { KategoriGuru } from '@/types'
import { bacaDataDiri, teks, unggahFotoProfil } from '@/lib/profil/data-diri'

/**
 * Profil guru Qur'an — disunting dari dua pintu.
 *
 * SDM lewat /ustadz/profil, dan guru sendiri lewat /guru/profil. Keduanya
 * menulis ke baris teachers yang sama, tapi TIDAK ke kolom yang sama:
 *
 *   Data diri (nama panggilan, TTL, pendidikan, kompetensi, ijazah,
 *   diklat, amanah, penghargaan)      → SDM & guru
 *   Kepegawaian (unit, TMT, NIP,
 *   jenis kepegawaian)                → SDM saja
 *
 * Pemisahan itu bukan kerapian tampilan. Unit menentukan rubrik KPI mana yang
 * dipakai menilai guru, TMT menentukan masa kerja yang tercetak di rapornya,
 * dan jenis kepegawaian menentukan pos gaji. Ketiganya keputusan lembaga —
 * kalau guru bisa mengubahnya sendiri, ia bisa mengubah dasar penilaian atas
 * dirinya sendiri. Karena itu pemisahannya ditegakkan di server, bukan dengan
 * menyembunyikan medannya di form.
 */

/** Pesan galat yang menunjuk migrasinya, bukan "gagal menyimpan" yang buntu. */
function pesanGalat(message: string | undefined): string {
  if (message?.includes('education_history') || message?.includes('quran_competencies') || message?.includes('sapaan')) {
    return 'Profil guru belum bisa disimpan: jalankan drizzle/0044_profil_guru_dan_catatan_kpi_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  // Tanpa pesan ini, memilih "Lain-lain" hanya gagal diam-diam pada pemasangan
  // yang 0052-nya belum dijalankan — dan tidak ada di layar yang menunjukkan
  // bahwa yang kurang adalah satu kolom, bukan isian yang keliru.
  if (message?.includes('lingkup_penugasan')) {
    return 'Lingkup penugasan belum aktif: jalankan drizzle/0052_lingkup_penugasan_guru_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  if (message?.includes('guru_unit_lain')) {
    return 'Kategori "Guru Unit Lain" belum aktif: jalankan drizzle/0054_kategori_unit_lain_dan_penguji_guru_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  if (message?.includes('kategori_guru')) {
    return 'Kategori guru belum aktif: jalankan drizzle/0053_kategori_guru_PASTE_TO_SUPABASE.sql di Supabase.'
  }
  return 'Gagal menyimpan profil guru.'
}

/** Disunting SDM — termasuk kolom kepegawaian. */
export async function updateGuruProfileBySdmAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageTeacherProfiles(session.role)) return { error: 'Tidak memiliki izin.' }

  const teacherId = formData.get('teacher_id') as string
  if (!teacherId) return { error: 'Guru tidak dikenali.' }

  const fullName = ((formData.get('full_name') as string) ?? '').trim()
  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }

  const employment = formData.get('employment_type') as string

  /*
    Satu dropdown, dua kolom. Nilai 'yayasan' bukan unit melainkan penanda
    lingkup (0052); ia diuraikan di sini, bukan dibiarkan sampai ke database.

    Dipilih begitu karena `unit` adalah enum jenjang, dan menampung 'yayasan'
    di sana menuntut penambahan nilai enum yang juga berlaku untuk
    halaqoh.jenjang, meetings, dan classes — tempat "yayasan" tidak berarti
    apa pun. Penguraian di satu action jauh lebih murah daripada nilai tak
    bermakna yang sah di empat tabel lain.

    lingkup SELALU ditulis, tidak pernah dibiarkan apa adanya. Kalau hanya
    ditulis saat bernilai 'yayasan', guru yang dikembalikan ke unit sekolah
    akan tetap tercatat lintas yayasan — dan rapornya diam-diam terus
    menunggu tanda tangan Kepala RQ yang tidak tahu ia menunggunya.
  */
  const pilihanUnit = formData.get('unit') as string
  const lingkupYayasan = pilihanUnit === 'yayasan'
  const unit = lingkupYayasan ? null : pilihanUnit

  // Kategori guru (0053). "Belum ditentukan" disimpan sebagai NULL, bukan
  // string kosong: enum-nya tidak mengenal nilai kosong, dan NULL itulah yang
  // dibaca tab "Belum ditentukan" di /ustadz sebagai daftar kerja SDM.
  //
  // Daftar sahnya dibaca dari KATEGORI_GURU_ORDER, bukan ditulis ulang di sini.
  // Salinannya pernah tertinggal saat 0054 menambah kategori keempat, dan
  // akibatnya bukan galat melainkan diam: pilihan yang tidak dikenal jatuh ke
  // null, tersimpan, dan melapor berhasil.
  const pilihanKategori = formData.get('kategori_guru') as string

  const patch = {
    ...bacaDataDiri(formData),
    full_name: fullName,
    nip: teks(formData, 'nip'),
    // TMT boleh dikosongkan: lebih baik kosong daripada tanggal yang tidak
    // pernah dimasukkan siapa pun — lihat migrasi 0044.
    joined_at: (formData.get('joined_at') as string) || null,
    unit: unit && ['paud', 'sd', 'sd_juara', 'smp', 'sma'].includes(unit) ? unit : null,
    lingkup_penugasan: lingkupYayasan ? 'yayasan' : 'unit',
    kategori_guru: KATEGORI_GURU_ORDER.includes(pilihanKategori as KategoriGuru)
      ? pilihanKategori
      : null,
    employment_type: ['tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq'].includes(employment)
      ? employment
      : null,
  }

  const supabase = createServerClient()

  const foto = await unggahFotoProfil(supabase, formData, 'teacher', teacherId)
  if (foto) (patch as Record<string, unknown>).photo_url = foto

  const { error } = await supabase.from('teachers').update(patch).eq('id', teacherId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/ustadz/profil')
  revalidatePath('/ustadz')
  revalidatePath('/kpi/cetak')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB dan bucket "profile-photos" sudah dibuat di Supabase.'
      : 'Profil guru tersimpan.',
  }
}

/**
 * Disunting guru sendiri lewat portal guru.
 *
 * Id gurunya diambil dari sesi, TIDAK dari form. Medan tersembunyi berisi id
 * bisa disunting siapa pun yang membuka peralatan pengembang peramban, dan
 * satu medan seperti itu sudah cukup untuk menyunting profil rekannya.
 */
export async function updateOwnGuruProfileAction(_: unknown, formData: FormData) {
  const session = await getTeacherSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()

  const patch: Record<string, unknown> = bacaDataDiri(formData)
  const foto = await unggahFotoProfil(supabase, formData, 'teacher', session.teacherId)
  if (foto) patch.photo_url = foto

  const { error } = await supabase.from('teachers').update(patch).eq('id', session.teacherId)
  if (error) return { error: pesanGalat(error.message) }

  revalidatePath('/guru/profil')
  revalidatePath('/ustadz/profil')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB.'
      : 'Profil tersimpan. Terima kasih — data ini memudahkan SDM.',
  }
}
