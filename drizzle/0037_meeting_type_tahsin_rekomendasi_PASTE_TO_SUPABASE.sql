-- ============================================================
-- Jenis rapat baru — Rapat Tahsin Rekomendasi
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum meeting_type : + tahsin_rekomendasi
--
-- Pemetaan izin ada di lib/auth/permissions.ts:
--   • tahsin_rekomendasi → dibuat/disunting/dihapus koor SD
--                          dilihat manajemen (kepala, kumik, SDM, bendahara)
--                          + koor SD
--   • Koor SMP sengaja di luar — rekomendasi tahsin ini menyangkut siswa SD.
--
-- ⚠️ Jalankan SQL ini SEBELUM men-deploy kodenya. Kode sudah menawarkan jenis
--    rapat ini di formulir; tanpa nilai enum-nya, penyimpanan akan ditolak
--    dengan 'invalid input value for enum meeting_type'.
--
-- ⚠️ Nilai enum tidak bisa dihapus di Postgres. Kalau perlu rollback,
--    harus membuat type baru.
-- ============================================================

ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'tahsin_rekomendasi';

-- Verifikasi (opsional) — harus mengembalikan 11 baris:
-- SELECT unnest(enum_range(NULL::meeting_type));
