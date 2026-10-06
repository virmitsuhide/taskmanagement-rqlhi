-- ============================================================
-- Metode tahsin UMMI Dewasa — SMP kelas 9 (non-QULS)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang). Sudah diterapkan ke basis data
--    produksi 2026-10-06 lewat skrip; file ini catatan & untuk lingkungan lain.
--
-- Yang berubah:
--   • tahsin_methods : + UMMI Dewasa
--   • jilid_levels   : Jilid 1-3 (40 hal) → Al-Qur'an T1–T3 → Talaqqi Mandiri
--                      → Gharib (28) → Tajwid (20) → Lulus Tahsin
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Angkatan kelas 9 SMP masih memakai UMMI Dewasa (3 jilid), bukan Syajaroh
-- seperti kelas 7-8. Kelas 9 QULS tidak terdampak: mereka sudah diuji dan
-- langsung Lulus Tahsin sejak awal. Pemetaan jenjang → metode ada di
-- lib/tahsin.ts (JENJANG_METHODS: smp → Syajaroh + UMMI Dewasa).
--
-- Gharib & Tajwid sama seperti UMMI: hafalan materi + tetap membaca mushaf
-- (baca_quran = true).
-- ============================================================

BEGIN;

INSERT INTO tahsin_methods (name, description, is_active)
VALUES ('UMMI Dewasa', '3 jilid (40 hal) → Al-Qur’an T1–T3 → Talaqqi Mandiri → Gharib → Tajwid', true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description, is_active = true;

INSERT INTO jilid_levels (method_id, label, order_num, total_pages, is_quran, is_terminal, baca_quran)
SELECT m.id, l.label, l.order_num, l.total_pages, l.is_quran, l.is_terminal, l.baca_quran
  FROM tahsin_methods m
 CROSS JOIN (VALUES
   ('Jilid 1',          1, 40,   false, false, false),
   ('Jilid 2',          2, 40,   false, false, false),
   ('Jilid 3',          3, 40,   false, false, false),
   ('Al-Qur’an T1',     4, NULL, true,  false, true),
   ('Al-Qur’an T2',     5, NULL, true,  false, true),
   ('Al-Qur’an T3',     6, NULL, true,  false, true),
   ('Talaqqi Mandiri',  7, NULL, true,  false, true),
   ('Gharib',           8, 28,   false, false, true),
   ('Tajwid',           9, 20,   false, false, true),
   ('Lulus Tahsin',    10, NULL, false, true,  false)
 ) AS l(label, order_num, total_pages, is_quran, is_terminal, baca_quran)
 WHERE m.name = 'UMMI Dewasa'
ON CONFLICT (method_id, order_num) DO UPDATE
  SET label = EXCLUDED.label,
      total_pages = EXCLUDED.total_pages,
      is_quran = EXCLUDED.is_quran,
      is_terminal = EXCLUDED.is_terminal,
      baca_quran = EXCLUDED.baca_quran;

COMMIT;

-- Verifikasi (opsional):
-- SELECT l.order_num, l.label, l.total_pages, l.is_quran, l.is_terminal, l.baca_quran
--   FROM jilid_levels l JOIN tahsin_methods m ON m.id = l.method_id
--  WHERE m.name = 'UMMI Dewasa' ORDER BY 1;   -- 10 baris
