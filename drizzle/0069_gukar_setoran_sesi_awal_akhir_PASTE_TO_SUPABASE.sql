-- ============================================================
-- Pembinaan Gukar — setor per sesi, setoran awal/sedang/akhir bulan,
-- dan kehadiran bulanan sebagai rekap angka
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • gukar_monthly : + awal_* (posisi setoran pertama bulan itu)
--                     + awal_tanggal, setoran_terakhir, jumlah_setoran
--                     + dikunci_at (setoran akhir dikunci lebih awal)
--                     + jumlah_hadir, jumlah_siklus (rekap kehadiran bulanan)
--
-- ── AWAL, SEDANG, AKHIR ─────────────────────────────────────
--
-- Satu baris per peserta per bulan tetap dipertahankan. Yang ditambahkan
-- adalah SALINAN posisi setoran pertama bulan itu (awal_*). Kolom posisi yang
-- sudah ada (jilid_id, halaman, tahsin_*, tahfidz_*) kini berarti "setoran
-- sedang" — ditimpa tiap setoran berikutnya — dan otomatis menjadi "setoran
-- akhir" begitu bulannya terkunci. Tidak perlu kolom akhir tersendiri: akhir
-- adalah sedang yang sudah tidak boleh berubah lagi.
--
-- Terkunci berarti salah satu dari:
--   • dikunci_at terisi — pengampu menekan "Kunci setoran akhir", atau
--   • tanggal hari ini (WIB) sudah melewati tanggal terakhir bulan itu.
-- Yang kedua dihitung aplikasi, bukan disimpan: kunci yang ditulis oleh
-- penjadwal bisa terlambat atau terlewat, sedangkan kalender tidak.
--
-- ── KEHADIRAN: DARI LIMA CENTANG KE SATU ANGKA ──────────────
--
-- Pembinaan berjalan dalam siklus Senin–Jumat, dan tiap peserta menyetor di
-- hari yang berbeda-beda. Karena itu kehadiran tidak lagi dicentang per
-- pekan, melainkan direkap pengampu di akhir bulan dari catatan manualnya:
-- hadir sekian dari sekian siklus.
--
-- jumlah_hadir NULL = belum direkap (bukan nol kehadiran). Rekap SDM hanya
-- menghitung baris yang sudah direkap — sama seperti sebelumnya bulan kosong
-- tidak dihitung sebagai absen.
--
-- hadir_1..hadir_5 TIDAK dihapus: rekap 2026 yang sudah masuk memakainya, dan
-- langkah 3 di bawah menyalin jumlahnya ke kolom baru.
-- ============================================================

-- 1) Posisi setoran awal bulan + penanda waktu
ALTER TABLE "gukar_monthly"
  ADD COLUMN IF NOT EXISTS "awal_jilid_id"      uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "awal_halaman"       smallint,
  ADD COLUMN IF NOT EXISTS "awal_tahsin_surat"  smallint,
  ADD COLUMN IF NOT EXISTS "awal_tahsin_ayat"   smallint,
  ADD COLUMN IF NOT EXISTS "awal_tahfidz_surat" smallint,
  ADD COLUMN IF NOT EXISTS "awal_tahfidz_ayat"  smallint,
  -- Tanggal setoran pertama bulan itu. NULL = belum pernah setor bulan ini.
  ADD COLUMN IF NOT EXISTS "awal_tanggal"       date,
  -- Tanggal setoran paling baru — posisi "sedang" berasal dari tanggal ini.
  ADD COLUMN IF NOT EXISTS "setoran_terakhir"   date,
  -- Banyak hari setor yang berbeda bulan itu.
  ADD COLUMN IF NOT EXISTS "jumlah_setoran"     smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dikunci_at"         timestamptz;

-- 2) Rekap kehadiran bulanan
ALTER TABLE "gukar_monthly"
  ADD COLUMN IF NOT EXISTS "jumlah_hadir"  smallint,
  ADD COLUMN IF NOT EXISTS "jumlah_siklus" smallint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gukar_monthly_kehadiran_ck') THEN
    ALTER TABLE "gukar_monthly" ADD CONSTRAINT "gukar_monthly_kehadiran_ck" CHECK (
      ("jumlah_siklus" IS NULL OR "jumlah_siklus" BETWEEN 1 AND 6) AND
      ("jumlah_hadir"  IS NULL OR ("jumlah_hadir" >= 0 AND "jumlah_siklus" IS NOT NULL
                                   AND "jumlah_hadir" <= "jumlah_siklus"))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gukar_monthly_awal_ck') THEN
    ALTER TABLE "gukar_monthly" ADD CONSTRAINT "gukar_monthly_awal_ck" CHECK (
      ("awal_tahsin_surat"  IS NULL OR "awal_tahsin_surat"  BETWEEN 1 AND 114) AND
      ("awal_tahfidz_surat" IS NULL OR "awal_tahfidz_surat" BETWEEN 1 AND 114) AND
      ("awal_halaman"       IS NULL OR "awal_halaman"       >= 1) AND
      ("awal_tanggal" IS NULL OR "setoran_terakhir" IS NULL OR "awal_tanggal" <= "setoran_terakhir")
    );
  END IF;
END $$;

-- 3) Salin kehadiran lama ke bentuk angka.
--    Baris lama dihitung terhadap 5 pekan — persis rumus rekap sebelum
--    migrasi ini — supaya persentase yang sudah dilaporkan tidak bergeser.
--    Dibatasi baris yang terakhir disentuh SEBELUM fitur ini ada: menjalankan
--    ulang file ini kelak tidak boleh mengubah baris baru yang memang sengaja
--    belum direkap menjadi "0 dari 5".
UPDATE "gukar_monthly"
   SET "jumlah_hadir"  = ("hadir_1"::int + "hadir_2"::int + "hadir_3"::int + "hadir_4"::int + "hadir_5"::int),
       "jumlah_siklus" = 5
 WHERE "jumlah_hadir" IS NULL
   AND "awal_tanggal" IS NULL
   AND "updated_at" < '2026-09-17 00:00:00+07';

-- Verifikasi (opsional):
-- SELECT period, COUNT(*) AS baris, SUM(jumlah_hadir) AS hadir, SUM(jumlah_siklus) AS siklus
--   FROM gukar_monthly GROUP BY period ORDER BY period;
