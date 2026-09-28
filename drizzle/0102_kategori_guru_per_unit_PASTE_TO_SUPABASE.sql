-- ============================================================
-- Kategori guru: "Guru Unit Lain" dipecah per unit
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang — kalau enum sudah baru, dilewati).
--
-- Yang berubah:
--   • enum kategori_guru : - guru_unit_lain
--                          + guru_tpait, guru_sd_juara, guru_sma
--   • teachers.kategori_guru : guru_unit_lain dipindah menurut `unit`
--       paud → guru_tpait · sd_juara → guru_sd_juara · sma → guru_sma
--       unit lain / kosong → NULL (muncul di tab "Belum ditentukan")
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Tiap unit kini punya koordinatornya sendiri (0099), jadi guru Qur'an tiap
-- unit perlu rombongan sendiri di menu Ustadz/Guru — "Guru Unit Lain" yang
-- mencampur TPAIT, SD Juara, dan SMA tidak lagi cukup.
--
-- Postgres tidak bisa menghapus satu nilai enum, jadi type-nya dibuat ulang:
-- kolom dijadikan text sebentar, nilainya dipindah, lalu dikembalikan ke
-- enum baru. Satu transaksi — gagal di tengah berarti tidak ada yang berubah.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'kategori_guru' AND e.enumlabel = 'guru_unit_lain'
  ) THEN
    RAISE NOTICE 'kategori_guru sudah per unit — dilewati.';
    RETURN;
  END IF;

  ALTER TABLE teachers ALTER COLUMN kategori_guru TYPE text;

  UPDATE teachers
     SET kategori_guru = CASE unit::text
       WHEN 'paud'     THEN 'guru_tpait'
       WHEN 'sd_juara' THEN 'guru_sd_juara'
       WHEN 'sma'      THEN 'guru_sma'
       ELSE NULL
     END
   WHERE kategori_guru = 'guru_unit_lain';

  DROP TYPE kategori_guru;
  CREATE TYPE kategori_guru AS ENUM (
    'guru_rq', 'guru_quls_sd', 'musyrif_smp', 'guru_tpait', 'guru_sd_juara', 'guru_sma'
  );

  ALTER TABLE teachers
    ALTER COLUMN kategori_guru TYPE kategori_guru USING kategori_guru::kategori_guru;
END $$;

-- Khanifah Inabah → Guru TPAIT (permintaan langsung; unitnya memang paud).
UPDATE teachers SET kategori_guru = 'guru_tpait'
 WHERE id = '1b0bc950-ae4d-4059-b136-a07e4885d3b4';

-- Verifikasi (opsional):
-- SELECT kategori_guru, count(*) FROM teachers WHERE deleted_at IS NULL GROUP BY 1;
