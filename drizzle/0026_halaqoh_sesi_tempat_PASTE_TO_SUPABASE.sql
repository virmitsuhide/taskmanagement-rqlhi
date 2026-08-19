-- ============================================================
-- Halaqoh: sesi sebagai identitas, tempat sebagai atribut
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • halaqoh + kolom sesi (1–3) dan tempat
--   • backfill  : tempat diisi dari schedule_note yang selama ini menampungnya
--
-- ── KENAPA TEMPAT DIPINDAH KE KOLOM SENDIRI ─────────────────
--
-- Impor pertama menaruh tempat di dalam NAMA halaqoh ("Ustadzah Erna —
-- Ruang Kelas 3A"). Itu keliru: ruang bisa berpindah tanpa halaqohnya
-- berubah, dan begitu berpindah, namanya jadi berbohong — sementara nama
-- itu sudah terlanjur dipakai di rapor dan riwayat setoran.
--
-- Tempat juga sempat dititipkan di schedule_note, kolom yang menurut namanya
-- untuk catatan jadwal. Kolom sendiri membuat maksudnya jelas dan bisa
-- ditampilkan terpisah dari nama.
--
-- ── KENAPA SESI JADI BAGIAN IDENTITAS ───────────────────────
--
-- Sesi ditentukan tingkat kelas dan menentukan jam belajar:
--   SD  — sesi 1: kelas 3 & 4 | sesi 2: kelas 1 & 2 | sesi 3: kelas 5 & 6
--   SMP — sesi 1: kelas 9     | sesi 2: kelas 7     | sesi 3: kelas 8
--
-- Satu pengampu lazim memegang beberapa sesi, dan itu kelompok yang
-- berbeda-beda. Pengelompokan lama memakai (pengampu + tempat), sehingga dua
-- sesi yang kebetulan memakai ruang sama tergabung jadi satu halaqoh — lima
-- kelompok tercampur seperti itu, misalnya kelas 8 dan 9 dalam satu baris.
--
-- Jam sesi (08.00, 09.30, 10.45) SENGAJA TIDAK disimpan di sini. Ia berlaku
-- se-lembaga, bukan per halaqoh; menyalinnya ke 72 baris berarti 72 tempat
-- yang harus diubah kalau jamnya bergeser. Jamnya ada di lib/rq/sesi.ts.
-- ============================================================

ALTER TABLE halaqoh ADD COLUMN IF NOT EXISTS sesi   smallint;
ALTER TABLE halaqoh ADD COLUMN IF NOT EXISTS tempat text NOT NULL DEFAULT '';

DO $$ BEGIN
  ALTER TABLE halaqoh ADD CONSTRAINT halaqoh_sesi_sah CHECK (sesi IS NULL OR sesi BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN halaqoh.sesi IS
  'Sesi belajar 1-3, ditentukan tingkat kelas anggotanya. Jam tiap sesi ada di lib/rq/sesi.ts, bukan di baris ini.';

-- Tempat yang selama ini dititipkan di schedule_note dipindahkan.
UPDATE halaqoh
SET tempat = schedule_note
WHERE tempat = '' AND schedule_note IS NOT NULL AND schedule_note <> '';

CREATE INDEX IF NOT EXISTS halaqoh_sesi_idx ON halaqoh (term_id, sesi);

-- Verifikasi (opsional):
-- SELECT sesi, COUNT(*) FROM halaqoh GROUP BY sesi ORDER BY sesi;
-- SELECT name, sesi, tempat FROM halaqoh ORDER BY sesi, name LIMIT 10;
