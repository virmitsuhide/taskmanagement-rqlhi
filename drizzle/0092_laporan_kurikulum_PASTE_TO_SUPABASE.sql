-- ============================================================
-- Laporan bulanan Kurikulum & Pembelajaran Al-Qur'an (Bab 02 BPH)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • laporan_kurikulum → BARU, satu baris per bulan laporan
--
-- ── ALUR ──────────────────────────────────────────────────────
--
-- Kumik menekan "Buat laporan <bulan>": aplikasi menghitung posisi tiap
-- siswa PER TANGGAL TERAKHIR BULAN ITU dan menyimpan seluruh angka Bab 02
-- di kolom `data`. Angka yang sudah dikirim ke BPH tidak boleh berubah
-- hanya karena guru mengoreksi setoran belakangan — karena itu disimpan,
-- bukan dihitung ulang setiap dibuka. "Hitung ulang" hanya boleh selama
-- status masih 'draf'.
--
-- Narasi (analisis, rekomendasi, kesimpulan) ditulis Kumik di kolom
-- `narasi`, diajukan, lalu disetujui Kepala RQ. Edisi yang disetujui
-- terkunci dan menjadi pembanding edisi berikutnya (+/− dari bulan lalu).
-- ============================================================

CREATE TABLE IF NOT EXISTS "laporan_kurikulum" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hari pertama bulan laporan, mis. 2026-09-01.
  "periode"        date NOT NULL UNIQUE,
  "status"         text NOT NULL DEFAULT 'draf'
                   CHECK ("status" IN ('draf','diajukan','disetujui')),
  -- Seluruh angka Bab 02 per tanggal akhir bulan (lib/data/laporan-kurikulum.ts).
  "data"           jsonb NOT NULL,
  -- Isian Kumik: sorotan, perhatian, analisis per sub-bab, masalah, kesimpulan.
  "narasi"         jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dihitung_at"    timestamptz NOT NULL DEFAULT now(),
  "dibuat_oleh"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "diajukan_at"    timestamptz,
  "disetujui_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "disetujui_at"   timestamptz,
  -- Catatan Kepala RQ saat mengembalikan atau menyetujui.
  "catatan_kepala" text NOT NULL DEFAULT '',
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "laporan_kurikulum_periode_awal_bulan" CHECK (EXTRACT(DAY FROM "periode") = 1)
);

-- Diakses hanya lewat server (service role), seperti tabel lain.
ALTER TABLE "laporan_kurikulum" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'laporan_kurikulum' ORDER BY ordinal_position;
