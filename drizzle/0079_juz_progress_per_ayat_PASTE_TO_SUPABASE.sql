-- ============================================================
-- juz_progress menurut AYAT, bukan menurut awal surat
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • batas_juz                          → BARU, 30 baris batas juz mushaf
--   • juz_dari_ayat(surat, ayat)         → BARU, fungsi bantu
--   • upsert_juz_progress_from_tahfidz() → ditulis ulang (trigger tetap sama)
--   • juz_progress                       → dihitung ulang dari tahfidz_logs
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- Trigger lama (0006) memasukkan setiap ziyadah ke surat_master.juz_start —
-- juz tempat surat itu DIMULAI. Al-Baqarah dimulai di juz 1, jadi Al-Baqarah
-- 187–188 tercatat juz 1, padahal ayat itu ada di juz 2 (juz 2 = Al-Baqarah
-- 142–252). Akibatnya anak yang sudah menyetor juz 2 terbaca masih di juz 1:
-- verifikasi riwayat tidak menanyakan juz'iyyah juz 1, dan analitik hafalan
-- kurang satu juz. Hal yang sama menimpa surat lain yang membentang dua juz
-- (Az-Zariyat 31+ = juz 27, Ali Imran 92+ = juz 4, dst.).
--
-- ── PERBAIKANNYA ────────────────────────────────────────────
--
-- Setoran dibagi menurut batas juz mushaf: Al-Baqarah 140–145 menambah 2 ayat
-- ke juz 1 dan 4 ayat ke juz 2. Batasnya sama persis dengan lib/rq/batas-juz.ts
-- (tabel ini disalin dari sana; ubah keduanya bersamaan).
--
-- ── HITUNG ULANG ────────────────────────────────────────────
--
-- Saat migrasi ditulis, 35 dari 35 baris juz_progress persis sama dengan
-- jumlah setoran ziyadah menurut aturan lama — tidak ada data impor yang akan
-- hilang. ayat_hafal dihitung ulang dari tahfidz_logs; baris yang kini nol
-- dihapus, KECUALI yang bertanda mutqin (penanda itu dijaga apa adanya).
-- ============================================================

CREATE TABLE IF NOT EXISTS "batas_juz" (
  "juz"           smallint PRIMARY KEY,
  "mulai_surat"   smallint NOT NULL,
  "mulai_ayat"    smallint NOT NULL,
  "selesai_surat" smallint NOT NULL,
  "selesai_ayat"  smallint NOT NULL
);
ALTER TABLE "batas_juz" ENABLE ROW LEVEL SECURITY;

INSERT INTO "batas_juz" ("juz", "mulai_surat", "mulai_ayat", "selesai_surat", "selesai_ayat") VALUES
  (1, 1, 1, 2, 141),
  (2, 2, 142, 2, 252),
  (3, 2, 253, 3, 91),
  (4, 3, 92, 4, 23),
  (5, 4, 24, 4, 147),
  (6, 4, 148, 5, 81),
  (7, 5, 82, 6, 110),
  (8, 6, 111, 7, 87),
  (9, 7, 88, 8, 40),
  (10, 8, 41, 9, 92),
  (11, 9, 93, 11, 5),
  (12, 11, 6, 12, 52),
  (13, 12, 53, 14, 52),
  (14, 15, 1, 16, 128),
  (15, 17, 1, 18, 74),
  (16, 18, 75, 20, 135),
  (17, 21, 1, 22, 78),
  (18, 23, 1, 25, 20),
  (19, 25, 21, 27, 55),
  (20, 27, 56, 29, 45),
  (21, 29, 46, 33, 30),
  (22, 33, 31, 36, 27),
  (23, 36, 28, 39, 31),
  (24, 39, 32, 41, 46),
  (25, 41, 47, 45, 37),
  (26, 46, 1, 51, 30),
  (27, 51, 31, 57, 29),
  (28, 58, 1, 66, 12),
  (29, 67, 1, 77, 50),
  (30, 78, 1, 114, 6)
ON CONFLICT ("juz") DO UPDATE SET
  "mulai_surat" = EXCLUDED."mulai_surat", "mulai_ayat" = EXCLUDED."mulai_ayat",
  "selesai_surat" = EXCLUDED."selesai_surat", "selesai_ayat" = EXCLUDED."selesai_ayat";

-- Juz yang memuat satu ayat. Perbandingan baris (surat, ayat) = urutan mushaf.
CREATE OR REPLACE FUNCTION juz_dari_ayat(p_surat int, p_ayat int)
RETURNS int AS $$
  SELECT juz FROM batas_juz
   WHERE (mulai_surat, mulai_ayat) <= (p_surat, p_ayat)
   ORDER BY juz DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Trigger: bagi setoran ke setiap juz yang disentuhnya.
CREATE OR REPLACE FUNCTION upsert_juz_progress_from_tahfidz()
RETURNS trigger AS $$
DECLARE
  r record;
BEGIN
  IF NEW.kind NOT IN ('ziyadah', 'hafalan_baru') OR NEW.ayat_dari IS NULL OR NEW.ayat_ke IS NULL THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT b.juz,
           GREATEST(NEW.ayat_dari, CASE WHEN b.mulai_surat = NEW.surat_id THEN b.mulai_ayat ELSE 1 END) AS dari,
           LEAST(NEW.ayat_ke, CASE WHEN b.selesai_surat = NEW.surat_id THEN b.selesai_ayat ELSE NEW.ayat_ke END) AS ke
      FROM batas_juz b
     WHERE (b.mulai_surat, b.mulai_ayat) <= (NEW.surat_id, NEW.ayat_ke)
       AND (b.selesai_surat, b.selesai_ayat) >= (NEW.surat_id, NEW.ayat_dari)
  LOOP
    IF r.ke >= r.dari THEN
      INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
      VALUES (NEW.student_id, r.juz, r.ke - r.dari + 1, now(), now())
      ON CONFLICT (student_id, juz_number)
      DO UPDATE SET
        ayat_hafal      = juz_progress.ayat_hafal + EXCLUDED.ayat_hafal,
        last_setoran_at = EXCLUDED.last_setoran_at,
        updated_at      = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hitung ulang juz_progress dari seluruh ziyadah yang ada — satu transaksi,
-- supaya tidak ada saat di mana baris lama sudah terhapus tapi yang baru belum masuk.
BEGIN;
DROP TABLE IF EXISTS _juz_benar;
CREATE TEMP TABLE _juz_benar AS
SELECT l.student_id, b.juz AS juz_number,
       SUM(
         LEAST(l.ayat_ke, CASE WHEN b.selesai_surat = l.surat_id THEN b.selesai_ayat ELSE l.ayat_ke END)
         - GREATEST(l.ayat_dari, CASE WHEN b.mulai_surat = l.surat_id THEN b.mulai_ayat ELSE 1 END) + 1
       )::int AS ayat_hafal,
       MAX(l.created_at) AS terakhir
  FROM tahfidz_logs l
  JOIN batas_juz b
    ON (b.mulai_surat, b.mulai_ayat) <= (l.surat_id, l.ayat_ke)
   AND (b.selesai_surat, b.selesai_ayat) >= (l.surat_id, l.ayat_dari)
 WHERE l.kind IN ('ziyadah', 'hafalan_baru')
   AND l.ayat_dari IS NOT NULL AND l.ayat_ke IS NOT NULL
 GROUP BY l.student_id, b.juz;

DELETE FROM juz_progress p
 WHERE NOT p.mutqin
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = p.student_id AND j.juz_number = p.juz_number);

UPDATE juz_progress SET ayat_hafal = 0, updated_at = now()
 WHERE mutqin
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = juz_progress.student_id AND j.juz_number = juz_progress.juz_number);

INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
SELECT student_id, juz_number, ayat_hafal, terakhir, now() FROM _juz_benar
ON CONFLICT (student_id, juz_number) DO UPDATE SET
  ayat_hafal      = EXCLUDED.ayat_hafal,
  last_setoran_at = EXCLUDED.last_setoran_at,
  updated_at      = now();

DROP TABLE _juz_benar;
COMMIT;

-- Verifikasi (opsional) — Mahira Hasna Kamila, Al-Baqarah 187–188:
--   SELECT juz_dari_ayat(2, 187);   -- 2
--   SELECT juz_dari_ayat(2, 141);   -- 1
--   SELECT juz_number, ayat_hafal FROM juz_progress
--    WHERE student_id = '5762abc4-e0f7-44e8-be2e-b969858813cf';   -- juz 2, 2 ayat
