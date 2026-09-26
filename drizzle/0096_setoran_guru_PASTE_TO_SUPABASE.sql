-- ============================================================
-- Setoran guru Qur'an (tahfidz & Tuhfatul Athfal) → isian KPI
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • setoran_guru → BARU, satu baris per setoran guru yang disimak SDM
--
-- SDM menyimak setoran guru per unit. Setoran TERAKHIR tiap jenis dalam
-- satu bulan menjadi posisi hafalan guru bulan itu:
--   • tahfidz  → hafalan_juz + hafalan_pages di kpi_monthly
--                (juz_selesai + halaman utuh di juz tempat ayat_ke berada)
--   • tuhfatul → tuhfatul_bait di kpi_monthly (= bait_ke)
-- Rumus rubrik KPI tidak berubah. `nilai` (bintang kualitas, 0–100) hanya
-- catatan mutu — tidak masuk hitungan KPI. Adab tidak dinilai.
-- ============================================================

CREATE TABLE IF NOT EXISTS "setoran_guru" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teacher_id"   uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "tanggal"      date NOT NULL,
  "jenis"        text NOT NULL CHECK ("jenis" IN ('tahfidz', 'tuhfatul')),
  -- Tahfidz: rentang ayat yang disetor + jumlah juz yang SUDAH selesai
  -- sebelum juz tempat ayat_ke berada.
  "surat_id"     integer REFERENCES "surat_master"("id"),
  "ayat_dari"    smallint,
  "ayat_ke"      smallint,
  "juz_selesai"  smallint CHECK ("juz_selesai" BETWEEN 0 AND 30),
  -- Tuhfatul Athfal: rentang bait (1–61).
  "bait_dari"    smallint CHECK ("bait_dari" BETWEEN 1 AND 61),
  "bait_ke"      smallint CHECK ("bait_ke" BETWEEN 1 AND 61),
  -- Kualitas dari bintang (50 + 10 × bintang), hanya catatan.
  "nilai"        smallint CHECK ("nilai" BETWEEN 0 AND 100),
  "catatan"      text NOT NULL DEFAULT '',
  "dicatat_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "setoran_guru_isi_cek" CHECK (
    ("jenis" = 'tahfidz' AND "surat_id" IS NOT NULL AND "ayat_ke" IS NOT NULL AND "juz_selesai" IS NOT NULL)
    OR ("jenis" = 'tuhfatul' AND "bait_ke" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "setoran_guru_guru_tanggal_idx" ON "setoran_guru" ("teacher_id", "tanggal");

ALTER TABLE "setoran_guru" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT count(*) FROM setoran_guru;
