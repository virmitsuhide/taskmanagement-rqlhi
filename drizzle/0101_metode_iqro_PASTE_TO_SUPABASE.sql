-- ============================================================
-- Metode tahsin IQRO — SD LHI Juara kelas 2-6
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tahsin_methods : + IQRO
--   • jilid_levels   : Jilid 1-6 (32 hal) → Talaqqi Al-Qur'an → Lulus Tahsin
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- SD Juara memakai dua metode: kelas 1 KIBAR, kelas 2-6 IQRO. Sampai sini
-- hanya KIBAR yang tercatat, jadi anak kelas 2-6 terpaksa ditaruh di tahap
-- KIBAR yang tidak ia tempuh. Pemetaan jenjang → metode ada di lib/tahsin.ts
-- (JENJANG_METHODS: sd_juara → KIBAR + IQRO).
--
-- Posisi siswa SD Juara TIDAK dipindah otomatis: metode tiap anak diubah
-- lewat halaman siswa / impor, karena hanya guru yang tahu anak itu di jilid
-- Iqro' berapa.
-- ============================================================

BEGIN;

INSERT INTO tahsin_methods (name, description, is_active)
VALUES ('IQRO', '6 jilid (32 hal) → Talaqqi Al-Qur’an', true)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description, is_active = true;

INSERT INTO jilid_levels (method_id, label, order_num, total_pages, is_quran, is_terminal, baca_quran)
SELECT m.id, l.label, l.order_num, l.total_pages, l.is_quran, l.is_terminal, l.is_quran
  FROM tahsin_methods m
 CROSS JOIN (VALUES
   ('Jilid 1',            1, 32,   false, false),
   ('Jilid 2',            2, 32,   false, false),
   ('Jilid 3',            3, 32,   false, false),
   ('Jilid 4',            4, 32,   false, false),
   ('Jilid 5',            5, 32,   false, false),
   ('Jilid 6',            6, 32,   false, false),
   ('Talaqqi Al-Qur’an',  7, NULL, true,  false),
   ('Lulus Tahsin',       8, NULL, false, true)
 ) AS l(label, order_num, total_pages, is_quran, is_terminal)
 WHERE m.name = 'IQRO'
ON CONFLICT (method_id, order_num) DO UPDATE
  SET label = EXCLUDED.label,
      total_pages = EXCLUDED.total_pages,
      is_quran = EXCLUDED.is_quran,
      is_terminal = EXCLUDED.is_terminal,
      baca_quran = EXCLUDED.baca_quran;

COMMIT;

-- Verifikasi (opsional):
-- SELECT l.order_num, l.label, l.total_pages, l.is_quran, l.is_terminal
--   FROM jilid_levels l JOIN tahsin_methods m ON m.id = l.method_id
--  WHERE m.name = 'IQRO' ORDER BY 1;   -- 8 baris
