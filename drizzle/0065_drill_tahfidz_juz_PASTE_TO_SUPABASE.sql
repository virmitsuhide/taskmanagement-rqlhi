-- ============================================================
-- Drill tahfidz per juz — lama anak menyiapkan ujian 1 juz
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru tahfidz_juz_drill
--
-- ── APA YANG DICATAT ────────────────────────────────────────
--
-- Satu baris = satu juz seorang anak yang ziyadahnya sudah tuntas dan kini
-- disiapkan untuk ujian (tasmi' 1 juz). Barisnya lahir saat setoran ziyadah
-- menutup ayat terakhir yang belum tersetor di juz itu, dan tertaut ke
-- pengajuan ujian 1 juz begitu diajukan.
--
--   lama persiapan = tanggal pengajuan ujian − selesai_ziyadah
--   sedang drill   = ujian_id masih kosong
--
-- ── KAPAN SEBUAH JUZ DIANGGAP TUNTAS ZIYADAH ───────────────
--
-- Dihitung dari CAKUPAN AYAT, bukan dari juz_progress.ayat_hafal. Kolom itu
-- menjumlah panjang setiap setoran, sehingga ayat yang disetor ulang terhitung
-- dua kali dan sebuah juz bisa "penuh" padahal masih bolong. Cakupan dihitung
-- di aplikasi (lib/rq/cakupan-juz.ts) memakai batas juz mushaf yang presisi,
-- jadi arah menghafal — dari An-Nas naik atau dari An-Naba turun — tidak
-- berpengaruh.
--
-- ── KENAPA ujian_id ON DELETE SET NULL ─────────────────────
--
-- Pengajuan yang ditarik guru membuat juz itu kembali "sedang drill", dan
-- lama persiapannya terus berjalan sampai ada pengajuan yang sesungguhnya.
-- ============================================================

CREATE TABLE IF NOT EXISTS "tahfidz_juz_drill" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"      uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "juz_number"      smallint NOT NULL CHECK ("juz_number" BETWEEN 1 AND 30),
  "selesai_ziyadah" date NOT NULL,
  "source_log_id"   uuid REFERENCES "tahfidz_logs"("id") ON DELETE SET NULL,
  "ujian_id"        uuid REFERENCES "ujian_tahfidz"("id") ON DELETE SET NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("student_id", "juz_number")
);

CREATE INDEX IF NOT EXISTS tahfidz_juz_drill_menunggu_idx
  ON tahfidz_juz_drill (student_id) WHERE ujian_id IS NULL;
CREATE INDEX IF NOT EXISTS tahfidz_juz_drill_ujian_idx
  ON tahfidz_juz_drill (ujian_id);

-- Seluruh akses lewat service-role di server, sama seperti tabel lain.
ALTER TABLE "tahfidz_juz_drill" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT count(*) FROM tahfidz_juz_drill;
