-- ============================================================
-- juz_progress.ayat_hafal = jumlah ayat BERBEDA, bukan jumlah rentang
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- Trigger upsert_juz_progress_from_tahfidz MENJUMLAHKAN rentang setiap
-- setoran ziyadah ke juz_progress (ayat_hafal + rentang baru). Guru kerap
-- menulis setoran kumulatif:
--     3:1–15, besok 3:1–22, lusa 3:1–41, lalu 3:1–49 …
-- sehingga ayat yang sama terhitung berkali-kali. Contoh nyata (Nov 2026):
-- Ulwan Naufal Zahid (SMA) tercatat 331 ayat di juz 3, padahal juz 3 hanya
-- ±126 ayat. Angka ini dipakai bilah progres juz dan posisi juz berjalan.
--
-- ── PERBAIKANNYA ────────────────────────────────────────────
--
--   • Trigger kini MENGHITUNG ULANG juz yang disentuh setoran baru: jumlah
--     pasangan (surat, ayat) berbeda dari seluruh ziyadah anak itu di juz
--     tersebut. Setoran yang tumpang-tindih tidak lagi berlipat.
--   • Seluruh juz_progress dihitung ulang dengan rumus yang sama. Penanda
--     mutqin dijaga; baris non-mutqin yang tidak lagi punya ayat dihapus;
--     last_setoran_at baris lama tidak diubah.
--
-- Padanan TypeScript: lib/rq/batas-juz.ts ayatUnikPerJuz() — dipakai
-- recalcJuzProgress (koreksi/hapus setoran) dan progresDariZiyadah (laporan
-- per tanggal). Ubah keduanya bersamaan.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_juz_progress_from_tahfidz()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  r record;
  n integer;
BEGIN
  IF NEW.kind NOT IN ('ziyadah', 'hafalan_baru') OR NEW.ayat_dari IS NULL OR NEW.ayat_ke IS NULL THEN
    RETURN NEW;
  END IF;

  -- Juz yang disentuh setoran ini.
  FOR r IN
    SELECT b.juz, b.mulai_surat, b.mulai_ayat, b.selesai_surat, b.selesai_ayat
      FROM batas_juz b
     WHERE (b.mulai_surat, b.mulai_ayat) <= (NEW.surat_id, NEW.ayat_ke)
       AND (b.selesai_surat, b.selesai_ayat) >= (NEW.surat_id, NEW.ayat_dari)
  LOOP
    -- Ayat berbeda dari SELURUH ziyadah anak ini yang jatuh di juz r.
    SELECT count(DISTINCT (l.surat_id, a))::int INTO n
      FROM tahfidz_logs l
      CROSS JOIN LATERAL generate_series(
        GREATEST(l.ayat_dari, CASE WHEN r.mulai_surat = l.surat_id THEN r.mulai_ayat ELSE 1 END),
        LEAST(l.ayat_ke, CASE WHEN r.selesai_surat = l.surat_id THEN r.selesai_ayat ELSE l.ayat_ke END)
      ) AS a
     WHERE l.student_id = NEW.student_id
       AND l.kind IN ('ziyadah', 'hafalan_baru')
       AND l.ayat_dari IS NOT NULL AND l.ayat_ke IS NOT NULL
       AND (r.mulai_surat, r.mulai_ayat) <= (l.surat_id, l.ayat_ke)
       AND (r.selesai_surat, r.selesai_ayat) >= (l.surat_id, l.ayat_dari);

    IF n > 0 THEN
      INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
      VALUES (NEW.student_id, r.juz, n, now(), now())
      ON CONFLICT (student_id, juz_number)
      DO UPDATE SET
        ayat_hafal      = EXCLUDED.ayat_hafal,
        last_setoran_at = EXCLUDED.last_setoran_at,
        updated_at      = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── Hitung ulang seluruh data ─────────────────────────────────

DROP TABLE IF EXISTS _juz_benar;
CREATE TEMP TABLE _juz_benar AS
SELECT l.student_id, b.juz AS juz_number,
       count(DISTINCT (l.surat_id, a))::int AS ayat_hafal,
       MAX(l.created_at) AS terakhir
  FROM tahfidz_logs l
  JOIN batas_juz b
    ON (b.mulai_surat, b.mulai_ayat) <= (l.surat_id, l.ayat_ke)
   AND (b.selesai_surat, b.selesai_ayat) >= (l.surat_id, l.ayat_dari)
  CROSS JOIN LATERAL generate_series(
    GREATEST(l.ayat_dari, CASE WHEN b.mulai_surat = l.surat_id THEN b.mulai_ayat ELSE 1 END),
    LEAST(l.ayat_ke, CASE WHEN b.selesai_surat = l.surat_id THEN b.selesai_ayat ELSE l.ayat_ke END)
  ) AS a
 WHERE l.kind IN ('ziyadah', 'hafalan_baru')
   AND l.ayat_dari IS NOT NULL AND l.ayat_ke IS NOT NULL
 GROUP BY l.student_id, b.juz;

-- Baris tanpa ayat lagi: dihapus, kecuali bertanda mutqin (dinolkan).
DELETE FROM juz_progress p
 WHERE NOT p.mutqin
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = p.student_id AND j.juz_number = p.juz_number);

UPDATE juz_progress p SET ayat_hafal = 0, updated_at = now()
 WHERE p.mutqin AND p.ayat_hafal <> 0
   AND NOT EXISTS (SELECT 1 FROM _juz_benar j WHERE j.student_id = p.student_id AND j.juz_number = p.juz_number);

-- Baris yang angkanya berubah saja yang disentuh.
UPDATE juz_progress p SET ayat_hafal = j.ayat_hafal, updated_at = now()
  FROM _juz_benar j
 WHERE j.student_id = p.student_id AND j.juz_number = p.juz_number
   AND p.ayat_hafal <> j.ayat_hafal;

INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
SELECT j.student_id, j.juz_number, j.ayat_hafal, j.terakhir, now() FROM _juz_benar j
 WHERE NOT EXISTS (SELECT 1 FROM juz_progress p WHERE p.student_id = j.student_id AND p.juz_number = j.juz_number);

DROP TABLE _juz_benar;
COMMIT;

-- Verifikasi (opsional):
--   Ulwan Naufal Zahid (SMA): juz 3 turun dari 331 ke ≤ 126 ayat.
--   SELECT p.juz_number, p.ayat_hafal FROM juz_progress p JOIN students s ON s.id = p.student_id
--    WHERE s.full_name ILIKE 'Ulwan%' ORDER BY p.juz_number;
