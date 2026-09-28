/**
 * Membuat akun koordinator unit baru (drizzle/0099): TPAIT, SD Juara, SMA.
 *
 * Jalankan SETELAH 0099 masuk:
 *
 *     npm run seed:koor-unit
 *
 * Password awalnya 'bismillah' — segera ganti lewat Profil → Ganti Password.
 * Aman diulang: akun yang sudah ada TIDAK ditimpa password-nya.
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
  { username: 'koor_tpait',   role: 'koor_tpait',   display_name: 'Koor TPAIT' },
  { username: 'koor_sdjuara', role: 'koor_sdjuara', display_name: 'Koor SD Juara' },
  { username: 'koor_sma',     role: 'koor_sma',     display_name: 'Koor SMA' },
]

const PASSWORD = 'bismillah'

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10)
  let gagal = false

  for (const a of AKUN) {
    const { data: sudahAda, error: cariError } = await supabase
      .from('users')
      .select('id, role')
      .eq('username', a.username)
      .maybeSingle()

    if (cariError) {
      console.error(`✗ ${a.username}: gagal memeriksa — ${cariError.message}`)
      gagal = true
      continue
    }
    if (sudahAda) {
      console.log(`✓ ${a.username} sudah ada (role: ${sudahAda.role}). Password TIDAK diubah.`)
      continue
    }

    const { error } = await supabase.from('users').insert({ ...a, password_hash: hash })
    if (error) {
      console.error(`✗ ${a.username}: ${error.message}`)
      if (error.message.includes('invalid input value for enum')) {
        console.error('  → drizzle/0099_koor_unit_baru_PASTE_TO_SUPABASE.sql belum dijalankan.')
      }
      gagal = true
      continue
    }
    console.log(`✓ ${a.username} dibuat (password: ${PASSWORD}).`)
  }

  if (gagal) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
