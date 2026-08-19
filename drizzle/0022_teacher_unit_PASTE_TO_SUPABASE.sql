-- ============================================================
-- Unit penempatan guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • teachers + kolom unit (jenjang)
--
-- KENAPA PERLU KOLOM SENDIRI
--
-- Sampai sekarang unit seorang guru hanya bisa disimpulkan dari halaqoh yang
-- diampunya — itulah cara /ustadz membatasi pandangan Koor SD & Koor SMP.
-- Cara itu runtuh tiap awal tahun ajaran: guru OS yang baru direkrut sudah
-- punya unit penempatan tapi belum dapat halaqoh, sehingga ia tidak terlihat
-- sama sekali oleh koordinator yang seharusnya membaginya ke halaqoh.
--
-- Data MPP RQ LHI TA 2026/2027 memang sudah mencantumkan unit tiap guru
-- (SDIT LHI / SMPIT LHI / SD LHI Juara), jadi ia disimpan apa adanya dan
-- dipakai sebagai penentu utama; halaqoh tetap jadi pelengkap bagi guru yang
-- mengampu lintas unit.
-- ============================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS unit jenjang;

COMMENT ON COLUMN teachers.unit IS
  'Unit penempatan: sd = SDIT LHI, smp = SMPIT LHI, sd_juara = SD LHI Juara. Kosong untuk pengurus yang tidak terikat satu unit.';

CREATE INDEX IF NOT EXISTS teachers_unit_idx
  ON teachers (unit)
  WHERE deleted_at IS NULL;

-- Verifikasi (opsional):
-- SELECT unit, COUNT(*) FROM teachers WHERE deleted_at IS NULL GROUP BY unit;
