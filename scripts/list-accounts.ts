import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('username, role, display_name')
    .order('role')
  if (uErr) throw uErr

  console.log(`\n=== PENGURUS (users) — ${users?.length ?? 0} akun ===`)
  for (const u of users ?? []) {
    console.log(`  ${u.username.padEnd(16)} ${String(u.role).padEnd(14)} ${u.display_name}`)
  }

  const { data: teachers, error: tErr } = await supabase
    .from('teachers')
    .select('username, full_name, is_active')
    .order('username')
  if (tErr) throw tErr

  console.log(`\n=== GURU (teachers) — ${teachers?.length ?? 0} akun ===`)
  for (const t of teachers ?? []) {
    console.log(`  ${t.username.padEnd(16)} ${(t.is_active ? 'aktif' : 'nonaktif').padEnd(9)} ${t.full_name}`)
  }
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
