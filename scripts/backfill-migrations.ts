import { Client } from 'pg'
import { readdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL tidak ditemukan di .env.local')
  process.exit(1)
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

const TAGS_TO_MARK = process.argv.slice(2)
if (TAGS_TO_MARK.length === 0) {
  console.error('Usage: tsx scripts/backfill-migrations.ts <tag1> <tag2> ...')
  process.exit(1)
}

async function main() {
  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id         serial PRIMARY KEY,
        tag        text UNIQUE NOT NULL,
        applied_at timestamptz DEFAULT now()
      )
    `)
    const allTags = readdirSync(join(process.cwd(), 'drizzle'))
      .filter(f => f.endsWith('.sql'))
      .map(f => f.replace('.sql', ''))

    for (const tag of TAGS_TO_MARK) {
      if (!allTags.includes(tag)) {
        console.log(`  ✗ ${tag} (not found in drizzle/)`)
        continue
      }
      await client.query(
        'INSERT INTO drizzle_migrations (tag) VALUES ($1) ON CONFLICT (tag) DO NOTHING',
        [tag]
      )
      console.log(`  ✓ marked ${tag} as applied`)
    }
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Backfill failed:', err.message)
  process.exit(1)
})
