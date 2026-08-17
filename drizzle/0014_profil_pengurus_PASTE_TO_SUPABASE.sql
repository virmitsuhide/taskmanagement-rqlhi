-- ============================================================
-- Profil Pengurus — data diri, pendidikan, kompetensi, riwayat
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman & idempoten (boleh dijalankan ulang).
--
-- ⚠️ SATU LANGKAH MANUAL TAMBAHAN (untuk foto profil):
--    Supabase → Storage → New bucket
--      Name   : profile-photos
--      Public : ya (dicentang)
--    Tanpa bucket ini form tetap jalan, hanya unggah foto yang gagal.
--
-- Yang berubah — semua kolom baru di tabel users:
--   • sapaan            : 'ust' / 'usth' → dipakai untuk "Ust. Habib" / "Usth. Aul"
--   • nickname          : nama panggilan
--   • full_name         : nama lengkap (display_name tetap dipakai untuk sapaan singkat)
--   • nip, birth_place, birth_date, current_amanah
--   • education_level   : SD/SMP/SMA/S1/S2/S3
--   • photo_url         : hasil unggah ke bucket profile-photos
--   • competencies      : text[]  — satu kompetensi per baris
--   • trainings         : jsonb   — [{ name, year, organizer }]
--   • amanah_history    : jsonb   — [{ position, period }]
--   • awards            : jsonb   — [{ name, year }]
--
-- Kolom daftar dibuat nullable dengan default kosong supaya baris users yang
-- sudah ada tetap valid tanpa perlu diisi.
-- ============================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sapaan"          text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname"        text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name"       text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nip"             text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_place"     text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date"      date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_amanah"  text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "education_level" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url"       text;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "competencies"   text[] DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trainings"      jsonb  DEFAULT '[]'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "amanah_history" jsonb  DEFAULT '[]'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "awards"         jsonb  DEFAULT '[]'::jsonb;

-- Baris lama: pastikan kolom daftar tidak NULL agar aman di-spread di aplikasi.
UPDATE "users" SET "competencies"   = '{}'         WHERE "competencies"   IS NULL;
UPDATE "users" SET "trainings"      = '[]'::jsonb  WHERE "trainings"      IS NULL;
UPDATE "users" SET "amanah_history" = '[]'::jsonb  WHERE "amanah_history" IS NULL;
UPDATE "users" SET "awards"         = '[]'::jsonb  WHERE "awards"         IS NULL;

-- Nama lengkap awal mengikuti display_name supaya tidak kosong di tampilan.
UPDATE "users" SET "full_name" = "display_name" WHERE "full_name" IS NULL;

-- Verifikasi (opsional):
-- SELECT username, sapaan, nickname, full_name, education_level FROM users;
