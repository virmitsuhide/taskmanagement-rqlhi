import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const USERS = [
  { username: 'kepala_rq',    role: 'kepala_rq',    display_name: 'Kepala RQ',   password: 'RQ@kepala2024' },
  { username: 'kumik',        role: 'kumik',         display_name: 'Kumik',        password: 'RQ@kumik2024' },
  { username: 'sdm',          role: 'sdm',           display_name: 'SDM',          password: 'RQ@sdm2024' },
  { username: 'bendahara',    role: 'bendahara',     display_name: 'Bendahara',    password: 'RQ@bendahara2024' },
  { username: 'koor_sd',      role: 'koor_sd',       display_name: 'Koor SD',      password: 'RQ@koorsd2024' },
  { username: 'koor_smp',     role: 'koor_smp',      display_name: 'Koor SMP',     password: 'RQ@koorsmp2024' },
  { username: 'koor_ekstra',  role: 'koor_ekstra',   display_name: 'Koor Ekstra',  password: 'RQ@koorekstra2024' },
  { username: 'humas',        role: 'humas',         display_name: 'Humas',        password: 'RQ@humas2024' },
  { username: 'div_training', role: 'div_training',  display_name: 'Div Training', password: 'RQ@training2024' },
  { username: 'new_squad',    role: 'new_squad',     display_name: 'New Squad',    password: 'RQ@newsquad2024' },
]

async function seed() {
  console.log('Seeding users...\n')

  for (const user of USERS) {
    const password_hash = await bcrypt.hash(user.password, 10)

    const { error } = await supabase.from('users').upsert(
      { username: user.username, password_hash, role: user.role, display_name: user.display_name },
      { onConflict: 'username' }
    )

    if (error) {
      console.error(`✗ ${user.username}: ${error.message}`)
    } else {
      console.log(`✓ ${user.username.padEnd(14)} password: ${user.password}`)
    }
  }

  console.log('\nDone. Save these passwords — share them with each user.')
}

seed()
