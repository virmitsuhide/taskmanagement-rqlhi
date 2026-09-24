/**
 * Uji: drizzle/snapshot/schema.sql benar-benar bisa membangun database dari nol.
 *
 * Jalankan: npm run uji:skema   (ikut npm run uji, jadi ikut CI)
 *
 * Snapshot skema hanya berguna kalau ia bisa dijalankan pada database kosong.
 * Uji ini menerapkannya ke PGlite — Postgres 17 sungguhan yang berjalan di
 * dalam Node (WASM), tanpa server dan tanpa kredensial — lalu memeriksa
 * jumlah objeknya dan satu alur penyisipan.
 *
 * Angka HARAP disalin dari keluaran `npm run db:snapshot` terakhir. Bila
 * skema berubah (migrasi baru), perbarui snapshot DAN angka ini bersamaan —
 * uji yang gagal di sini berarti snapshot tidak lagi sesuai dengan yang
 * diharapkan, atau tidak bisa lagi dibangun ulang.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { readFileSync } from 'fs'
import { join } from 'path'

const HARAP = {
  tabel: 81,
  enum: 38,
  constraint: 356,
  indeks: 112,
  fungsi: 6,
  trigger: 14,
  rls: 81,
  bucket: 5,
}

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = dapat === harap
  if (!ok) gagal++
  console.log(`${ok ? '✓' : '✗'} ${nama}: ${String(dapat)}${ok ? '' : ` (harap ${String(harap)})`}`)
}

async function main() {
  const sql = readFileSync(join(process.cwd(), 'drizzle', 'snapshot', 'schema.sql'), 'utf8')
  const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } })

  // Panggung Supabase: objek yang di Supabase sudah ada sebelum migrasi mana
  // pun — skema extensions, role bawaan, dan tabel storage.
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  `)

  try {
    await db.exec(sql)
    console.log('✓ schema.sql diterapkan ke database kosong')
  } catch (e) {
    console.log(`✗ schema.sql gagal diterapkan: ${(e as Error).message}`)
    gagal++
    return
  }

  const angka = async (q: string) => Number(Object.values((await db.query(q)).rows[0] as object)[0])
  const publik = `join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'`

  cek('tabel', await angka(`select count(*) from pg_class c ${publik} and c.relkind = 'r'`), HARAP.tabel)
  cek('enum', await angka(`select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'`), HARAP.enum)
  cek('constraint', await angka(`select count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid ${publik} and k.contype in ('p','u','c','f','x')`), HARAP.constraint)
  cek('indeks', await angka(`select count(*) from pg_index i join pg_class c on c.oid = i.indrelid ${publik} and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)`), HARAP.indeks)
  cek('fungsi', await angka(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`), HARAP.fungsi)
  cek('trigger', await angka(`select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid ${publik} and not t.tgisinternal`), HARAP.trigger)
  cek('tabel ber-RLS', await angka(`select count(*) from pg_class c ${publik} and c.relrowsecurity`), HARAP.rls)
  cek('bucket storage', await angka(`select count(*) from storage.buckets`), HARAP.bucket)

  // Asap: default uuid, default kolom lain, dan trigger updated_at berjalan.
  await db.exec(`INSERT INTO public.tahsin_methods (name) VALUES ('UJI')`)
  cek('sisip baris uji', await angka(`select count(*) from public.tahsin_methods where name = 'UJI' and id is not null`), 1)

  await db.close()
}

main()
  .then(() => {
    console.log(`\n${gagal === 0 ? '✓ SEMUA LOLOS' : `✗ ${gagal} pemeriksaan GAGAL`}`)
    if (gagal > 0) process.exitCode = 1
  })
  .catch(e => {
    console.error('Uji skema gagal:', (e as Error).message)
    process.exitCode = 1
  })
