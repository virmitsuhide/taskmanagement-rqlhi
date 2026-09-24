-- ============================================================
-- Rapor Qur'an: jenis ATS / Semester, isian merah, jenis kelamin guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0082 (rapor_templates, rapor_isian), 0083.
--
-- Yang berubah:
--   • rapor_templates.jenis        → BARU, 'ats' | 'semester'
--   • rapor_templates.awal_isian   → BARU, isi awal tiap isian merah
--   • rapor_isian.jenis            → BARU, kunci utama kini (siswa, semester, jenis)
--   • rapor_isian.isian            → BARU, tulisan guru per isian merah
--   • teachers.gender              → BARU, L/P — untuk "ustadz"/"ustadzah"
--
-- ── MASALAH YANG DISELESAIKAN ───────────────────────────────
--
-- 1. Satu semester punya DUA laporan: Asesmen Tengah Semester (ATS) di
--    pertengahan dan rapor di akhir. Sampai sekarang rapor_isian berkunci
--    (siswa, semester), jadi deskripsi ATS dan deskripsi rapor saling
--    menimpa. Kini jenis ikut menjadi bagian kunci.
--
-- 2. Template ATS SMP menandai bagian yang boleh diganti dengan huruf MERAH,
--    termasuk potongan di tengah kalimat deskripsi ("berusaha hadir tepat
--    waktu dan tertib", "Sangat baik"). Guru mengisi potongan-potongan itu
--    saja; kalimat hitamnya terkunci. Tulisannya disimpan per potongan di
--    rapor_isian.isian (id slot → teks), dan isi awalnya — contoh template,
--    kosong, atau data sistem — diatur koordinator di awal_isian.
--
-- 3. "ustadz"/"ustadzah" bergantung pada jenis kelamin guru, yang belum
--    tercatat di mana pun.
--
-- Baris lama tidak disentuh: jenis bawaannya 'semester', persis arti
-- seluruh rapor yang diisi sebelum migrasi ini.
-- ============================================================

ALTER TABLE "rapor_templates"
  ADD COLUMN IF NOT EXISTS "jenis" text NOT NULL DEFAULT 'semester';
ALTER TABLE "rapor_templates"
  ADD COLUMN IF NOT EXISTS "awal_isian" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "rapor_isian"
  ADD COLUMN IF NOT EXISTS "jenis" text NOT NULL DEFAULT 'semester';
ALTER TABLE "rapor_isian"
  ADD COLUMN IF NOT EXISTS "isian" jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapor_templates_jenis_sah') THEN
    ALTER TABLE "rapor_templates"
      ADD CONSTRAINT "rapor_templates_jenis_sah" CHECK ("jenis" IN ('ats', 'semester'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapor_isian_jenis_sah') THEN
    ALTER TABLE "rapor_isian"
      ADD CONSTRAINT "rapor_isian_jenis_sah" CHECK ("jenis" IN ('ats', 'semester'));
  END IF;
END $$;

-- Kunci utama (siswa, semester) → (siswa, semester, jenis). Diganti hanya
-- bila masih berbentuk lama, supaya berkas ini aman dijalankan ulang.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint k
    WHERE k.conname = 'rapor_isian_pkey'
      AND array_length(k.conkey, 1) = 2
  ) THEN
    ALTER TABLE "rapor_isian" DROP CONSTRAINT "rapor_isian_pkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rapor_isian_pkey') THEN
    ALTER TABLE "rapor_isian" ADD CONSTRAINT "rapor_isian_pkey" PRIMARY KEY ("student_id", "term_id", "jenis");
  END IF;
END $$;

DROP INDEX IF EXISTS "rapor_templates_jenjang_idx";
CREATE INDEX IF NOT EXISTS "rapor_templates_jenjang_jenis_idx"
  ON "rapor_templates" ("jenjang", "jenis", "aktif");

ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "gender" gender;
