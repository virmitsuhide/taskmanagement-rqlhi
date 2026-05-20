import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle({ client: sql, schema })
}

export const db = getDb()
