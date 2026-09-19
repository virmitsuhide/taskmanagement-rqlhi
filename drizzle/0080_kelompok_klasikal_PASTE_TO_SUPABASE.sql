-- ============================================================
-- Kelompok klasikal tahsin — diatur pengampu per halaqoh (sesi)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • kelompok_klasikal          → BARU, kelompok baca bersama dalam satu halaqoh
--   • kelompok_klasikal_anggota  → BARU, anggota tiap kelompok
--
-- ── KENAPA DISIMPAN, BUKAN DITEBAK DARI POSISI ──────────────
--
-- Di lapangan ada sesi yang seluruhnya klasikal, ada yang campuran, ada yang
-- murni individual. Yang tahu anak mana membaca bersama adalah pengampunya,
-- bukan kebetulan posisi halamannya sama hari itu. Pengaturan ini dipakai
-- halaman Setor Tahsin per sesi; mengganti anggota mengubah cara setoran
-- BERIKUTNYA — setoran yang sudah tersimpan tetap per anak dan tidak berubah.
--
-- Satu anak hanya boleh di satu kelompok (UNIQUE student_id). Anak yang
-- pindah halaqoh ikut terlepas dari kelompoknya lewat pemeriksaan di kode:
-- kelompok hanya membaca anggota yang halaqoh_id-nya masih sama.
-- ============================================================

CREATE TABLE IF NOT EXISTS "kelompok_klasikal" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "halaqoh_id"  uuid NOT NULL REFERENCES "halaqoh"("id") ON DELETE CASCADE,
  "nama"        text NOT NULL,
  "urutan"      smallint NOT NULL DEFAULT 0,
  "dibuat_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "kelompok_klasikal_halaqoh_idx" ON "kelompok_klasikal" ("halaqoh_id");

CREATE TABLE IF NOT EXISTS "kelompok_klasikal_anggota" (
  "kelompok_id" uuid NOT NULL REFERENCES "kelompok_klasikal"("id") ON DELETE CASCADE,
  "student_id"  uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  PRIMARY KEY ("kelompok_id", "student_id"),
  CONSTRAINT "kelompok_klasikal_anggota_satu_kelompok" UNIQUE ("student_id")
);

ALTER TABLE "kelompok_klasikal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kelompok_klasikal_anggota" ENABLE ROW LEVEL SECURITY;
