import { Client } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

/*
  PENGAMAN — skrip ini TIDAK boleh dijalankan pada database production.

  Ia menjalankan setiap drizzle/*.sql yang tagnya belum ada di tabel
  drizzle_migrations. Tetapi migrasi RQ LHI selama ini ditempel manual ke SQL
  Editor Supabase, dan ledger itu hanya mencatat 17 dari ±90 migrasi — jadi
  skrip ini akan mencoba menjalankan ulang puluhan migrasi lama (berikut
  kembaran *_PASTE_TO_SUPABASE.sql-nya) pada data yang sudah ada.

  Dulu ia "aman" hanya karena kebetulan tidak bisa terhubung: host
  db.<ref>.supabase.co hanya IPv6. Begitu ada yang memakai alamat pooler,
  pengaman yang kebetulan itu hilang.

  Prosedur yang berlaku: lihat docs/DATABASE.md. Untuk database kosong
  (mis. staging baru), terapkan drizzle/snapshot/schema.sql, bukan skrip ini.
*/
if (process.env.IZINKAN_MIGRATE_LAMA !== 'ya') {
  console.error([
    'db:migrate dinonaktifkan — ledger drizzle_migrations tidak lengkap, sehingga',
    'skrip ini akan menjalankan ulang migrasi lama pada database yang sudah berisi.',
    '',
    'Migrasi baru: tempel di SQL Editor Supabase, lalu jalankan `npm run db:snapshot`.',
    'Database kosong: terapkan drizzle/snapshot/schema.sql.',
    'Selengkapnya: docs/DATABASE.md',
  ].join('\n'))
  process.exit(1)
}

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
