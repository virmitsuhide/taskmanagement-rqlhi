-- ============================================================
-- Jenis rapat baru — Koor x SD / SMP / Boarding, dan RQ x QULS
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum meeting_type : + koor_x_sd, koor_x_smp, koor_x_boarding, rq_x_quls
--
-- Pemetaan izin ada di lib/auth/permissions.ts:
--   • koor_x_sd       → dibuat koor SD    (lihat: kepala, kumik, sdm, bendahara, koor SD)
--   • koor_x_smp      → dibuat koor SMP   (lihat: kepala, kumik, sdm, bendahara, koor SMP)
--   • koor_x_boarding → dibuat koor SMP   (lihat: kepala, kumik, sdm, bendahara, koor SMP)
--   • rq_x_quls       → dibuat kumik      (lihat: kumik, kepala, sdm, bendahara SAJA)
--
-- ⚠️ Catatan Postgres: ALTER TYPE ... ADD VALUE tidak bisa dijalankan di dalam
--    blok transaksi pada Postgres < 12. Supabase memakai PG 15+, jadi aman.
--    Nilai enum tidak bisa dihapus — kalau perlu rollback, buat type baru.
-- ============================================================

ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_x_sd';
ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_x_smp';
ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'koor_x_boarding';
ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'rq_x_quls';

-- Verifikasi (opsional) — harus mengembalikan 9 baris:
-- SELECT unnest(enum_range(NULL::meeting_type));
