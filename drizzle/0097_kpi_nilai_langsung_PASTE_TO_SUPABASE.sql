-- ============================================================
-- KPI: nilai langsung per indikator (isi cepat satu tabel per unit)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • kpi_monthly → 5 kolom BARU, nilai akhir 0–100 yang diketik langsung
--
-- SDM boleh mengisi nilai akhir tiap indikator di satu tabel per unit,
-- tanpa membuka formulir rinci tiap guru. Terisi = nilai itu yang dipakai;
-- NULL = dihitung dari rincian seperti biasa. Tiga indikator harian
-- (seragam, lapor ortu, halaqoh) sudah punya padanannya: *_total (0034).
-- Bacaan sudah berupa nilai (bacaan_score). Hafalan Al-Qur'an & Tuhfatul
-- Athfal tetap dari Setoran Guru (0096).
-- ============================================================

ALTER TABLE "kpi_monthly"
  ADD COLUMN IF NOT EXISTS "nilai_hadir"         numeric CHECK ("nilai_hadir" BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS "nilai_database"      numeric CHECK ("nilai_database" BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS "nilai_buku_pegangan" numeric CHECK ("nilai_buku_pegangan" BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS "nilai_perizinan"     numeric CHECK ("nilai_perizinan" BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS "nilai_pengganti"     numeric CHECK ("nilai_pengganti" BETWEEN 0 AND 100);

-- Verifikasi (opsional):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'kpi_monthly' AND column_name LIKE 'nilai_%';
