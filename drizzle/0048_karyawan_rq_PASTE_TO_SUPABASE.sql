-- ============================================================
-- Karyawan RQ — entitas tersendiri, terpisah dari guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru : employees
--   • data       : Dewi Maghfiroh dipindah dari teachers ke employees
--
-- KENAPA TABEL SENDIRI, BUKAN PENANDA DI teachers
--
-- Karyawan RQ tidak mengampu halaqoh, tidak menyetor hafalan, tidak dinilai
-- KPI, dan tidak punya unit penugasan. Menumpangkannya di teachers berarti
-- setiap kueri guru harus mengingat untuk menyaringnya — dan yang lupa tidak
-- akan gagal, hanya diam-diam salah hitung. Bendahara sempat berstatus guru
-- non-aktif justru karena itu satu-satunya cara menyembunyikannya dari daftar.
--
-- Bentuk kolom profilnya sengaja sama persis dengan teachers dan users, supaya
-- satu komponen form melayani ketiganya tanpa cabang.
--
-- linked_user_id ada di sini juga: kursi Bendahara di menu Pengurus dipegang
-- karyawan, bukan guru, jadi penghubung jabatan → orang harus bisa menunjuk ke
-- kedua tabel. Indeks uniknya sejalan dengan teachers_linked_user_id_unik
-- (drizzle/0046) — satu akun jabatan, satu pemegang.

CREATE TABLE IF NOT EXISTS "employees" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "username"            text NOT NULL,
  "password_hash"       text NOT NULL,
  "full_name"           text NOT NULL,
  -- Posisi kerja, mis. 'Bendahara'. Bukan amanah pengurus: amanah diturunkan
  -- dari role akun (AMANAH_LABELS), yang ini melekat pada orangnya.
  "jabatan"             text,
  "nip"                 text,
  "email"               text,
  "phone"               text,
  "photo_url"           text,
  "photo_focus"         jsonb,
  "is_active"           boolean DEFAULT true,
  "can_change_password" boolean DEFAULT true,
  "employment_type"     teacher_employment,
  "joined_at"           date,
  "contract_start"      date,
  "contract_end"        date,
  "deleted_at"          timestamptz,
  -- ── Profil pribadi — bentuk sama dengan teachers & users ──
  "sapaan"              text,
  "nickname"            text,
  "birth_place"         text,
  "birth_date"          date,
  "education_level"     text,
  "education_history"   jsonb,
  "quran_competencies"  jsonb,
  "other_competencies"  jsonb,
  "ijazah_sanad"        text[],
  "trainings"           jsonb,
  "amanah_history"      jsonb,
  "awards"              jsonb,
  "linked_user_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          timestamptz DEFAULT now(),
  "updated_at"          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_username_unik"
  ON "employees" ("username")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "employees_linked_user_id_unik"
  ON "employees" ("linked_user_id")
  WHERE "linked_user_id" IS NOT NULL AND "deleted_at" IS NULL;

-- ── Pindahkan Bendahara dari teachers ke employees ──────────────────────────
--
-- Dicocokkan lewat username, bukan id, supaya blok ini tetap benar kalau
-- dijalankan di database salinan yang id-nya berbeda. Sudah diperiksa sebelum
-- ditulis: baris ini tidak dirujuk halaqoh, kpi_monthly, maupun gukar_groups,
-- dan kolom profilnya masih kosong — jadi tidak ada yang tertinggal.

INSERT INTO "employees" (
  username, password_hash, full_name, jabatan, nip, email, phone,
  photo_url, photo_focus, is_active, can_change_password,
  employment_type, joined_at, contract_start, contract_end,
  sapaan, nickname, birth_place, birth_date, education_level, education_history,
  quran_competencies, other_competencies, ijazah_sanad, trainings, amanah_history, awards,
  linked_user_id
)
SELECT
  t.username, t.password_hash, t.full_name, 'Bendahara', t.nip, t.email, t.phone,
  t.photo_url, t.photo_focus, true, t.can_change_password,
  t.employment_type, t.joined_at, t.contract_start, t.contract_end,
  t.sapaan, t.nickname, t.birth_place, t.birth_date, t.education_level, t.education_history,
  t.quran_competencies, t.other_competencies, t.ijazah_sanad, t.trainings, t.amanah_history, t.awards,
  t.linked_user_id
FROM "teachers" t
WHERE t.username = 'dewi_maghfiroh'
  AND t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM "employees" e WHERE e.username = t.username);

-- Baris guru lama dilepas dari kursi Bendahara lalu dihapus. Dihapus betulan,
-- bukan hapus lunak: baris hapus lunak muncul di tab "Terhapus" menu Ustadz,
-- tempat ia bisa dipulihkan sebagai guru — persis kekeliruan yang sedang
-- dibereskan migrasi ini. Datanya sudah tersalin utuh ke employees di atas.
DELETE FROM "teachers"
WHERE username = 'dewi_maghfiroh'
  AND EXISTS (SELECT 1 FROM "employees" e WHERE e.username = 'dewi_maghfiroh');
