'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canHavePengurusProfile } from '@/lib/auth/permissions'
import { getProfilAmanah } from '@/lib/data/pengurus'
import { bacaDataDiri, unggahFotoProfil } from '@/lib/profil/data-diri'

export async function updateEmailAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const email = (formData.get('email') as string)?.trim()
  const supabase = createServerClient()

  const { error } = await supabase
    .from('users')
    .update({ email: email || null })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal memperbarui email.' }

  revalidatePath('/profil')
  return { success: true, message: 'Email berhasil diperbarui.' }
}

export async function changePasswordAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }

  const supabase = createServerClient()
  const { data: user } = await supabase
    .from('users')
    .select('password_hash, can_change_password')
    .eq('id', session.userId)
    .single()

  if (!user) return { error: 'User tidak ditemukan.' }
  if (!user.can_change_password) return { error: 'Akun ini tidak dapat mengganti password.' }

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword !== confirmPassword) return { error: 'Konfirmasi password tidak cocok.' }
  if (newPassword.length < 8) return { error: 'Password minimal 8 karakter.' }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return { error: 'Password saat ini tidak benar.' }

  const hash = await bcrypt.hash(newPassword, 12)
  const { error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('id', session.userId)

  if (error) return { error: 'Gagal mengganti password.' }

  return { success: true, message: 'Password berhasil diperbarui.' }
}

/**
 * Pengurus menyunting data dirinya dari /profil.
 *
 * Yang ditulis BUKAN kolom profil di akun jabatannya, melainkan rekam orang
 * yang menduduki amanah itu — baris teachers atau employees, tergantung siapa
 * yang didudukkan Kepala RQ lewat /pengurus. Jadi pengurus punya dua pintu ke
 * data yang sama (di sini dan di portalnya sendiri), tapi tetap satu salinan:
 * menyunting dari mana pun mengubah baris yang sama persis.
 *
 * Yang tidak bisa disentuh dari sini: nama lengkap, NIP, unit, TMT, jenis
 * kepegawaian, dan jabatan. Ketiganya wewenang SDM — unit menentukan rubrik
 * KPI, TMT menentukan masa kerja di rapor. Ditegakkan dengan tidak pernah
 * membacanya, bukan dengan menyembunyikan medannya.
 */
export async function updatePengurusOwnProfileAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canHavePengurusProfile(session.role)) return { error: 'Tidak memiliki izin.' }

  const pemegang = await getProfilAmanah(session.userId)
  if (!pemegang) {
    return {
      error:
        'Amanah ini belum ditetapkan admin, jadi belum ada rekam yang bisa disimpan. ' +
        'Minta Kepala RQ menetapkan pemegangnya lewat menu Pengurus.',
    }
  }

  const tabel = pemegang.sumber === 'karyawan' ? 'employees' : 'teachers'
  const supabase = createServerClient()

  const patch: Record<string, unknown> = bacaDataDiri(formData)
  const foto = await unggahFotoProfil(supabase, formData, pemegang.sumber, pemegang.recordId)
  if (foto) patch.photo_url = foto

  const { error } = await supabase.from(tabel).update(patch).eq('id', pemegang.recordId)
  if (error) return { error: `Gagal menyimpan profil: ${error.message}` }

  revalidatePath('/profil')
  revalidatePath('/guru/profil')
  revalidatePath('/karyawan/profil')
  revalidatePath('/ustadz/profil')
  return {
    success: true,
    message: foto === null
      ? 'Profil tersimpan, tetapi fotonya gagal diunggah. Pastikan ukurannya di bawah 2 MB.'
      : 'Profil tersimpan.',
  }
}
