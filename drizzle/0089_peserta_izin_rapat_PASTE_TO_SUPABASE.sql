-- ============================================================
-- Rapat: peserta yang izin
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • meetings.peserta_izin → BARU, nama peserta yang izin (tidak hadir)
--
-- `participants` tetap daftar yang HADIR — notulen lama tidak berubah makna.
-- Yang izin dicatat terpisah, satu nama per baris di formulir notulen, lalu
-- halaman rapat menampilkan keduanya dengan tanda hadir / izin.
--
-- Sebelum migrasi ini dijalankan, formulir tetap bisa disimpan selama kolom
-- "Peserta izin" dibiarkan kosong.

ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "peserta_izin" text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN "meetings"."peserta_izin" IS
  'Nama peserta yang izin/tidak hadir. participants = yang hadir.';
