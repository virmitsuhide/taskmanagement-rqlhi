-- ============================================================
-- Antrean ujian untuk TPAIT, SD Juara, dan SMA
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang). Jalankan SETELAH 0099.
--
-- Yang berubah:
--   • ujian_tahfidz.unit, ujian_tahsin.unit : boleh 'TPAIT', 'SD Juara', 'SMA'
--   • riwayat ujian siswa SD Juara yang dulu tercatat di unit 'SD'
--     dipindah ke 'SD Juara'
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Tiap unit kini punya koordinator sendiri (0099), jadi tiap unit juga punya
-- antrean ujiannya sendiri. Sebelumnya SD Juara menumpang antrean SD; setelah
-- dipisah, riwayat lamanya ikut pindah supaya koor SD Juara melihat seluruh
-- riwayat anak-anaknya, dan rekap SD tidak lagi memuat anak SD Juara.
--
-- Yang TIDAK dipindah:
--   • ujian alumni SD LHI (unit 'SD', siswanya kini SMP) — tetap 'SD'.
--   • ujian tahsin kelompok campuran (ada anak SD & SD Juara sekaligus) atau
--     yang siswanya tidak tertaut id — tetap 'SD'.
-- ============================================================

BEGIN;

ALTER TABLE ujian_tahfidz DROP CONSTRAINT IF EXISTS ujian_tahfidz_unit_check;
ALTER TABLE ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_unit_check
  CHECK (unit = ANY (ARRAY['TPAIT', 'SD', 'SD Juara', 'SMP', 'SMA']));

ALTER TABLE ujian_tahsin DROP CONSTRAINT IF EXISTS ujian_tahsin_unit_check;
ALTER TABLE ujian_tahsin ADD CONSTRAINT ujian_tahsin_unit_check
  CHECK (unit = ANY (ARRAY['TPAIT', 'SD', 'SD Juara', 'SMP', 'SMA']));

-- Tahfidz: satu baris satu anak — cukup lihat jenjang anaknya.
UPDATE ujian_tahfidz t
   SET unit = 'SD Juara'
  FROM students s
 WHERE t.unit = 'SD'
   AND t.student_id = s.id
   AND s.jenjang = 'sd_juara';

-- Tahsin: satu baris satu kelompok. Pindah hanya bila SEMUA anak yang
-- tertaut berjenjang sd_juara.
UPDATE ujian_tahsin t
   SET unit = 'SD Juara'
 WHERE t.unit = 'SD'
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(t.siswa) e
       JOIN students s ON s.id::text = e->>'student_id'
      WHERE s.jenjang = 'sd_juara'
   )
   AND NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(t.siswa) e
       LEFT JOIN students s ON s.id::text = e->>'student_id'
      WHERE s.id IS NULL OR s.jenjang <> 'sd_juara'
   );

COMMIT;

-- Verifikasi (opsional):
-- SELECT unit, count(*) FROM ujian_tahfidz GROUP BY 1;
-- SELECT unit, count(*) FROM ujian_tahsin  GROUP BY 1;
