-- ============================================================
-- Pembina gukar TPAIT & SMA — ditunjuk koordinator unit
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • teachers.pembina_gukar (boolean, bawaan false) — kolom baru
--   • guru TPAIT/SMA yang SEKARANG mengampu kelompok gukar aktif langsung
--     ditandai pembina, supaya aksesnya tidak putus di tengah semester
--
-- ── ATURAN BARU (2026-09-29) ────────────────────────────────
--
-- Yang boleh mengampu pembinaan guru & karyawan:
--   • SD, SD Juara, SMP : Guru RQ berstatus Tetap Yayasan / Kontrak Yayasan
--   • TPAIT, SMA        : hanya guru yang ditunjuk Koor TPAIT / Koor SMA
--                         (kolom ini), apa pun status & kategorinya
--
-- Unit guru dibaca dari teachers.unit, atau dari kategori Guru TPAIT / Guru
-- SMA bila unitnya masih kosong. Aturannya di canDoGukarPembinaan
-- (lib/auth/permissions.ts).
-- ============================================================

BEGIN;

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS pembina_gukar boolean NOT NULL DEFAULT false;

UPDATE teachers t
   SET pembina_gukar = true
 WHERE t.pembina_gukar = false
   AND (t.unit IN ('paud', 'sma') OR (t.unit IS NULL AND t.kategori_guru::text IN ('guru_tpait', 'guru_sma')))
   AND EXISTS (
     SELECT 1
       FROM gukar_groups g
       JOIN academic_terms a ON a.id = g.term_id AND a.is_current
      WHERE g.pengampu_id = t.id AND g.is_active
   );

COMMIT;

-- Verifikasi (opsional):
-- SELECT username, unit, kategori_guru, employment_type FROM teachers WHERE pembina_gukar;
