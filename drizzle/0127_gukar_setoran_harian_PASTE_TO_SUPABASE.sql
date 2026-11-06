-- ============================================================
-- Pembinaan Gukar — catatan setoran per TANGGAL
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- gukar_monthly hanya menyimpan SATU baris per peserta per bulan: posisi
-- awal, posisi sedang (ditimpa tiap setoran), tanggal pertama & terakhir,
-- dan jumlah hari setor. Isi setoran di hari-hari di antaranya hilang
-- tertimpa, sehingga Progres per Sesi tab Gukar tidak bisa ditampilkan
-- sebagai kisi tanggal seperti setoran siswa.
--
-- ── PERBAIKANNYA ────────────────────────────────────────────
--
--   • Tabel gukar_setoran: satu baris per peserta per tanggal, berisi
--     posisi tahsin/tahfidz hari itu. Ditulis setorSesiGukarAction (setor
--     per sesi) dan saveGukarMonthlyAction (ralat posisi tanggal terakhir).
--   • gukar_monthly TETAP sumber rekap bulanan & analitik SDM — tabel ini
--     hanya riwayat harian untuk layar.
--   • Isian awal: bulan-bulan yang sudah berjalan hanya punya dua tanggal
--     yang diketahui — awal_tanggal (posisi awal_*) dan setoran_terakhir
--     (posisi sedang). Hari-hari di antaranya tidak bisa dipulihkan.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "gukar_setoran" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "participant_id" uuid NOT NULL REFERENCES "gukar_participants"("id") ON DELETE CASCADE,
  "tanggal"        date NOT NULL,
  "jilid_id"       uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  "halaman"        smallint,
  "tahsin_surat"   smallint,
  "tahsin_ayat"    smallint,
  "tahfidz_surat"  smallint,
  "tahfidz_ayat"   smallint,
  "recorded_by"    uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("participant_id", "tanggal")
);
CREATE INDEX IF NOT EXISTS "gukar_setoran_tanggal_idx" ON "gukar_setoran" ("tanggal");

-- Isian awal 1: posisi awal bulan pada awal_tanggal.
INSERT INTO "gukar_setoran"
  ("participant_id", "tanggal", "jilid_id", "halaman", "tahsin_surat", "tahsin_ayat", "tahfidz_surat", "tahfidz_ayat", "recorded_by")
SELECT "participant_id", "awal_tanggal", "awal_jilid_id", "awal_halaman", "awal_tahsin_surat", "awal_tahsin_ayat",
       "awal_tahfidz_surat", "awal_tahfidz_ayat", "recorded_by"
FROM "gukar_monthly"
WHERE "awal_tanggal" IS NOT NULL
  AND ("awal_jilid_id" IS NOT NULL OR "awal_tahfidz_surat" IS NOT NULL)
ON CONFLICT ("participant_id", "tanggal") DO NOTHING;

-- Isian awal 2: posisi sedang/akhir pada setoran_terakhir. Bila tanggalnya
-- sama dengan awal_tanggal, posisi sedang yang menang (ia ralat terbaru).
INSERT INTO "gukar_setoran"
  ("participant_id", "tanggal", "jilid_id", "halaman", "tahsin_surat", "tahsin_ayat", "tahfidz_surat", "tahfidz_ayat", "recorded_by")
SELECT "participant_id", "setoran_terakhir", "jilid_id", "halaman", "tahsin_surat", "tahsin_ayat",
       "tahfidz_surat", "tahfidz_ayat", "recorded_by"
FROM "gukar_monthly"
WHERE "setoran_terakhir" IS NOT NULL
  AND ("jilid_id" IS NOT NULL OR "tahfidz_surat" IS NOT NULL)
ON CONFLICT ("participant_id", "tanggal") DO UPDATE SET
  "jilid_id"      = EXCLUDED."jilid_id",
  "halaman"       = EXCLUDED."halaman",
  "tahsin_surat"  = EXCLUDED."tahsin_surat",
  "tahsin_ayat"   = EXCLUDED."tahsin_ayat",
  "tahfidz_surat" = EXCLUDED."tahfidz_surat",
  "tahfidz_ayat"  = EXCLUDED."tahfidz_ayat";

ALTER TABLE "gukar_setoran" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verifikasi (opsional):
-- SELECT date_trunc('month', tanggal) AS bulan, count(*) FROM gukar_setoran GROUP BY 1 ORDER BY 1;
