-- ============================================================
-- Halaqoh Asrama (Boarding SMPIT LHI) — kelompok, pengampu asrama, level
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Anak boarding punya DUA pengampu:
--   • pengampu sekolah — lewat halaqoh sekolahnya (students.halaqoh_id),
--     tidak berubah;
--   • pengampu asrama  — lewat kelompok asrama di file ini.
--
-- Keduanya mencatat ke progres yang SAMA (satu posisi jilid/hafalan per
-- anak, seperti Riyadhoh). Setoran dari asrama ditandai kolom `asrama`,
-- sehingga:
--   • bisa dibedakan di tabel progres & riwayat;
--   • aturan "satu setoran per anak per hari" berlaku per jalur — anak boleh
--     setor di sekolah pagi dan di asrama malam pada tanggal yang sama.
--
-- Yang berubah:
--   • tipe asrama_level ('high','middle','low','spesial')
--   • tabel asrama_kelompok — satu kelompok halaqoh asrama + pengampunya
--   • tabel asrama_anggota  — anak ↔ kelompok, beserta levelnya
--     (satu anak satu kelompok: student_id adalah kunci utama)
--   • tahsin_logs.asrama, tahfidz_logs.asrama — penanda jalur asrama
--
-- Pengelola: Div Qur'an BPA (putra) & BPI (putri), plus Kepala RQ & Kumik.
-- BPA hanya mengubah kelompok putra, BPI hanya putri; keduanya boleh melihat
-- semuanya. Aturan itu ditegakkan aplikasi (lib/auth/permissions.ts).
--
-- Aplikasi tetap berjalan sebelum file ini dijalankan: menu asrama kosong
-- dan lencana level tidak tampil.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asrama_level') THEN
    CREATE TYPE asrama_level AS ENUM ('high', 'middle', 'low', 'spesial');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "asrama_kelompok" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nama"        text NOT NULL,
  -- 'L' = asrama putra (BPA), 'P' = asrama putri (BPI).
  "gender"      text NOT NULL CHECK ("gender" IN ('L', 'P')),
  -- Kosong = belum ditetapkan; kelompok tetap ada, tapi belum ada yang bisa setor.
  "pengampu_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "urutan"      integer NOT NULL DEFAULT 0,
  "is_active"   boolean NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "asrama_kelompok_pengampu_idx" ON "asrama_kelompok" ("pengampu_id");

CREATE TABLE IF NOT EXISTS "asrama_anggota" (
  "student_id"  uuid PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
  "kelompok_id" uuid NOT NULL REFERENCES "asrama_kelompok"("id") ON DELETE CASCADE,
  -- Kosong = level belum ditetapkan.
  "level"       asrama_level,
  "diubah_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "asrama_anggota_kelompok_idx" ON "asrama_anggota" ("kelompok_id");

ALTER TABLE "asrama_kelompok" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asrama_anggota" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "tahsin_logs"  ADD COLUMN IF NOT EXISTS "asrama" boolean NOT NULL DEFAULT false;
ALTER TABLE "tahfidz_logs" ADD COLUMN IF NOT EXISTS "asrama" boolean NOT NULL DEFAULT false;

COMMIT;
