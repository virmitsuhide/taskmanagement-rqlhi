-- ============================================================
-- PHASE 8 — Penilaian: rename makhraj→fashohah + setengah bintang
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman dalam 1 transaksi (tidak ada perubahan enum).
--
-- Perubahan: nilai_makhraj → nilai_fashohah; smallint → numeric(2,1)
--            agar nilai bisa 0.5 (mis. 4.5 / 3.5). Pada 3 tabel setoran.
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tahsin_logs', 'tahfidz_logs', 'tasmi_logs'] LOOP
    -- buang CHECK lama (smallint 1-5)
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_nilai_makhraj_check');
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_nilai_tajwid_check');
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_nilai_kelancaran_check');

    -- rename makhraj → fashohah (lewati bila sudah pernah dijalankan)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'nilai_makhraj') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN nilai_makhraj TO nilai_fashohah', t);
    END IF;

    -- smallint → numeric(2,1)
    EXECUTE format('ALTER TABLE %I ALTER COLUMN nilai_fashohah   TYPE numeric(2,1) USING nilai_fashohah::numeric(2,1)', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN nilai_tajwid     TYPE numeric(2,1) USING nilai_tajwid::numeric(2,1)', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN nilai_kelancaran TYPE numeric(2,1) USING nilai_kelancaran::numeric(2,1)', t);

    -- CHECK baru: 0.5–5 kelipatan 0.5
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (nilai_fashohah   >= 0.5 AND nilai_fashohah   <= 5 AND nilai_fashohah   * 2 = floor(nilai_fashohah   * 2))', t, t || '_nilai_fashohah_check');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (nilai_tajwid     >= 0.5 AND nilai_tajwid     <= 5 AND nilai_tajwid     * 2 = floor(nilai_tajwid     * 2))', t, t || '_nilai_tajwid_check');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (nilai_kelancaran >= 0.5 AND nilai_kelancaran <= 5 AND nilai_kelancaran * 2 = floor(nilai_kelancaran * 2))', t, t || '_nilai_kelancaran_check');
  END LOOP;
END $$;

-- Verifikasi:
--   SELECT column_name, data_type, numeric_scale FROM information_schema.columns
--   WHERE table_name='tahsin_logs' AND column_name LIKE 'nilai_%';
--   -- harus: nilai_fashohah / nilai_tajwid / nilai_kelancaran, numeric, scale 1

-- Daftarkan ke drizzle_migrations
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id serial PRIMARY KEY, tag text UNIQUE NOT NULL, applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0007_nilai_fashohah_half_star')
ON CONFLICT (tag) DO NOTHING;
