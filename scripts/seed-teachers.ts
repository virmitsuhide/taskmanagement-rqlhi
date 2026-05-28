/**
 * Seed guru demo — Fase 1A
 * Jalankan: npm run seed:teachers
 *
 * Idempotent: aman dijalankan berulang (upsert on username).
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

const TEACHERS = [
  { username: 'ust_ahmad',   full_name: 'Ahmad Hidayat',     password: 'Guru@ahmad2026',    email: 'ahmad@rqlhi.id',   phone: '081234567001' },
  { username: 'ust_yusuf',   full_name: 'Yusuf Maulana',     password: 'Guru@yusuf2026',    email: 'yusuf@rqlhi.id',   phone: '081234567002' },
  { username: 'ust_fatimah', full_name: 'Fatimah Az-Zahra',  password: 'Guru@fatimah2026',  email: 'fatimah@rqlhi.id', phone: '081234567003' },
]

async function main() {
  console.log('Seeding guru demo...\n')

  for (const t of TEACHERS) {
    const password_hash = await bcrypt.hash(t.password, 10)

    const { error } = await supabase.from('teachers').upsert(
      {
        username: t.username,
        password_hash,
        full_name: t.full_name,
        email: t.email,
        phone: t.phone,
      },
      { onConflict: 'username' },
    )

    if (error) {
      console.error(`  ✗ ${t.username}: ${error.message}`)
    } else {
      console.log(`  ✓ ${t.username.padEnd(14)} password: ${t.password}`)
    }
  }

  console.log('\nDone. Bagikan username & password kepada masing-masing guru.')
  console.log('Login di: http://localhost:3000/guru/login')
}

main().catch(err => {
  console.error('Seed gagal:', err)
  process.exit(1)
})
