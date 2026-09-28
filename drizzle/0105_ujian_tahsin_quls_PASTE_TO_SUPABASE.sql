-- ============================================================
-- Tanda QULS pada ujian tahsin — bagian Koor QULS SD di antrean SD
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ujian_tahsin.is_quls (boolean, bawaan false) — kolom baru
--   • pengajuan lama yang memuat anak QULS ditandai true
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Koor QULS SD kini menguji anak QULS SD. Antreannya TIDAK dipisah: ia
-- berbagi antrean 'SD' dengan Koor SD (keputusan 2026-09-29), dan yang
-- membedakan bagiannya adalah tanda QULS per baris ujian. ujian_tahfidz
-- sudah punya is_quls sejak awal; ujian_tahsin belum, karena satu barisnya
-- satu kelompok, bukan satu anak.
--
-- Kelompok ditandai QULS bila ADA anak QULS di dalamnya — program anak itu
-- sendiri, atau program halaqohnya. Kelompok campuran tetap terlihat oleh
-- Koor SD (yang memegang seluruh SD); dengan "ada", tidak satu pun anak QULS
-- luput dari Koor QULS SD.
-- ============================================================

BEGIN;

ALTER TABLE ujian_tahsin ADD COLUMN IF NOT EXISTS is_quls boolean NOT NULL DEFAULT false;

UPDATE ujian_tahsin t
   SET is_quls = true
 WHERE t.unit = 'SD'
   AND t.is_quls = false
   AND EXISTS (
     SELECT 1
       FROM jsonb_array_elements(t.siswa) e
       JOIN students s ON s.id::text = e->>'student_id'
       LEFT JOIN halaqoh h ON h.id = s.halaqoh_id
      WHERE s.program LIKE '%quls%' OR h.program LIKE '%quls%'
   );

COMMIT;

-- Verifikasi (opsional):
-- SELECT unit, is_quls, count(*) FROM ujian_tahsin GROUP BY 1, 2 ORDER BY 1, 2;
