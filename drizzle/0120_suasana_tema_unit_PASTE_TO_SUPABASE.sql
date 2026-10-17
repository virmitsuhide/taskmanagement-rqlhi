-- ============================================================
-- Suasana: lima tema unit LHI (lanjutan 0116)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Menambah pilihan suasana_terang untuk warna logo tiap unit:
--   tpait   — Tema TPAIT LHI (hijau pucuk)
--   sdit    — Tema SDIT LHI (teal)
--   sdjuara — Tema SD LHI Juara (teal + jingga)
--   smpit   — Tema SMPIT LHI (biru langit)
--   sma     — Tema SMA LHI (biru dongker)
--
-- Hanya batasan CHECK yang diganti; kolom dan isinya tidak berubah.
-- Sebelum file ini dijalankan, tema unit tetap terpakai lewat cookie di
-- perangkat itu, hanya belum tersimpan ke akun.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'teachers', 'employees'] LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_suasana_terang_check');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (suasana_terang IS NULL OR suasana_terang IN (''teduh'', ''fajar'', ''samudra'', ''zaitun'', ''mushaf'', ''kontras'', ''tpait'', ''sdit'', ''sdjuara'', ''smpit'', ''sma''))',
      t, t || '_suasana_terang_check');
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
