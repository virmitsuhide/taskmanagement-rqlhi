-- ============================================================
-- Batas juz 26/27 mengikuti mushaf RQ: juz 27 mulai Az-Zariyat 1
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- RQ LHI menetapkan juz 27 dimulai Az-Zariyat ayat 1 (lib/rq/halaman.ts,
-- AWAL_JUZ_MUSHAF) — anak menghafal Az-Zariyat utuh bersama juz 27, dan
-- target tahfidz sudah memakai batas itu. Tetapi batas_juz (0079) masih
-- memakai batas standar: juz 26 sampai Az-Zariyat 30, juz 27 mulai ayat 31.
--
-- Akibatnya anak SMP yang sudah lulus juz 30–28 lalu mulai juz 27 dari
-- Az-Zariyat 1 tercatat punya setoran di juz 26. Urutan hafalan RQ adalah
-- 30 → 29 → 28 → 27 → 26, sehingga beberapa ayat Az-Zariyat cukup untuk
-- menempatkannya di kolom "Juz 26" pada Capaian per Kelas, dan juz 27 ikut
-- terhitung tuntas (hafalan terbaca 4 juz, padahal 3).
--
-- ── PERBAIKANNYA ────────────────────────────────────────────
--
--   • batas_juz baris 26 & 27 → juz 26 = Al-Ahqaf 1 – Qaf 45,
--                               juz 27 = Az-Zariyat 1 – Al-Hadid 29.
--     Sama dengan lib/rq/batas-juz.ts (ubah keduanya bersamaan).
--   • juz_progress dihitung ulang HANYA untuk anak yang punya setoran ziyadah
--     di Az-Zariyat 1–30 (saat ditulis: 9 anak SMP, 15 setoran). Anak lain
--     tidak disentuh. Penanda mutqin dijaga apa adanya.
--
-- Trigger upsert_juz_progress_from_tahfidz membaca batas_juz, jadi setoran
-- baru langsung mengikuti batas yang benar tanpa perlu diubah.
-- ============================================================

BEGIN;

UPDATE "batas_juz" SET "selesai_surat" = 50, "selesai_ayat" = 45 WHERE "juz" = 26;
UPDATE "batas_juz" SET "mulai_surat" = 51, "mulai_ayat" = 1 WHERE "juz" = 27;

DROP TABLE IF EXISTS _anak_zariyat;
CREATE TEMP TABLE _anak_zariyat AS
SELECT DISTINCT student_id FROM tahfidz_logs
 WHERE kind IN ('ziyadah', 'hafalan_baru')
   AND surat_id = 51 AND ayat_dari <= 30 AND ayat_ke IS NOT NULL;

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
   AND l.student_id IN (SELECT student_id FROM _anak_zariyat)
 GROUP BY l.student_id, b.juz;

DELETE FROM juz_progress p
 WHERE p.student_id IN (SELECT student_id FROM _anak_zariyat)
   AND NOT p.mutqin
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = p.student_id AND j.juz_number = p.juz_number);

UPDATE juz_progress SET ayat_hafal = 0, updated_at = now()
 WHERE student_id IN (SELECT student_id FROM _anak_zariyat)
   AND mutqin
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = juz_progress.student_id AND j.juz_number = juz_progress.juz_number);

INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
SELECT student_id, juz_number, ayat_hafal, terakhir, now() FROM _juz_benar
ON CONFLICT (student_id, juz_number) DO UPDATE SET
  ayat_hafal      = EXCLUDED.ayat_hafal,
  last_setoran_at = EXCLUDED.last_setoran_at,
  updated_at      = now();

DROP TABLE _juz_benar;
DROP TABLE _anak_zariyat;
COMMIT;

-- Verifikasi (opsional):
--   SELECT * FROM batas_juz WHERE juz IN (26, 27);     -- 26: 46:1–50:45 · 27: 51:1–57:29
--   SELECT juz_dari_ayat(51, 7);                         -- 27
--   Surya Ardi Pratama (Az-Zariyat 7–22) → juz_progress hanya juz 27, 16 ayat.
