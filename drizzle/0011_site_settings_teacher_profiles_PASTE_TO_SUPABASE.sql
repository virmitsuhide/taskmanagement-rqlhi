-- ============================================================
-- Kelola Beranda — site_settings + profil publik guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman dalam 1 transaksi & idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru  : site_settings (singleton id = 1) — teks header/footer,
--                   unit pendidikan, link footer, kontak, dan konfigurasi
--                   seksi beranda (jsonb `sections`)
--   • teachers    : + public_title, public_bio, is_public, display_order
--                   → dipakai halaman publik /profil-guru
--
-- Catatan: aplikasi punya nilai bawaan di lib/data/site.ts, jadi baris
-- site_settings boleh kosong — beranda tetap tampil normal.
-- ============================================================

-- 1) Kolom profil publik di teachers
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "public_title"  text;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "public_bio"    text;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "is_public"     boolean DEFAULT false;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0;

UPDATE "teachers" SET "is_public"     = false WHERE "is_public"     IS NULL;
UPDATE "teachers" SET "display_order" = 0     WHERE "display_order" IS NULL;

-- Halaman publik selalu memfilter is_active + is_public lalu mengurutkan
-- display_order; indeks ini membuat query itu tidak perlu seq scan.
CREATE INDEX IF NOT EXISTS "teachers_public_idx"
  ON "teachers" ("is_public", "is_active", "display_order");

-- 2) Tabel site_settings
CREATE TABLE IF NOT EXISTS "site_settings" (
  "id"               integer PRIMARY KEY DEFAULT 1,
  "header_brand"     text DEFAULT '',
  "header_tagline"   text DEFAULT '',
  "footer_brand"     text DEFAULT '',
  "footer_brand_sub" text DEFAULT '',
  "footer_tagline"   text DEFAULT '',
  "footer_units"     jsonb DEFAULT '[]'::jsonb,
  "footer_links"     jsonb DEFAULT '[]'::jsonb,
  "footer_email"     text DEFAULT '',
  "footer_phone"     text DEFAULT '',
  "footer_hours"     text DEFAULT '',
  "footer_copyright" text DEFAULT '',
  "sections"         jsonb DEFAULT '[]'::jsonb,
  "updated_at"       timestamptz DEFAULT now(),
  "updated_by"       uuid REFERENCES "users"("id"),
  CONSTRAINT "site_settings_singleton" CHECK ("id" = 1)
);

INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

-- 3) RLS — mengikuti pola tabel konten lain di skema ini
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_settings' AND policyname = 'site_settings_service_role'
  ) THEN
    CREATE POLICY "site_settings_service_role" ON "site_settings"
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4) Trigger updated_at (fungsi set_updated_at sudah ada dari schema.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at')
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger WHERE tgname = 'site_settings_updated_at'
     ) THEN
    CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON "site_settings"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Verifikasi:
--   SELECT * FROM site_settings;
--   SELECT full_name, is_public, public_title, display_order FROM teachers ORDER BY display_order;

CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id serial PRIMARY KEY, tag text UNIQUE NOT NULL, applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0011_site_settings_teacher_profiles')
ON CONFLICT (tag) DO NOTHING;
