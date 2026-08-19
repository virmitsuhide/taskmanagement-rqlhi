-- ============================================================
-- Rubrik nilai untuk tasmi' — melengkapi migrasi 0024
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tasmi_logs + nilai_tahfidz, nilai_sikap
--
-- Migrasi 0024 mengganti rubrik pada tahsin_logs & tahfidz_logs tapi
-- melewatkan tasmi_logs, yang memakai tiga kolom lama yang sama. Kalau
-- dibiarkan, satu-satunya formulir yang masih meminta fashohah/tajwid/
-- kelancaran justru ujian tasmi' — dan guru harus berpindah rubrik di
-- tengah alur kerja yang sama.
-- ============================================================

ALTER TABLE tasmi_logs ADD COLUMN IF NOT EXISTS nilai_tahfidz numeric(5,2);
ALTER TABLE tasmi_logs ADD COLUMN IF NOT EXISTS nilai_sikap   numeric(5,2);

DO $$ BEGIN
  ALTER TABLE tasmi_logs ADD CONSTRAINT tasmi_logs_nilai_wajar
    CHECK (
      (nilai_tahfidz IS NULL OR (nilai_tahfidz >= 0 AND nilai_tahfidz <= 100)) AND
      (nilai_sikap   IS NULL OR (nilai_sikap   >= 0 AND nilai_sikap   <= 100))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verifikasi (opsional):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'tasmi_logs' AND column_name LIKE 'nilai%';
