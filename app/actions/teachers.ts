'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'

function generatePassword(): string {
  // Format: Guru@<3 huruf random><4 digit random>
  const letters = 'abcdefghijkmnpqrstuvwxyz'  // hapus l, o yang mirip 1/0
  const digits = '23456789'                    // hapus 0, 1 yang mirip O, l
  let pwd = 'Guru@'
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)]
  return pwd
}

const EMPLOYMENT_TYPES = ['tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq']

/**
 * Baca jenis kepegawaian & masa kontrak dari form.
 *
 * Nilai kosong disimpan sebagai NULL, bukan string kosong: kolom tanggal
 * menolak '' , dan `contract_end` NULL punya arti tersendiri — kontrak tanpa
 * batas untuk guru tetap yayasan, yang aksesnya tidak boleh kedaluwarsa.
 */
function readEmployment(formData: FormData) {
  const raw = ((formData.get('employment_type') as string) || '').trim()
  const clean = (key: string) => ((formData.get(key) as string) || '').trim() || null

  return {
    employment_type: EMPLOYMENT_TYPES.includes(raw) ? raw : null,
    contract_start: clean('contract_start'),
    contract_end: clean('contract_end'),
  }
}

export async function createTeacherAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin untuk mengelola akun guru.' }
  }

  const username = ((formData.get('username') as string) || '').trim().toLowerCase()
  const full_name = ((formData.get('full_name') as string) || '').trim()
  const nip = ((formData.get('nip') as string) || '').trim() || null
  const email = ((formData.get('email') as string) || '').trim() || null
  const phone = ((formData.get('phone') as string) || '').trim() || null
  const customPassword = ((formData.get('password') as string) || '').trim()

  if (!username || !full_name) {
    return { error: 'Username dan nama lengkap wajib diisi.' }
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { error: 'Username hanya huruf kecil, angka, dan underscore.' }
  }

  const password = customPassword || generatePassword()
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  const password_hash = await bcrypt.hash(password, 10)

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('teachers')
    .insert({ username, password_hash, full_name, nip, email, phone, ...readEmployment(formData) })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      // Guru yang dihapus tetap memegang username-nya. Tanpa keterangan ini,
      // admin melihat "sudah dipakai" padahal tidak ada guru yang terlihat
      // memakainya — dan tidak tahu bahwa yang perlu dilakukan adalah
      // memulihkan akun lama, bukan membuat yang baru.
      const { data: deleted } = await supabase
        .from('teachers')
        .select('full_name')
        .eq('username', username)
        .not('deleted_at', 'is', null)
        .maybeSingle()

      return {
        error: deleted
          ? `Username dipakai akun terhapus (${deleted.full_name}). Pulihkan akun itu dari tab Terhapus, atau pilih username lain.`
          : 'Username sudah dipakai.',
      }
    }
    return { error: 'Gagal membuat akun guru.' }
  }

  revalidatePath('/ustadz')
  // Pass generated password via query param supaya admin bisa copy
  redirect(`/ustadz/${data.id}?new_password=${encodeURIComponent(password)}`)
}

export async function updateTeacherAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  const id = formData.get('id') as string
  const full_name = ((formData.get('full_name') as string) || '').trim()
  const nip = ((formData.get('nip') as string) || '').trim() || null
  const email = ((formData.get('email') as string) || '').trim() || null
  const phone = ((formData.get('phone') as string) || '').trim() || null
  const is_active = formData.get('is_active') === 'on'

  if (!id || !full_name) return { error: 'Data tidak lengkap.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ full_name, nip, email, phone, is_active, ...readEmployment(formData) })
    .eq('id', id)
  if (error) return { error: 'Gagal memperbarui guru.' }

  revalidatePath('/ustadz')
  revalidatePath(`/ustadz/${id}`)
  redirect(`/ustadz/${id}`)
}

export async function resetTeacherPasswordAction(id: string) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }

  const password = generatePassword()
  const password_hash = await bcrypt.hash(password, 10)

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ password_hash })
    .eq('id', id)
  if (error) return { error: 'Gagal reset password.' }

  revalidatePath(`/ustadz/${id}`)
  redirect(`/ustadz/${id}?new_password=${encodeURIComponent(password)}`)
}

/**
 * Hapus akun guru — menyembunyikan, bukan membuang.
 *
 * Setoran tahsin/tahfidz terhubung ke guru lewat FK ON DELETE RESTRICT, jadi
 * DELETE fisik akan ditolak database untuk hampir semua guru yang benar-benar
 * mengajar. Alasan lengkapnya ada di drizzle/0020_teacher_soft_delete.
 *
 * Guru yang terhapus langsung kehilangan akses login, tapi penugasan halaqoh
 * dan seluruh riwayat setoran-nya tetap utuh supaya bisa dipulihkan.
 */
export async function deleteTeacherAction(id: string) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }
  if (!id) return { error: 'Guru tidak ditemukan.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { error: 'Gagal menghapus akun guru.' }

  revalidateTeacherPaths(id)
  return { success: true }
}

/** Kembalikan guru yang terhapus beserta status aktif/nonaktifnya semula. */
export async function restoreTeacherAction(id: string) {
  const session = await getSession()
  if (!session || !canManageTeachers(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }
  if (!id) return { error: 'Guru tidak ditemukan.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: 'Gagal memulihkan akun guru.' }

  revalidateTeacherPaths(id)
  return { success: true }
}

/**
 * Guru muncul di banyak permukaan: daftar pengelolaan, pemilih wali halaqoh,
 * dan halaman Profil Guru publik. Semuanya perlu ikut disegarkan supaya guru
 * yang baru dihapus tidak tertinggal di salah satunya.
 */
function revalidateTeacherPaths(id: string) {
  revalidatePath('/ustadz')
  revalidatePath(`/ustadz/${id}`)
  revalidatePath('/halaqoh')
  revalidatePath('/profil-guru')
  revalidatePath('/humas/beranda')
}
