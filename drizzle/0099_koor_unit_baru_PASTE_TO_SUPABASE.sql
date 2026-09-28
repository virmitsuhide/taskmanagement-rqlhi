-- ============================================================
-- Koordinator unit baru — TPAIT, SD Juara, SMA
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum user_role    : + koor_tpait, koor_sdjuara, koor_sma
--   • enum meeting_type : + koor_tpait, koor_sdjuara, koor_sma
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Tiga unit yang selama ini tidak punya koordinator sendiri (TPAIT LHI →
-- jenjang 'paud', SD LHI Juara → 'sd_juara', SMA LHI → 'sma') kini
-- dipegang koordinator masing-masing. Wewenangnya meniru koor SD, dibatasi
-- ke satu jenjang — semua itu lapisan aplikasi (lib/auth/permissions.ts).
-- Tiap koor juga mendapat jenis rapat internalnya sendiri, seperti
-- "Rapat Koor SD".
--
-- ⚠️ Nilai enum tidak bisa dihapus di Postgres. Kalau perlu rollback,
--    harus membuat type baru.
--
-- ⚠️ Akunnya TIDAK dibuat di sini (password harus di-hash bcrypt, dan nilai
--    enum baru tidak boleh dipakai di transaksi yang sama dengan
--    ALTER TYPE-nya). Setelah SQL ini jalan:
--        npm run seed:koor-unit
-- ============================================================

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'koor_tpait';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'koor_sdjuara';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'koor_sma';

ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_tpait';
ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_sdjuara';
ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_sma';

-- Verifikasi (opsional):
-- SELECT unnest(enum_range(NULL::user_role));     -- 17 baris
-- SELECT unnest(enum_range(NULL::meeting_type));  -- 15 baris
