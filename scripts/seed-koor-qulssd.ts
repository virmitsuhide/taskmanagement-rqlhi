/**
 * Membuat akun pengurus Koor QULS SD.
 *
 * Dipisah dari drizzle/0038 karena dua hal yang tidak bisa dikerjakan SQL
 * editor: password harus di-hash bcrypt, dan nilai enum `user_role` yang baru
 * tidak boleh dipakai di transaksi yang sama dengan ALTER TYPE-nya. Jalankan
 * SETELAH 0038 masuk:
 *
 *     npm run seed:koor-qulssd
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

const AKUN = {
  username: 'koor_qulssd',
  role: 'koor_qulssd',
  display_name: 'Koor QULS SD',
  password: 'RQ@koorqulssd2026',
}

async function main() {
  const { data: sudahAda, error: cariError } = await supabase
    .from('users')
    .select('id, role')
    .eq('username', AKUN.username)
    .maybeSingle()

  if (cariError) {
    console.error(`✗ Gagal memeriksa akun: ${cariError.message}`)
    process.exit(1)
  }

  if (sudahAda) {
    console.log(`✓ Akun '${AKUN.username}' sudah ada (role: ${sudahAda.role}).`)
    console.log('  Password TIDAK diubah. Untuk mengganti, pakai menu Akun & Password.')
    return
  }

  const password_hash = await bcrypt.hash(AKUN.password, 10)
  const { error } = await supabase.from('users').insert({
    username: AKUN.username,
    password_hash,
    role: AKUN.role,
    display_name: AKUN.display_name,
  })

  if (error) {
    console.error(`✗ Gagal membuat akun: ${error.message}`)
    if (error.message.includes('invalid input value for enum')) {
      console.error('  → drizzle/0038_koor_quls_sd_PASTE_TO_SUPABASE.sql belum dijalankan.')
    }
    process.exit(1)
  }

  console.log(`✓ ${AKUN.username.padEnd(14)} password: ${AKUN.password}`)
  console.log('\n  Sampaikan password ini ke orangnya, lalu minta ia menggantinya.')
  console.log('  Wewenangnya: siswa & halaqoh SD berprogram QULS / QULS Takhassus.')
}

main().catch(e => { console.error(e); process.exit(1) })
