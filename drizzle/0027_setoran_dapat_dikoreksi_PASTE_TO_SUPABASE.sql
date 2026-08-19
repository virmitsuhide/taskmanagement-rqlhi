-- ============================================================
-- Setoran bisa dikoreksi: tautkan kenaikan ke setoran asalnya
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • jilid_promotions + source_log_id → tahsin_logs  (ON DELETE CASCADE)
--   • juz_promotions   + source_log_id → tahfidz_logs (ON DELETE CASCADE)
--
-- ── MASALAH YANG DISELESAIKAN ───────────────────────────────
--
-- Menyimpan satu setoran tahsin melakukan empat hal sekaligus: menyisipkan
-- baris log, memindahkan posisi siswa, mencatat kenaikan jilid, lalu
-- memindahkan siswa ke jilid berikutnya. Setoran tahfidz serupa — ia menandai
-- juz sebagai mutqin dan mencatat kenaikan juz.
--
-- Sampai sekarang tidak ada cara menghapus atau menyunting setoran. Begitu
-- kemampuan itu ditambahkan, menghapus baris log saja TIDAK cukup: kenaikan
-- jilid yang ditimbulkannya akan tertinggal sebagai riwayat tanpa sebab, dan
-- anak tetap tercatat di jilid baru padahal setoran yang membawanya ke sana
-- sudah lenyap. Tidak ada satu layar pun yang akan menunjukkan kejanggalan itu.
--
-- Tabel promosi tidak punya tautan apa pun ke log penyebabnya, sehingga
-- pasangannya hanya bisa ditebak dari kesamaan tanggal dan jilid — tebakan
-- yang salah berarti menghapus kenaikan milik setoran lain.
--
-- Kolom ini membuat hubungannya tegas, dan ON DELETE CASCADE membuat
-- pembersihannya dikerjakan database, bukan diingat-ingat kode aplikasi.
--
-- Kedua tabel log sedang kosong saat migrasi ini dibuat, jadi tidak ada
-- riwayat lama yang perlu ditebak-tebak pasangannya.
-- ============================================================

ALTER TABLE jilid_promotions
  ADD COLUMN IF NOT EXISTS source_log_id uuid REFERENCES tahsin_logs(id) ON DELETE CASCADE;

ALTER TABLE juz_promotions
  ADD COLUMN IF NOT EXISTS source_log_id uuid REFERENCES tahfidz_logs(id) ON DELETE CASCADE;

COMMENT ON COLUMN jilid_promotions.source_log_id IS
  'Setoran yang menyebabkan kenaikan ini. Dihapusnya setoran ikut menghapus kenaikan lewat CASCADE. NULL untuk kenaikan yang dicatat manual.';

CREATE INDEX IF NOT EXISTS jilid_promotions_source_idx ON jilid_promotions (source_log_id);
CREATE INDEX IF NOT EXISTS juz_promotions_source_idx   ON juz_promotions (source_log_id);

-- Verifikasi (opsional):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name IN ('jilid_promotions','juz_promotions') AND column_name = 'source_log_id';
