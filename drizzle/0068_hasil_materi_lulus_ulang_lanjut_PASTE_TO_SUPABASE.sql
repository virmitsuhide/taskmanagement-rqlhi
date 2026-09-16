-- ============================================================
-- Hasil setoran materi: lulus / mengulang / lanjut
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tipe baru materi_hasil ('ulang','lanjut','lulus')
--   • tahsin_log_materi.hafal (boolean) → tahsin_log_materi.hasil (enum)
--
-- ── KENAPA DUA NILAI TIDAK CUKUP ────────────────────────────
--
-- Kolom `hafal` hanya bisa mengatakan sudah atau belum, dan "belum" di situ
-- memuat dua keadaan yang sama sekali berbeda nasibnya:
--
--   • MENGULANG — materinya sudah dicoba utuh tapi belum lancar. Pertemuan
--     berikutnya mengulang materi yang sama dari awal.
--   • LANJUT    — materinya belum selesai dibahas. Pertemuan berikutnya
--     MENERUSKAN, bukan mengulang.
--
-- Menyamakan keduanya membuat seorang anak yang berjalan normal melewati
-- materi panjang terbaca seperti anak yang tersendat. Bagi koordinator yang
-- mencari anak bermasalah, itu persis sinyal yang salah.
--
-- ── KENAPA ENUM, BUKAN DUA BOOLEAN ─────────────────────────
--
-- Ketiganya saling meniadakan: satu materi pada satu setoran tidak bisa
-- sekaligus lulus dan mengulang. Dua boolean membolehkan kombinasi yang tidak
-- punya arti, dan setiap pembacaan harus memutuskan sendiri apa artinya
-- true/true.
--
-- ── PEMINDAHAN DATA ────────────────────────────────────────
--
-- hafal = true  → 'lulus'
-- hafal = false → 'ulang'  (satu-satunya arti yang mungkin dulu; 'lanjut'
--                           belum pernah bisa dinyatakan siapa pun)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE materi_hasil AS ENUM ('ulang','lanjut','lulus');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE materi_hasil IS
  'Hasil satu materi pada satu setoran. ulang = sudah utuh tapi belum lancar;
   lanjut = materinya belum selesai, pertemuan berikutnya meneruskan;
   lulus = materi tuntas. Hanya lulus yang menambah progres.';

-- Kolom baru diisi dari kolom lama, lalu yang lama dibuang. Dilakukan dalam
-- tiga langkah terpisah supaya aman dijalankan ulang di basis data yang sudah
-- setengah jalan.
ALTER TABLE "tahsin_log_materi"
  ADD COLUMN IF NOT EXISTS "hasil" materi_hasil;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tahsin_log_materi' AND column_name = 'hafal'
  ) THEN
    UPDATE "tahsin_log_materi"
       SET "hasil" = CASE WHEN "hafal" THEN 'lulus'::materi_hasil ELSE 'ulang'::materi_hasil END
     WHERE "hasil" IS NULL;
  END IF;
END $$;

-- Baris tanpa asal-usul (mustahil lewat aplikasi, tapi mungkin lewat SQL
-- manual) dianggap lulus: itulah satu-satunya nilai yang dulu bisa ditulis
-- tanpa menyebut kolomnya, karena default `hafal` adalah true.
UPDATE "tahsin_log_materi" SET "hasil" = 'lulus' WHERE "hasil" IS NULL;

ALTER TABLE "tahsin_log_materi" ALTER COLUMN "hasil" SET NOT NULL;
ALTER TABLE "tahsin_log_materi" ALTER COLUMN "hasil" SET DEFAULT 'lulus';
ALTER TABLE "tahsin_log_materi" DROP COLUMN IF EXISTS "hafal";

-- Indeks progres mengikuti kolom yang baru: yang ditanyakan setiap kali
-- formulir dibuka adalah "materi mana yang sudah LULUS", bukan yang pernah
-- disentuh.
DROP INDEX IF EXISTS tahsin_log_materi_hafal_idx;
CREATE INDEX IF NOT EXISTS tahsin_log_materi_lulus_idx
  ON tahsin_log_materi (student_id, materi_id) WHERE hasil = 'lulus';
-- Urutan waktu dipakai untuk menentukan keadaan TERAKHIR sebuah materi
-- (mengulang atau lanjut), jadi ia perlu bisa diurutkan per anak.
CREATE INDEX IF NOT EXISTS tahsin_log_materi_terakhir_idx
  ON tahsin_log_materi (student_id, materi_id, created_at DESC);

-- Verifikasi (opsional):
-- SELECT hasil, count(*) FROM tahsin_log_materi GROUP BY hasil;
