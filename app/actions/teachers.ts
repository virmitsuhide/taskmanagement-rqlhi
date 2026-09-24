'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import {
  canManageTeachers, canManageTeacherProfiles, KATEGORI_GURU_ORDER,
} from '@/lib/auth/permissions'
import type { KategoriGuru } from '@/types'

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
    // TMT ikut dibaca di sini walau bukan bagian kontrak: keduanya tanggal
    // kepegawaian yang diisi di form yang sama, dan aturan "kosong jadi NULL"
    // yang berlaku untuk kontrak berlaku persis sama untuk TMT.
    joined_at: clean('joined_at'),
    contract_start: clean('contract_start'),
    contract_end: clean('contract_end'),
  }
}

/**
 * Jenis kelamin guru (0086) — dipakai rapor untuk "ustadz"/"ustadzah".
 * Tidak dipilih = NULL: rapor lalu menulis keduanya, bukan menebak.
 */
function readGender(formData: FormData): { gender: 'L' | 'P' | null } {
  const g = formData.get('gender')
  return { gender: g === 'L' || g === 'P' ? g : null }
}

/**
 * Sebelum 0086 kolom gender belum ada dan Postgres menolak seluruh baris
 * (42703 / pesan menyebut kolomnya). Simpan tetap berjalan tanpa gender:
 * menahan pembaruan nama atau kontrak karena satu kolom baru tidak sepadan.
 */
function tanpaKolomGender(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204' || /gender/i.test(error.message ?? ''))
}

/** Nama kolom dari pesan 23502 Postgres, untuk ditunjukkan ke admin. */
function kolomKosong(pesan: string | undefined): string {
  return pesan?.match(/null value in column "([^"]+)"/)?.[1] ?? '(tidak diketahui)'
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
  const barisBaru = { username, password_hash, full_name, nip, email, phone, ...readEmployment(formData) }
  let { data, error } = await supabase
    .from('teachers')
    .insert({ ...barisBaru, ...readGender(formData) })
    .select('id')
    .single()
  if (tanpaKolomGender(error)) {
    ({ data, error } = await supabase.from('teachers').insert(barisBaru).select('id').single())
  }

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
    // Sebutkan sebabnya. Pesan buntu "Gagal membuat akun guru" pernah
    // menyembunyikan bug berhari-hari: kolom joined_at masih NOT NULL sementara
    // form tidak pernah mengirimnya, sehingga SETIAP pembuatan akun gagal dan
    // tidak ada satu pun petunjuk di layar tentang kolom mana yang bermasalah.
    if (error?.code === '23502') {
      return {
        error:
          `Gagal membuat akun guru: kolom "${kolomKosong(error.message)}" wajib diisi di database. ` +
          'Jalankan migrasi terbaru di Supabase, lalu coba lagi.',
      }
    }
    return { error: `Gagal membuat akun guru: ${error?.message ?? 'sebab tidak diketahui'}` }
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
  const ubahan = { full_name, nip, email, phone, is_active, ...readEmployment(formData) }
  let { error } = await supabase.from('teachers').update({ ...ubahan, ...readGender(formData) }).eq('id', id)
  if (tanpaKolomGender(error)) ({ error } = await supabase.from('teachers').update(ubahan).eq('id', id))
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

/**
 * Menetapkan kategori guru (0053) dari daftar /ustadz, satu baris sekali klik.
 *
 * Berdiri sendiri, tidak menumpang updateTeacherAction. Action itu membaca
 * seluruh FormData dan menulis belasan kolom sekaligus; memakainya dari daftar
 * berarti mengirim ulang nama, username, dan kontrak seorang guru hanya untuk
 * mengubah satu enum — dan setiap medan yang tidak ikut terkirim akan tertulis
 * kosong. Di sini yang tersentuh benar-benar hanya satu kolom.
 *
 * Izinnya canManageTeacherProfiles, sama dengan formulir Profil Guru. Kategori
 * adalah data profil, bukan data akun: koordinator yang boleh menyunting akun
 * guru unitnya tidak dengan sendirinya berhak memindahkan guru antar rombongan.
 */
export async function setKategoriGuruAction(id: string, kategori: string | null) {
  const session = await getSession()
  if (!session || !canManageTeacherProfiles(session.role)) {
    return { error: 'Anda tidak memiliki izin.' }
  }
  if (!id) return { error: 'Guru tidak ditemukan.' }

  // "Belum ditentukan" adalah NULL, bukan string kosong — enum-nya tidak
  // mengenal nilai kosong, dan NULL itulah yang dibaca tab daftar kerja SDM.
  const nilai = KATEGORI_GURU_ORDER.includes(kategori as KategoriGuru) ? kategori : null

  const supabase = createServerClient()
  const { error } = await supabase
    .from('teachers')
    .update({ kategori_guru: nilai, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    // Tanpa pesan ini, memilih kategori pada pemasangan yang 0053-nya belum
    // dijalankan hanya gagal diam-diam — dan yang kurang adalah satu kolom,
    // bukan pilihan yang keliru.
    if (error.message.includes('guru_unit_lain')) {
      return { error: 'Kategori "Guru Unit Lain" belum aktif: jalankan drizzle/0054_kategori_unit_lain_dan_penguji_guru_PASTE_TO_SUPABASE.sql di Supabase.' }
    }
    return {
      error: error.message.includes('kategori_guru')
        ? 'Kategori guru belum aktif: jalankan drizzle/0053_kategori_guru_PASTE_TO_SUPABASE.sql di Supabase.'
        : 'Gagal menyimpan kategori guru.',
    }
  }

  revalidateTeacherPaths(id)
  revalidatePath('/ustadz/profil')
  return { success: true }
}
