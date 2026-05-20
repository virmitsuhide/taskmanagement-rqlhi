/**
 * Seed script — run after applying schema.sql to Supabase
 *
 * Usage:
 *   1. Copy .env.local.example to .env.local and fill in values
 *   2. npx tsx scripts/seed.ts
 *
 * Script generates a random initial password per user, hashes it, and prints
 * the plaintext credentials to the terminal. Share with each person and ask
 * them to change their password after first login.
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually (tsx doesn't auto-load it)
function loadEnv() {
  try {
    const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    for (const line of envFile.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
  } catch {
    // .env.local not found, rely on process.env
  }
}

loadEnv()

const SEED_USERS = [
  { username: 'kepalarqlhi',     role: 'kepala_rq',    display_name: 'Kepala RQ',    can_change_password: true },
  { username: 'kumikrqlhi',      role: 'kumik',         display_name: 'Kumik',        can_change_password: true },
  { username: 'sdmrqlhi',        role: 'sdm',           display_name: 'SDM',          can_change_password: true },
  { username: 'sekbendrqlhi',    role: 'bendahara',     display_name: 'Bendahara',    can_change_password: true },
  { username: 'koorekstrarqlhi', role: 'koor_ekstra',   display_name: 'Koor Ekstra',  can_change_password: true },
  { username: 'koorsdrqlhi',     role: 'koor_sd',       display_name: 'Koor SD',      can_change_password: true },
  { username: 'koorsmprqlhi',    role: 'koor_smp',      display_name: 'Koor SMP',     can_change_password: true },
  { username: 'humasrqlhi',      role: 'humas',         display_name: 'Humas',        can_change_password: true },
  { username: 'divtraining',     role: 'div_training',  display_name: 'Div Training', can_change_password: true },
  { username: 'newsquad',        role: 'new_squad',     display_name: 'New Squad',    can_change_password: false },
]

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log('\n🌱  Seeding users...\n')
  console.log('─'.repeat(60))

  const credentials: { username: string; password: string }[] = []

  for (const user of SEED_USERS) {
    const password = generatePassword()
    const hash = await bcrypt.hash(password, 12)

    const { error } = await supabase.from('users').upsert(
      { ...user, password_hash: hash },
      { onConflict: 'username' }
    )

    if (error) {
      console.error(`❌  Failed to create ${user.username}:`, error.message)
    } else {
      credentials.push({ username: user.username, password })
      console.log(`✅  ${user.username.padEnd(20)} [${user.role}]`)
    }
  }

  console.log('─'.repeat(60))
  console.log('\n🔑  INITIAL CREDENTIALS (share privately, must be changed after login)\n')
  console.log('─'.repeat(60))
  console.log('Username'.padEnd(22) + 'Password')
  console.log('─'.repeat(60))
  for (const cred of credentials) {
    console.log(cred.username.padEnd(22) + cred.password)
  }
  console.log('─'.repeat(60))
  console.log('\n⚠️   Pastikan setiap pengguna mengganti password setelah login pertama.\n')
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
