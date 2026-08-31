'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageAllAccounts } from '@/lib/auth/permissions'

/**
 * Pengelolaan password oleh Kepala RQ.
 *
 * Password TIDAK PERNAH bisa ditampilkan. Yang tersimpan adalah hash bcrypt,
 * dan bcrypt dirancang satu arah — tidak ada jalan mengembalikannya jadi teks
 * asli. Karena itu menu ini tidak menampilkan password lama; ia hanya bisa
 * MENETAPKAN yang baru, lalu mengembalikan teksnya SEKALI ke layar pemanggil
 * untuk disalin dan disampaikan ke orangnya.
 *
 * Teks itu sengaja tidak disimpan ke mana pun. Menyimpannya berarti siapa pun
 * yang bisa membaca database — termasuk lewat salinan cadangan yang bocor —
 * langsung memegang akun semua guru dan pengurus, dan banyak orang memakai
 * password yang sama di layanan lain.
 */

type Target = 'user' | 'teacher' | 'employee'

const TABEL: Record<Target, string> = { user: 'users', teacher: 'teachers', employee: 'employees' }

/** Abjad & angka tanpa karakter yang mudah tertukar saat dibacakan (O/0, l/1, I). */
const ALFABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function passwordAcak(panjang = 10): string {
  let out = ''
  for (let i = 0; i < panjang; i++) {
    out += ALFABET[Math.floor(Math.random() * ALFABET.length)]
  }
  return out
}

async function terapkan(target: Target, id: string, password: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi tidak valid.' }
  if (!canManageAllAccounts(session.role)) return { error: 'Tidak memiliki izin.' }

  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  const supabase = createServerClient()
  const hash = await bcrypt.hash(password, 12)
  const { error } = await supabase
    .from(TABEL[target])
    .update({ password_hash: hash })
    .eq('id', id)

  if (error) return { error: 'Gagal memperbarui password.' }

  revalidatePath('/akun')
  // Password dikembalikan supaya bisa ditampilkan sekali di layar. Ini
  // satu-satunya saat teksnya ada; setelah halaman ditutup ia hilang.
  return { success: true, password }
}

/** Kepala RQ mengetik sendiri password barunya. */
export async function setPasswordAction(target: Target, id: string, password: string) {
  return terapkan(target, id, password.trim())
}

/** Kepala RQ menekan Reset — sistem yang membuatkan passwordnya. */
export async function resetPasswordAction(target: Target, id: string) {
  return terapkan(target, id, passwordAcak())
}
