-- ============================================================
-- Progres Al-Qur'an pada setoran tahsin — halaman mushaf, surat, ayat
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • jilid_levels : + baca_quran
--   • students     : + current_quran_halaman, current_quran_surat_id,
--                    current_quran_ayat
--   • tahsin_logs  : + quran_halaman, quran_surat_id, quran_ayat_dari,
--                    quran_ayat_ke
--   • pemindahan data: posisi mushaf yang selama ini menumpang di kolom
--     halaman buku dipindahkan ke kolom quran_*
--
-- ── MASALAH YANG DIPERBAIKI ─────────────────────────────────
--
-- Satu anak bisa punya DUA progres berjalan sekaligus. Di UMMI, anak yang
-- sudah masuk buku Gharib atau Tajwid tidak berhenti membaca mushaf — ia
-- menjalani keduanya di periode yang sama. Sampai sekarang sistem hanya
-- punya satu pasang kolom posisi (current_jilid_id + current_jilid_page),
-- jadi salah satu dari dua progres itu selalu tidak tercatat, dan yang
-- hilang justru bacaan Al-Qur'annya.
--
-- Kolom quran_* memisahkan keduanya: halaman buku tetap di `halaman`,
-- bacaan mushaf di `quran_halaman` + surat + ayat. Satu kolom, satu arti,
-- di tahap mana pun anak berada.
--
-- ── KENAPA HALAMAN DAN SURAT/AYAT DISIMPAN DUA-DUANYA ───────
--
-- Keduanya memang saling menurunkan — lib/rq/batas-halaman.ts memetakan
-- 604 halaman Mushaf Madinah ke surat & ayat pembukanya, dua arah. Yang
-- disimpan tetap dua-duanya, sebab tabel itu hanya tahu ayat PERTAMA tiap
-- halaman: dari halaman saja, ayat berapa anak berhenti tidak bisa
-- dipulihkan. Halaman adalah tempatnya, ayat adalah sejauh mana — dan
-- rapor wali murid menyebut surat, bukan nomor halaman.
--
-- ⚠️ Nomor halaman mengikuti MUSHAF MADINAH (604 halaman). Lihat peringatan
--    di lib/rq/batas-halaman.ts: mushaf pojok Menara Kudus berbeda hampir
--    di setiap halaman.
--
-- ── KENAPA baca_quran BUKAN is_quran SAJA ───────────────────
--
-- is_quran menandai tahap yang ISINYA membaca mushaf (Al-Qur'an T1–T3,
-- Talaqqi). Gharib dan Tajwid isinya buku sendiri, jadi is_quran-nya false
-- — tapi anaknya tetap membaca mushaf. Menambah kolom kedua lebih jujur
-- daripada melonggarkan arti is_quran, yang sudah dipakai di tempat lain
-- untuk memutuskan apakah sebuah tahap punya halaman buku.
-- ============================================================

-- 1) Tahap mana yang ikut mencatat bacaan mushaf
ALTER TABLE "jilid_levels"
  ADD COLUMN IF NOT EXISTS "baca_quran" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "jilid_levels"."baca_quran" IS
  'Tahap ini ikut mencatat bacaan mushaf (halaman + surat + ayat). True untuk
   semua tahap is_quran, dan untuk Gharib & Tajwid UMMI yang bukunya dihafal
   sambil anak tetap membaca Al-Qur''an.';

-- Semua tahap membaca mushaf ikut serta …
UPDATE "jilid_levels" SET "baca_quran" = true
 WHERE "is_quran" IS TRUE AND "baca_quran" IS FALSE;

-- … dan Gharib + Tajwid UMMI, yang bukunya dihafal berdampingan dengan bacaan.
UPDATE "jilid_levels" l SET "baca_quran" = true
  FROM "tahsin_methods" m
 WHERE l."method_id" = m."id"
   AND m."name" = 'UMMI'
   AND l."label" IN ('Gharib', 'Tajwid')
   AND l."baca_quran" IS FALSE;

-- 2) Posisi mushaf anak — terpisah dari posisi halaman buku
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "current_quran_halaman"  integer,
  ADD COLUMN IF NOT EXISTS "current_quran_surat_id" integer REFERENCES "surat_master"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "current_quran_ayat"     integer;

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_current_quran_halaman_check";
ALTER TABLE "students" ADD CONSTRAINT "students_current_quran_halaman_check"
  CHECK ("current_quran_halaman" IS NULL OR "current_quran_halaman" BETWEEN 1 AND 604);

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_current_quran_ayat_check";
ALTER TABLE "students" ADD CONSTRAINT "students_current_quran_ayat_check"
  CHECK ("current_quran_ayat" IS NULL OR "current_quran_ayat" >= 1);

-- 3) Bacaan mushaf pada tiap setoran
ALTER TABLE "tahsin_logs"
  ADD COLUMN IF NOT EXISTS "quran_halaman"   integer,
  ADD COLUMN IF NOT EXISTS "quran_surat_id"  integer REFERENCES "surat_master"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "quran_ayat_dari" integer,
  ADD COLUMN IF NOT EXISTS "quran_ayat_ke"   integer;

ALTER TABLE "tahsin_logs" DROP CONSTRAINT IF EXISTS "tahsin_logs_quran_halaman_check";
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_quran_halaman_check"
  CHECK ("quran_halaman" IS NULL OR "quran_halaman" BETWEEN 1 AND 604);

-- Rentang ayat harus maju, dan ujungnya tidak boleh berdiri tanpa pangkal.
ALTER TABLE "tahsin_logs" DROP CONSTRAINT IF EXISTS "tahsin_logs_quran_ayat_check";
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_quran_ayat_check"
  CHECK (
    ("quran_ayat_dari" IS NULL OR "quran_ayat_dari" >= 1)
    AND ("quran_ayat_ke" IS NULL OR "quran_ayat_ke" >= 1)
    AND ("quran_ayat_ke" IS NULL OR "quran_ayat_dari" IS NOT NULL)
    AND ("quran_ayat_dari" IS NULL OR "quran_ayat_ke" IS NULL OR "quran_ayat_ke" >= "quran_ayat_dari")
  );

CREATE INDEX IF NOT EXISTS tahsin_logs_quran_idx
  ON tahsin_logs (student_id, setoran_date DESC) WHERE quran_halaman IS NOT NULL;

-- 4) Pindahkan posisi mushaf yang selama ini menumpang di kolom halaman buku
--
-- Tahap is_quran tidak punya total_pages, jadi `halaman` di sana tidak pernah
-- berarti halaman buku — guru mengisinya dengan nomor halaman mushaf dan
-- resolveStudentPosition menaikkannya satu demi satu. Angka itu milik
-- quran_halaman. Yang di luar 1–604 ditinggalkan di tempatnya: ia bukan
-- halaman mushaf yang sah, dan memindahkannya hanya memindahkan sampah ke
-- kolom yang baru bersih.
UPDATE "tahsin_logs" t
   SET "quran_halaman" = t."halaman", "halaman" = NULL
  FROM "jilid_levels" l
 WHERE t."jilid_id" = l."id"
   AND l."is_quran" IS TRUE
   AND t."halaman" BETWEEN 1 AND 604
   AND t."quran_halaman" IS NULL;

UPDATE "students" s
   SET "current_quran_halaman" = s."current_jilid_page", "current_jilid_page" = NULL
  FROM "jilid_levels" l
 WHERE s."current_jilid_id" = l."id"
   AND l."is_quran" IS TRUE
   AND s."current_jilid_page" BETWEEN 1 AND 604
   AND s."current_quran_halaman" IS NULL;

-- Verifikasi (opsional):
-- SELECT label, is_quran, baca_quran FROM jilid_levels ORDER BY method_id, order_num;
-- SELECT count(*) FILTER (WHERE quran_halaman IS NOT NULL) AS bacaan_mushaf,
--        count(*) FILTER (WHERE halaman IS NOT NULL)       AS halaman_buku
--   FROM tahsin_logs;
