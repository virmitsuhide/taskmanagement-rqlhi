-- ============================================================
-- Jenis rapat baru — Rapat Humas Yayasan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum meeting_type : + humas_yayasan
--
-- Pemetaan izin ada di lib/auth/permissions.ts:
--   • humas_yayasan → dibuat humas (lihat: humas, kepala, kumik, sdm, bendahara)
--
-- Perubahan izin lain di rilis yang sama (tidak butuh SQL, hanya kode):
--   • Humas ikut melihat notulen Rapat New Squad
--   • Papan divisi Humas kini mencakup kolom New Squad
--
-- ⚠️ Nilai enum tidak bisa dihapus di Postgres. Kalau perlu rollback,
--    harus membuat type baru.
-- ============================================================

ALTER TYPE "meeting_type" ADD VALUE IF NOT EXISTS 'humas_yayasan';

-- Verifikasi (opsional) — harus mengembalikan 10 baris:
-- SELECT unnest(enum_range(NULL::meeting_type));
