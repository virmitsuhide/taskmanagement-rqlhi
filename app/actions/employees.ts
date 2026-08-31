'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageEmployees } from '@/lib/auth/permissions'

/**
 * Akun karyawan RQ — dibuat, disunting, dinonaktifkan oleh kepala RQ & SDM.
 *
 * Sejajar dengan app/actions/teachers.ts dan sengaja dibiarkan sejajar, bukan
 * digabung: kolom yang ditulis berbeda (karyawan punya jabatan, tidak punya
 * unit), dan penggabungan akan menghasilkan satu fungsi bercabang dua yang
 * lebih sulit dibaca daripada dua fungsi lurus.
 */

const EMPLOYMENT_TYPES = ['tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq']

const teks = (fd: FormData, key: string) => ((fd.get(key) as string) || '').trim() || null

function generatePassword(): string {
  const letters = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  let pwd = 'Kary@'
  for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)]
  return pwd
}

function bacaKepegawaian(formData: FormData) {
  const raw = ((formData.get('employment_type') as string) || '').trim()
  return {
    jabatan: teks(formData, 'jabatan'),
    employment_type: EMPLOYMENT_TYPES.includes(raw) ? raw : null,
    joined_at: teks(formData, 'joined_at'),
    contract_start: teks(formData, 'contract_start'),
    contract_end: teks(formData, 'contract_end'),
  }
}

/** Nama kolom dari pesan 23502 Postgres, supaya galatnya bisa ditindaklanjuti. */
function kolomKosong(pesan: string | undefined): string {
  return pesan?.match(/null value in column "([^"]+)"/)?.[1] ?? '(tidak diketahui)'
}

export async function createEmployeeAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageEmployees(session.role)) {
    return { error: 'Anda tidak memiliki izin untuk mengelola akun karyawan.' }
  }

  const username = ((formData.get('username') as string) || '').trim().toLowerCase()
  const full_name = ((formData.get('full_name') as string) || '').trim()
  const customPassword = ((formData.get('password') as string) || '').trim()

  if (!username || !full_name) return { error: 'Username dan nama lengkap wajib diisi.' }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { error: 'Username hanya huruf kecil, angka, dan underscore.' }
  }

  const password = customPassword || generatePassword()
  if (password.length < 8) return { error: 'Password minimal 8 karakter.' }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('employees')
    .insert({
      username,
      password_hash: await bcrypt.hash(password, 10),
      full_name,
      nip: teks(formData, 'nip'),
      email: teks(formData, 'email'),
      phone: teks(formData, 'phone'),
      ...bacaKepegawaian(formData),
    })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') return { error: 'Username sudah dipakai karyawan lain.' }
    if (error?.code === '23502') {
      return { error: `Gagal membuat akun: kolom "${kolomKosong(error.message)}" wajib diisi di database.` }
    }
    if (error?.message?.includes('employees')) {
      return { error: 'Tabel karyawan belum ada. Jalankan drizzle/0048_karyawan_rq_PASTE_TO_SUPABASE.sql di Supabase.' }
    }
    return { error: `Gagal membuat akun karyawan: ${error?.message ?? 'sebab tidak diketahui'}` }
  }

  revalidatePath('/karyawan')
  redirect(`/karyawan/${data.id}/edit?new_password=${encodeURIComponent(password)}`)
}

export async function updateEmployeeAccountAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageEmployees(session.role)) return { error: 'Tidak memiliki izin.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Karyawan tidak dikenali.' }

  const full_name = ((formData.get('full_name') as string) || '').trim()
  if (!full_name) return { error: 'Nama lengkap wajib diisi.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('employees')
    .update({
      full_name,
      nip: teks(formData, 'nip'),
      email: teks(formData, 'email'),
      phone: teks(formData, 'phone'),
      is_active: formData.get('is_active') === 'on',
      ...bacaKepegawaian(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: `Gagal menyimpan: ${error.message}` }

  revalidatePath('/karyawan')
  revalidatePath('/profil')
  return { success: true, message: 'Data karyawan tersimpan.' }
}

/**
 * Hapus lunak. Bukan DELETE: kursi pengurus, arsip, dan riwayat login menunjuk
 * baris ini, dan menghapusnya betulan membuat jejak itu menggantung.
 */
export async function deleteEmployeeAction(_: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || !canManageEmployees(session.role)) return { error: 'Tidak memiliki izin.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Karyawan tidak dikenali.' }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('employees')
    // Kursi pengurus ikut dikosongkan: karyawan yang sudah tidak ada tidak boleh
    // tetap tercatat memegang amanah.
    .update({ deleted_at: new Date().toISOString(), is_active: false, linked_user_id: null })
    .eq('id', id)

  if (error) return { error: `Gagal menghapus: ${error.message}` }

  revalidatePath('/karyawan')
  revalidatePath('/pengurus')
  return { success: true, message: 'Akun karyawan dihapus.' }
}
