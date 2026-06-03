-- ============================================================
-- PHASE 7 — Tahsin & Tahfidz RQ LHI — STEP 1 dari 2 (ENUM)
-- ============================================================
-- 📋 CARA PAKAI:
--    1. Supabase Dashboard → SQL Editor → New query
--    2. Copy isi file ini, paste, Run — TUNGGU sampai sukses.
--    3. Baru jalankan STEP 2: 0006_tahsin_tahfidz_rqlhi_PASTE_TO_SUPABASE.sql
--
-- ⚠️ Wajib dipisah: nilai enum baru harus COMMIT dulu sebelum dipakai di
--    UPDATE backfill (STEP 2). Kalau digabung → error 55P04
--    "unsafe use of new value of enum type".
-- ============================================================

ALTER TYPE "jenjang"       ADD VALUE IF NOT EXISTS 'sd_juara';
ALTER TYPE "tahfidz_kind"  ADD VALUE IF NOT EXISTS 'ziyadah';
ALTER TYPE "tahfidz_kind"  ADD VALUE IF NOT EXISTS 'murojaah_baru';
ALTER TYPE "tahfidz_kind"  ADD VALUE IF NOT EXISTS 'murojaah_lama';
ALTER TYPE "tahfidz_kind"  ADD VALUE IF NOT EXISTS 'tasmi';

-- Verifikasi (harus memuat nilai-nilai baru):
--   SELECT unnest(enum_range(NULL::jenjang));
--   SELECT unnest(enum_range(NULL::tahfidz_kind));
