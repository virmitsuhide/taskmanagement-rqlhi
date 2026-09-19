-- ============================================================
-- Verifikasi riwayat ujian tahfidz oleh koordinator
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • verifikasi_riwayat_tahfidz → BARU, satu baris per (siswa, ujian) yang
--                                   sudah diperiksa koordinator
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- Sistem ini baru. Anak yang kini menyetor juz 2 sudah melewati 30, 29, 28,
-- 27, 26, dan 1 — lengkap dengan tasmi' 3 juz (28-30) dan 5 juz (26-30) —
-- tetapi tidak satu pun ujian itu tercatat. Halaman /ujian/verifikasi
-- menemukan anak-anak ini dari setorannya, dan koordinator memutuskan per
-- ujian: SUDAH dilaksanakan atau BELUM.
--
-- ── KENAPA PERLU TABEL SENDIRI ──────────────────────────────
--
-- • "Sudah" langsung menjadi baris ujian_tahfidz berstatus selesai (ujian_id),
--   supaya juz teruji, papan hafalan, dan rekap tasmi' ikut benar tanpa
--   jalur hitung baru.
-- • "Belum" TIDAK punya baris ujian — tapi keputusannya tetap harus diingat,
--   kalau tidak anak yang sama muncul lagi di antrean setiap hari.
-- • Membatalkan verifikasi "sudah" menghapus baris ujian yang dibuatnya, dan
--   hanya itu: ujian yang dicatat lewat jalur lain tidak ikut tersentuh.
-- ============================================================

CREATE TABLE IF NOT EXISTS "verifikasi_riwayat_tahfidz" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"      uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "tipe"            text NOT NULL CHECK ("tipe" IN ('1_juz', '3_juz', '5_juz')),
  -- '7' untuk juz'iyyah, '28-30' untuk tasmi' — sama dengan ujian_tahfidz.juz
  "juz"             text NOT NULL,
  "hasil"           text NOT NULL CHECK ("hasil" IN ('sudah', 'belum')),
  "ujian_id"        uuid REFERENCES "ujian_tahfidz"("id") ON DELETE SET NULL,
  "catatan"         text,
  "diverifikasi_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "diverifikasi_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "verifikasi_riwayat_tahfidz_unik" UNIQUE ("student_id", "tipe", "juz")
);

CREATE INDEX IF NOT EXISTS "verifikasi_riwayat_tahfidz_siswa_idx"
  ON "verifikasi_riwayat_tahfidz" ("student_id");

ALTER TABLE "verifikasi_riwayat_tahfidz" ENABLE ROW LEVEL SECURITY;
