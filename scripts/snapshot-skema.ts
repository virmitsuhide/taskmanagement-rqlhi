/**
 * Snapshot skema database production → drizzle/snapshot/schema.sql
 *
 * Jalankan: npm run db:snapshot
 *
 * KENAPA ADA
 *
 * Skema RQ LHI dibangun dari ±90 migrasi SQL yang ditempel manual ke SQL
 * Editor Supabase (lihat drizzle/*_PASTE_TO_SUPABASE.sql). Ledger
 * drizzle_migrations hanya mencatat sebagian, dan journal Drizzle hanya satu
 * entri — jadi tidak ada cara untuk membangun ulang database dari repo.
 * Berkas hasil skrip ini adalah SATU sumber yang bisa dijalankan pada
 * database Postgres kosong untuk mendapatkan struktur yang sama persis.
 *
 * Tanpa pg_dump: mesin pengembang tidak punya pg_dump maupun Docker, jadi
 * DDL-nya disusun dari katalog Postgres memakai fungsi resmi Postgres sendiri
 * (pg_get_constraintdef, pg_get_indexdef, pg_get_functiondef,
 * pg_get_triggerdef, pg_get_expr, format_type) — teks yang sama yang dipakai
 * pg_dump. Urutannya ditetapkan (menurut nama) supaya diff antar-snapshot di
 * git hanya memuat perubahan yang sungguhan.
 *
 * Yang DIAMBIL: skema public (ekstensi, enum, sequence, fungsi, tabel, kolom,
 * default, constraint, indeks, trigger, RLS & policy, komentar) plus bucket
 * dan policy storage buatan aplikasi. Yang TIDAK: isi tabel (data acuan ada
 * di scripts/seed-*.ts), skema auth/storage bawaan Supabase, dan grant.
 *
 * Aman: sesi dibuka read-only; skrip ini tidak pernah mengubah database.
 *
 * KONEKSI
 * Host langsung db.<ref>.supabase.co hanya punya alamat IPv6, sedangkan
 * jaringan pengembang IPv4. Karena itu dipakai Session Pooler Supabase —
 * database dan kata sandinya sama, pintunya saja yang lain:
 *   1. DATABASE_URL_POOLER bila diisi di .env.local, atau
 *   2. diturunkan dari DATABASE_URL dengan host SUPABASE_POOLER_HOST
 *      (bawaan: aws-1-ap-southeast-1.pooler.supabase.com, region project ini).
 */
import { Client } from 'pg'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const KELUARAN = join(process.cwd(), 'drizzle', 'snapshot', 'schema.sql')
const POOLER_BAWAAN = 'aws-1-ap-southeast-1.pooler.supabase.com'

function urlKoneksi(): string {
  if (process.env.DATABASE_URL_POOLER) return process.env.DATABASE_URL_POOLER
  const mentah = process.env.DATABASE_URL
  if (!mentah) {
    console.error('DATABASE_URL tidak ditemukan di .env.local')
    process.exit(1)
  }
  const u = new URL(mentah)
  const langsung = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)
  if (!langsung) return mentah
  u.hostname = process.env.SUPABASE_POOLER_HOST ?? POOLER_BAWAAN
  u.port = '5432'
  u.username = `postgres.${langsung[1]}`
  return u.toString()
}

const id = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

async function main() {
  const db = new Client({ connectionString: urlKoneksi(), ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query('SET default_transaction_read_only = on')
  const q = async <T>(sql: string): Promise<T[]> => (await db.query(sql)).rows as T[]

  const out: string[] = []
  const bagian = (judul: string) => out.push('', `-- ${'─'.repeat(3)} ${judul} ${'─'.repeat(Math.max(3, 70 - judul.length))}`, '')

  const [{ versi }] = await q<{ versi: string }>(`select current_setting('server_version') as versi`)
  out.push(
    '-- Snapshot skema database RQ LHI — DIBUAT OTOMATIS, jangan disunting tangan.',
    '-- Perbarui dengan: npm run db:snapshot  (lihat scripts/snapshot-skema.ts)',
    `-- Sumber: Postgres ${versi} (Supabase production), skema public + storage buatan aplikasi.`,
    '--',
    '-- Membangun ulang: jalankan berkas ini pada database Postgres/Supabase KOSONG,',
    '-- lalu isi data acuan dengan scripts/seed-*.ts. Jangan jalankan pada database',
    '-- yang sudah berisi — CREATE di bawah akan gagal pada objek yang sudah ada.',
    '',
    'SET check_function_bodies = false;',
    'SET client_min_messages = warning;',
  )

  // ── Ekstensi ────────────────────────────────────────────────────────
  bagian('Ekstensi')
  const ekstensi = await q<{ extname: string; skema: string }>(`
    select e.extname, n.nspname as skema from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname in ('pgcrypto', 'uuid-ossp', 'pg_trgm', 'citext', 'unaccent')
    order by 1`)
  for (const e of ekstensi) out.push(`CREATE EXTENSION IF NOT EXISTS ${id(e.extname)} WITH SCHEMA ${id(e.skema)};`)

  // ── Enum ────────────────────────────────────────────────────────────
  bagian('Enum')
  const enums = await q<{ nama: string; nilai: string[] }>(`
    select t.typname as nama, array_agg(e.enumlabel::text order by e.enumsortorder) as nilai
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public' group by t.typname order by 1`)
  for (const e of enums) {
    out.push(`CREATE TYPE public.${id(e.nama)} AS ENUM (${e.nilai.map(lit).join(', ')});`)
  }

  // ── Sequence (yang dipakai default nextval) ─────────────────────────
  bagian('Sequence')
  const seqs = await q<{ nama: string; mulai: string; naik: string }>(`
    select c.relname as nama, s.seqstart::text as mulai, s.seqincrement::text as naik
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_sequence s on s.seqrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'S' order by 1`)
  for (const s of seqs) out.push(`CREATE SEQUENCE public.${id(s.nama)} START ${s.mulai} INCREMENT ${s.naik};`)

  // ── Fungsi ──────────────────────────────────────────────────────────
  // Sebelum tabel: default kolom & trigger bisa bergantung padanya, dan
  // check_function_bodies=false membuat badan fungsi tidak divalidasi dulu.
  bagian('Fungsi')
  const fungsi = await q<{ def: string }>(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by p.proname, pg_get_function_identity_arguments(p.oid)`)
  for (const f of fungsi) out.push(`${f.def.trim()};`, '')

  // ── Tabel & kolom ───────────────────────────────────────────────────
  bagian('Tabel')
  const tabel = await q<{ oid: number; nama: string }>(`
    select c.oid, c.relname as nama from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 2`)
  const kolom = await q<{
    tabel: string; nama: string; tipe: string; wajib: boolean; bawaan: string | null; hasil: string
  }>(`
    select c.relname as tabel, a.attname as nama, format_type(a.atttypid, a.atttypmod) as tipe,
           a.attnotnull as wajib, pg_get_expr(d.adbin, d.adrelid) as bawaan, a.attgenerated as hasil
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`)
  for (const t of tabel) {
    const baris = kolom.filter(k => k.tabel === t.nama).map(k => {
      let s = `  ${id(k.nama)} ${k.tipe}`
      if (k.hasil === 's' && k.bawaan) s += ` GENERATED ALWAYS AS (${k.bawaan}) STORED`
      else if (k.bawaan) s += ` DEFAULT ${k.bawaan}`
      if (k.wajib) s += ' NOT NULL'
      return s
    })
    out.push(`CREATE TABLE public.${id(t.nama)} (`, baris.join(',\n'), ');', '')
  }
  for (const s of seqs) {
    const pemilik = await q<{ tabel: string; kolom: string }>(`
      select c.relname as tabel, a.attname as kolom from pg_depend d
      join pg_class c on c.oid = d.refobjid
      join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
      where d.objid = 'public.${s.nama}'::regclass and d.deptype = 'a'`)
    if (pemilik[0]) out.push(`ALTER SEQUENCE public.${id(s.nama)} OWNED BY public.${id(pemilik[0].tabel)}.${id(pemilik[0].kolom)};`)
  }

  // ── Constraint ──────────────────────────────────────────────────────
  // FK paling akhir: semua tabel & kunci yang dirujuk sudah ada lebih dulu.
  bagian('Constraint (PK, unik, check, lalu FK)')
  const kons = await q<{ tabel: string; nama: string; jenis: string; def: string }>(`
    select c.relname as tabel, k.conname as nama, k.contype as jenis, pg_get_constraintdef(k.oid) as def
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and k.contype in ('p', 'u', 'c', 'f', 'x')
    order by case k.contype when 'p' then 0 when 'u' then 1 when 'x' then 2 when 'c' then 3 else 4 end,
             c.relname, k.conname`)
  for (const k of kons) out.push(`ALTER TABLE public.${id(k.tabel)} ADD CONSTRAINT ${id(k.nama)} ${k.def};`)

  // ── Indeks (yang bukan bawaan constraint) ───────────────────────────
  bagian('Indeks')
  const indeks = await q<{ def: string }>(`
    select pg_get_indexdef(i.indexrelid) as def
    from pg_index i join pg_class ic on ic.oid = i.indexrelid
    join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
    order by t.relname, ic.relname`)
  for (const i of indeks) out.push(`${i.def};`)

  // ── Trigger ─────────────────────────────────────────────────────────
  bagian('Trigger')
  const trig = await q<{ def: string }>(`
    select pg_get_triggerdef(t.oid) as def
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by c.relname, t.tgname`)
  for (const t of trig) out.push(`${t.def};`)

  // ── RLS & policy ────────────────────────────────────────────────────
  bagian('Row Level Security')
  const rls = await q<{ nama: string; aktif: boolean; paksa: boolean }>(`
    select c.relname as nama, c.relrowsecurity as aktif, c.relforcerowsecurity as paksa
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`)
  for (const r of rls) {
    if (r.aktif) out.push(`ALTER TABLE public.${id(r.nama)} ENABLE ROW LEVEL SECURITY;`)
    if (r.paksa) out.push(`ALTER TABLE public.${id(r.nama)} FORCE ROW LEVEL SECURITY;`)
  }
  const kebijakan = async (skema: string) => q<{
    tabel: string; nama: string; permissive: string; cmd: string; roles: string[]; qual: string | null; wc: string | null
  }>(`
    select tablename as tabel, policyname as nama, permissive, cmd, roles::text[] as roles, qual, with_check as wc
    from pg_policies where schemaname = '${skema}' order by tablename, policyname`)
  const tulisPolicy = (skema: string, p: Awaited<ReturnType<typeof kebijakan>>[number]) => {

    let s = `CREATE POLICY ${id(p.nama)} ON ${skema}.${id(p.tabel)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.join(', ')}`
    if (p.qual) s += ` USING (${p.qual})`
    if (p.wc) s += ` WITH CHECK (${p.wc})`
    out.push(`${s};`)
  }
  for (const p of await kebijakan('public')) tulisPolicy('public', p)

  // ── Komentar ────────────────────────────────────────────────────────
  bagian('Komentar')
  const komen = await q<{ tabel: string; kolom: string | null; isi: string }>(`
    select c.relname as tabel, a.attname as kolom, d.description as isi
    from pg_description d join pg_class c on c.oid = d.objoid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid and d.objsubid > 0
    where n.nspname = 'public' and c.relkind in ('r', 'p') and d.classoid = 'pg_class'::regclass
    order by c.relname, d.objsubid`)
  for (const k of komen) {
    out.push(k.kolom
      ? `COMMENT ON COLUMN public.${id(k.tabel)}.${id(k.kolom)} IS ${lit(k.isi)};`
      : `COMMENT ON TABLE public.${id(k.tabel)} IS ${lit(k.isi)};`)
  }

  // ── Storage buatan aplikasi ─────────────────────────────────────────
  bagian('Storage: bucket & policy aplikasi')
  const bucket = await q<{ id: string; public: boolean; batas: string | null; mime: string[] | null }>(`
    select id, public, file_size_limit::text as batas, allowed_mime_types as mime from storage.buckets order by id`)
  for (const b of bucket) {
    const mime = b.mime ? `ARRAY[${b.mime.map(lit).join(', ')}]` : 'NULL'
    out.push(`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (${lit(b.id)}, ${lit(b.id)}, ${b.public}, ${b.batas ?? 'NULL'}, ${mime}) ON CONFLICT (id) DO NOTHING;`)
  }
  for (const p of await kebijakan('storage')) tulisPolicy('storage', p)

  await db.end()

  mkdirSync(join(process.cwd(), 'drizzle', 'snapshot'), { recursive: true })
  writeFileSync(KELUARAN, out.join('\n') + '\n', 'utf8')
  console.log(`✓ ${KELUARAN}`)
  console.log(`  ${enums.length} enum · ${seqs.length} sequence · ${fungsi.length} fungsi · ${tabel.length} tabel · ${kons.length} constraint · ${indeks.length} indeks · ${trig.length} trigger · ${bucket.length} bucket`)
}

main().catch(e => {
  console.error('Snapshot gagal:', (e as Error).message)
  process.exit(1)
})
