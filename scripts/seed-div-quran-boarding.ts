/**
 * Membuat akun pengurus Div Qur'an Boarding Putra (BPA) & Putri (BPI).
 *
 * Dipisah dari drizzle/0058 karena dua hal yang tidak bisa dikerjakan SQL
 * editor: password harus di-hash bcrypt, dan nilai enum `user_role` yang baru
 * tidak boleh dipakai di transaksi yang sama dengan ALTER TYPE-nya. Jalankan
 * SETELAH 0058 masuk:
 *
 *     npm run seed:div-quran-boarding
 *
 * Aman diulang: akun dicari lewat username, dan kalau sudah ada, password-nya
 * TIDAK ditimpa. Menimpanya berarti setiap kali skrip ini dijalankan lagi —
 * misal saat menyiapkan lingkungan baru — orang yang sudah memakai akunnya
 * mendadak terkunci di luar.
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const AKUN = [
  {
    username: 'div_quran_bpa',
    role: 'div_quran_bpa',
    display_name: 'Bahrun Mahabi',
    password: 'bismillah',
  },
  {
    username: 'div_quran_bpi',
    role: 'div_quran_bpi',
    display_name: 'Karima Hasni',
    password: 'bismillah',
  },
]

async function buat(akun: (typeof AKUN)[number]) {
  const { data: sudahAda, error: cariError } = await supabase
    .from('users')
    .select('id, role')
    .eq('username', akun.username)
    .maybeSingle()

  if (cariError) {
    console.error(`✗ Gagal memeriksa akun ${akun.username}: ${cariError.message}`)
    process.exit(1)
  }

  if (sudahAda) {
    console.log(`✓ Akun '${akun.username}' sudah ada (role: ${sudahAda.role}).`)
    console.log('  Password TIDAK diubah. Untuk mengganti, pakai menu Akun & Password.')
    return
  }

  const password_hash = await bcrypt.hash(akun.password, 10)
  const { error } = await supabase.from('users').insert({
    username: akun.username,
    password_hash,
    role: akun.role,
    display_name: akun.display_name,
  })

  if (error) {
    console.error(`✗ Gagal membuat akun ${akun.username}: ${error.message}`)
    if (error.message.includes('invalid input value for enum')) {
      console.error('  → drizzle/0058_div_quran_boarding_PASTE_TO_SUPABASE.sql belum dijalankan.')
    }
    process.exit(1)
  }

  console.log(`✓ ${akun.username.padEnd(14)} ${akun.display_name.padEnd(16)} password: ${akun.password}`)
}

async function main() {
  for (const akun of AKUN) await buat(akun)

  console.log('\n  Wewenangnya: profil, pengajuan ujian unit SMP, dan rapat Koor x Boarding')
  console.log('  (lihat, buat, dan edit — membuang rapat tetap di koor SMP & Kepala RQ).')
  console.log('\n  ⚠ Password "bismillah" sama untuk keduanya dan mudah ditebak.')
  console.log('    Minta keduanya segera menggantinya lewat menu Akun & Password.')
}

main().catch(e => { console.error(e); process.exit(1) })
