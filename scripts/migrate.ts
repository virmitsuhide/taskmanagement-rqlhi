import { Client } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL tidak ditemukan di .env.local')
  process.exit(1)
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id         serial PRIMARY KEY,
      tag        text UNIQUE NOT NULL,
      applied_at timestamptz DEFAULT now()
    )
  `)
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await client.query<{ tag: string }>('SELECT tag FROM drizzle_migrations')
  return new Set(rows.map(r => r.tag))
}

async function applyMigration(tag: string, filePath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const statements = content
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await client.query(statement)
  }

  await client.query('INSERT INTO drizzle_migrations (tag) VALUES ($1)', [tag])
}

async function main() {
  await client.connect()
  try {
    await ensureMigrationsTable()
    const applied = await getAppliedMigrations()

    const migrationsDir = join(process.cwd(), 'drizzle')
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    let count = 0
    for (const file of files) {
      const tag = file.replace('.sql', '')
      if (applied.has(tag)) {
        console.log(`  ✓ ${tag} (sudah diaplikasikan)`)
        continue
      }
      console.log(`  ↑ Applying ${tag}...`)
      await applyMigration(tag, join(migrationsDir, file))
      console.log(`  ✓ ${tag} selesai`)
      count++
    }

    if (count === 0) console.log('\nSemua migrasi sudah up-to-date.')
    else console.log(`\n${count} migrasi berhasil diaplikasikan.`)
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Migration gagal:', err.message)
  process.exit(1)
})
