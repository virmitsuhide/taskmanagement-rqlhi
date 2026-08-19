-- ============================================================
-- Rubrik nilai setoran + capaian awal/akhir bulan per siswa
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tahsin_logs  + nilai_tahsin, nilai_sikap
--   • tahfidz_logs + nilai_tahfidz, nilai_sikap
--   • students     + level_awal
--   • tabel baru   : student_monthly
--
-- ── KENAPA RUBRIKNYA DIGANTI ────────────────────────────────
--
-- Modul setoran selama ini merekam tiga aspek: fashohah, tajwid, kelancaran.
-- Database Quran SD 2026/2027 menunjukkan guru sebenarnya menilai dua hal
-- tiap tatap muka: NILAI TAHSIN (atau tahfidz) dan NILAI SIKAP — kolom sikap
-- bahkan tidak punya padanan sama sekali di skema lama.
--
-- Selama rubriknya tidak sama, guru akan tetap memakai spreadsheet karena
-- aplikasi tidak bisa menampung cara mereka menilai. Jadi yang menyesuaikan
-- adalah aplikasinya.
--
-- Kolom lama SENGAJA TIDAK DI-DROP. Ia sudah nullable, tidak dipakai lagi
-- oleh formulir baru, dan membiarkannya membuat migrasi ini bisa diulang
-- maupun dibatalkan tanpa kehilangan apa pun. Saat dijalankan, kedua tabel
-- log memang kosong — seluruh data dummy sudah dibersihkan lebih dulu.
--
-- ── KENAPA ADA TABEL CAPAIAN BULANAN ────────────────────────
--
-- Lembar "DB Y1–Y6" merekam per anak per bulan: level, halaman awal & akhir
-- tahsin, serta tahfidz awal & akhir. Itu bukan turunan dari setoran harian —
-- ia ditulis terpisah sebagai patokan kemajuan sebulan, dan dipakai menyusun
-- rapor serta rekap semester.
--
-- Menghitungnya dari tahsin_logs tidak bisa diandalkan: bulan yang setorannya
-- bolong akan kehilangan titik awalnya, sedangkan patokan bulanan tetap harus
-- ada. Karena itu disimpan tersendiri.
-- ============================================================

-- ── Rubrik baru pada setoran ────────────────────────────────
ALTER TABLE tahsin_logs  ADD COLUMN IF NOT EXISTS nilai_tahsin  numeric(5,2);
ALTER TABLE tahsin_logs  ADD COLUMN IF NOT EXISTS nilai_sikap   numeric(5,2);
ALTER TABLE tahfidz_logs ADD COLUMN IF NOT EXISTS nilai_tahfidz numeric(5,2);
ALTER TABLE tahfidz_logs ADD COLUMN IF NOT EXISTS nilai_sikap   numeric(5,2);

COMMENT ON COLUMN tahsin_logs.nilai_tahsin IS
  'Skala 0-100 mengikuti cara guru SD menilai. Menggantikan nilai_fashohah/tajwid/kelancaran yang berskala 0-9,9 dan tidak lagi diisi formulir.';

-- Nilai di luar 0–100 hampir pasti salah ketik — mis. 900 atau 9,0 dari
-- kebiasaan rubrik lama. Ditolak di database supaya tidak diam-diam merusak
-- rata-rata rapor.
DO $$ BEGIN
  ALTER TABLE tahsin_logs ADD CONSTRAINT tahsin_logs_nilai_wajar
    CHECK (
      (nilai_tahsin IS NULL OR (nilai_tahsin >= 0 AND nilai_tahsin <= 100)) AND
      (nilai_sikap  IS NULL OR (nilai_sikap  >= 0 AND nilai_sikap  <= 100))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tahfidz_logs ADD CONSTRAINT tahfidz_logs_nilai_wajar
    CHECK (
      (nilai_tahfidz IS NULL OR (nilai_tahfidz >= 0 AND nilai_tahfidz <= 100)) AND
      (nilai_sikap   IS NULL OR (nilai_sikap   >= 0 AND nilai_sikap   <= 100))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Level awal semester ─────────────────────────────────────
-- Titik berangkat anak pada semester berjalan, mis. 'Jilid 1 hal 1' atau
-- 'Qur'an T1'. Disimpan sebagai teks karena rekap SD memang menulisnya bebas
-- dan bercampur antara jilid, ghorib, dan Al-Qur'an.
ALTER TABLE students ADD COLUMN IF NOT EXISTS level_awal text NOT NULL DEFAULT '';

-- ── Capaian awal & akhir tiap bulan ─────────────────────────
CREATE TABLE IF NOT EXISTS student_monthly (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period               date NOT NULL,
  /** Level yang berlaku bulan itu: 'Jilid', 'Ghorib', 'Qur'an T1', … */
  level                text NOT NULL DEFAULT '',
  halaman_awal_tahsin  text NOT NULL DEFAULT '',
  halaman_akhir_tahsin text NOT NULL DEFAULT '',
  tahfidz_awal         text NOT NULL DEFAULT '',
  tahfidz_akhir        text NOT NULL DEFAULT '',
  /** Berapa halaman tahsin yang ditempuh bulan itu. */
  capaian_halaman      integer NOT NULL DEFAULT 0,
  catatan              text NOT NULL DEFAULT '',
  recorded_by          uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT student_monthly_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1),
  CONSTRAINT student_monthly_halaman_wajar CHECK (capaian_halaman >= 0),
  UNIQUE (student_id, period)
);

CREATE INDEX IF NOT EXISTS student_monthly_period_idx ON student_monthly (period);
CREATE INDEX IF NOT EXISTS student_monthly_student_idx ON student_monthly (student_id, period DESC);

-- Verifikasi (opsional):
-- SELECT COUNT(*) FROM student_monthly;
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'tahsin_logs' AND column_name LIKE 'nilai%';
