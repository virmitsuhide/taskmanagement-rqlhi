-- ============================================================
-- Suasana tampilan per akun — palet warna & ukuran teks pilihan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah (ketiga tabel akun yang bisa login):
--   • users.suasana_terang / suasana_gelap / ukuran_teks      → BARU (pengurus)
--   • teachers.suasana_terang / suasana_gelap / ukuran_teks   → BARU (guru)
--   • employees.suasana_terang / suasana_gelap / ukuran_teks  → BARU (karyawan)
--
-- Semuanya nullable: NULL = bawaan (Teduh · Tilawah Malam · Biasa).
--
--   suasana_terang ∈ teduh | fajar | samudra | zaitun | mushaf | kontras
--   suasana_gelap  ∈ malam | senja | terang   (terang = tidak ikut mode gelap)
--   ukuran_teks    ∈ kecil | biasa | besar
--
-- Aplikasi sudah berjalan sebelum file ini dijalankan: pilihan di halaman
-- Tampilan tetap terpakai lewat cookie `rq-suasana` di perangkat itu, hanya
-- belum ikut ke perangkat lain. Setelah migrasi, pilihan disimpan di akun dan
-- dipasang ulang setiap kali login.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'teachers', 'employees'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS suasana_terang text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS suasana_gelap text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS ukuran_teks text', t);

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_suasana_terang_check') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (suasana_terang IS NULL OR suasana_terang IN (''teduh'', ''fajar'', ''samudra'', ''zaitun'', ''mushaf'', ''kontras''))',
        t, t || '_suasana_terang_check');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_suasana_gelap_check') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (suasana_gelap IS NULL OR suasana_gelap IN (''malam'', ''senja'', ''terang''))',
        t, t || '_suasana_gelap_check');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_ukuran_teks_check') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (ukuran_teks IS NULL OR ukuran_teks IN (''kecil'', ''biasa'', ''besar''))',
        t, t || '_ukuran_teks_check');
    END IF;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verifikasi (opsional):
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE column_name IN ('suasana_terang', 'suasana_gelap', 'ukuran_teks')
--  ORDER BY 1, 2;
