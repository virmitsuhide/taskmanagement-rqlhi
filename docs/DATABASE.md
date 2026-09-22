# Database — prosedur perubahan skema

Berlaku sejak 22 September 2026. Menggantikan "Aturan baru ke depan" di PRD §5.

## Keadaan sebenarnya

- Database: **Supabase Postgres 17** (project `ebzqbckjgaxxyxlunmbh`, region Singapura).
- Skema dibangun dari ±90 migrasi SQL di `drizzle/`, yang **ditempel manual**
  ke SQL Editor Supabase.
- Ledger `drizzle_migrations` hanya mencatat 17 di antaranya, dan
  `drizzle/meta/_journal.json` hanya satu entri. Keduanya **tidak bisa**
  dipakai untuk mengetahui migrasi mana yang sudah berjalan.
- Satu-satunya gambaran utuh skema adalah **`drizzle/snapshot/schema.sql`**.

## Tiga aturan

1. **Jangan jalankan `npm run db:generate`** (`drizzle-kit generate`).
   `lib/db/schema.ts` tidak memuat seluruh skema, jadi hasilnya bisa berupa
   migrasi yang menghapus tabel.
2. **Jangan jalankan `npm run db:migrate`** pada database yang sudah berisi.
   Skrip itu sekarang menolak berjalan (lihat pengaman di `scripts/migrate.ts`).
3. **Setiap perubahan skema diakhiri dengan `npm run db:snapshot`**, dan
   hasilnya ikut di-commit bersama berkas migrasinya.

## Menambah migrasi

1. Tulis `drizzle/NNNN_nama.sql` dan kembarannya
   `drizzle/NNNN_nama_PASTE_TO_SUPABASE.sql` seperti migrasi sebelumnya.
2. Tempel `…_PASTE_TO_SUPABASE.sql` ke **SQL Editor Supabase**, jalankan.
3. `npm run db:snapshot` → memperbarui `drizzle/snapshot/schema.sql`.
4. Bila jumlah tabel/enum/constraint/indeks/fungsi/trigger berubah, samakan
   angka `HARAP` di `scripts/uji-skema.ts` dengan keluaran langkah 3.
5. `npm run uji:skema` → memastikan snapshot masih bisa membangun database dari nol.
6. Commit migrasi + snapshot + uji bersamaan. CI menjalankan `uji:skema` lagi.

`git diff drizzle/snapshot/schema.sql` pada langkah 6 adalah cara termudah
memeriksa bahwa migrasi melakukan persis apa yang dimaksud — tidak lebih.

## Membangun database baru (staging, pemulihan, uji)

1. Buat project Supabase kosong.
2. Jalankan seluruh `drizzle/snapshot/schema.sql` di SQL Editor-nya.
3. Isi data acuan: `npm run seed:phase0` (metode tahsin, jilid, surat) dan
   seed lain yang diperlukan. **Jangan** jalankan `seed:demo*` pada production.

Snapshot hanya memuat **struktur**, bukan isi. Cadangan data tetap urusan
backup harian Supabase (Dashboard → Database → Backups).

## Koneksi dari komputer pengembang

Host langsung `db.<ref>.supabase.co` **hanya punya alamat IPv6**; jaringan
kantor/rumah umumnya IPv4, sehingga koneksinya gagal dengan `ENOTFOUND`.
Skrip yang perlu terhubung langsung (mis. `db:snapshot`) memakai
**Session Pooler** — database & kata sandi sama, pintu masuknya lain:

- otomatis diturunkan dari `DATABASE_URL` dengan host
  `aws-1-ap-southeast-1.pooler.supabase.com`, atau
- isi `DATABASE_URL_POOLER` di `.env.local` (Dashboard Supabase → Connect →
  Session pooler) bila host pooler berubah.

`db:snapshot` membuka sesi **read-only**; ia tidak pernah mengubah database.
