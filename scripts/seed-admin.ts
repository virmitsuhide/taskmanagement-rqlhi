/**
 * Membuat akun admin sistem (peran 'admin', drizzle/0090).
 *
 * Jalankan SETELAH 0090 masuk:
 *
 *     npm run seed:admin
 *
 * Password awalnya 'bismillah', sama seperti akun pengurus lain yang dibuat
 * lewat skrip — segera ganti lewat Profil → Ganti Password. Aman diulang:
 * kalau akun 'admin' sudah ada, password-nya TIDAK ditimpa (menimpanya akan
 * mengunci orang yang sudah memakainya).
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

async function main() {
  const { data: sudahAda, error: cariError } = await supabase
    .from('users')
    .select('id, role')
    .eq('username', 'admin')
    .maybeSingle()

  if (cariError) {
    console.error(`✗ Gagal memeriksa akun admin: ${cariError.message}`)
    process.exit(1)
  }
  if (sudahAda) {
    console.log(`✓ Akun 'admin' sudah ada (role: ${sudahAda.role}). Password TIDAK diubah.`)
    return
  }

  const password = 'bismillah'

  const { error } = await supabase.from('users').insert({
    username: 'admin',
    password_hash: await bcrypt.hash(password, 10),
    role: 'admin',
    display_name: 'Admin',
  })

  if (error) {
    console.error(`✗ Gagal membuat akun admin: ${error.message}`)
    if (error.message.includes('invalid input value for enum')) {
      console.error('  → drizzle/0090_peran_admin_PASTE_TO_SUPABASE.sql belum dijalankan.')
    }
    process.exit(1)
  }

  console.log('✓ Akun admin dibuat.')
  console.log(`  username : admin`)
  console.log(`  password : ${password}`)
  console.log('\n  ⚠ Password "bismillah" mudah ditebak, dan akun ini bisa mengganti')
  console.log('    password akun mana pun. Segera ganti lewat menu Ganti Password.')
}

main().catch(e => { console.error(e); process.exit(1) })
