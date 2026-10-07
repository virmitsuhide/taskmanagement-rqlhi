-- ============================================================
-- Kenaikan lintas unit LHI & status alumni
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • students          : keluar_status ('lulus' | 'alumni'), keluar_at
--   • kenaikan_riwayat  : tabel baru — satu baris per anak per kenaikan
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Sampai 0112, kelas teratas tiap unit (TKB, 6 SD, 6 SD Juara, 9 SMP,
-- 12 SMA) cukup dinonaktifkan saat kenaikan kelas. Padahal sebagian besar
-- anaknya LANJUT ke unit LHI berikutnya (TPAIT → SD LHI / SD LHI Juara →
-- SMPIT LHI → SMA LHI) dan riwayat tahsin-tahfidznya harus ikut, bukan
-- dibuat ulang sebagai siswa baru.
--
-- Kumik kini memilih per anak: lanjut ke unit mana dan kelas apa. Yang
-- tidak dicentang lulus & keluar (keluar_status = 'lulus'). Lulusan SMA LHI
-- yang dicentang menjadi ALUMNI (keluar_status = 'alumni'); yang tidak
-- dicentang tetap kelas 12.
--
-- keluar_status membedakan "nonaktif karena lulus" dari "nonaktif karena
-- dihapus/pindah" — keduanya sama-sama is_active = false.
--
-- kenaikan_riwayat menyimpan kelas & unit LAMA tiap anak. Kenaikan menimpa
-- students.kelas/jenjang, jadi tanpa tabel ini "dulu kelas berapa, di unit
-- mana" tidak bisa dijawab lagi — dan kenaikan yang keliru tidak bisa
-- dipulihkan dari data yang tersisa (lihat 0055).
-- ============================================================

BEGIN;

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "keluar_status" text,
  ADD COLUMN IF NOT EXISTS "keluar_at" date;

DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_keluar_status_check"
    CHECK ("keluar_status" IS NULL OR "keluar_status" IN ('lulus', 'alumni'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "kenaikan_riwayat" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "term_id"      uuid NOT NULL REFERENCES "academic_terms"("id") ON DELETE CASCADE,
  "student_id"   uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "dari_jenjang" text NOT NULL,
  "dari_kelas"   text,
  "ke_jenjang"   text,
  "ke_kelas"     text,
  -- naik       : naik satu tingkat di unit yang sama
  -- lanjut     : pindah ke unit LHI berikutnya
  -- lulus      : lulus unit, tidak lanjut di LHI (nonaktif)
  -- alumni     : lulus SMA LHI (nonaktif)
  -- tetap      : kelas 12 SMA yang tidak dicentang lulus
  "hasil"        text NOT NULL CHECK ("hasil" IN ('naik', 'lanjut', 'lulus', 'alumni', 'tetap')),
  "oleh"         uuid,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("term_id", "student_id")
);

CREATE INDEX IF NOT EXISTS "kenaikan_riwayat_student_idx" ON "kenaikan_riwayat" ("student_id");

ALTER TABLE "kenaikan_riwayat" ENABLE ROW LEVEL SECURITY;

COMMIT;
