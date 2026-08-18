-- ============================================================
-- Status prioritas untuk pengumuman & tugas guru di beranda
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : post_priority (penting | info | pengingat)
--   • public_posts + kolom priority, default 'info'
--
-- Kenapa: beranda tidak lagi menandai post yang lewat tenggat sebagai
-- "Terlambat". Penanda waktu itu diganti status prioritas yang ditentukan
-- penulisnya, jadi urgensi ditentukan manusia, bukan disimpulkan dari tanggal.
--
-- Post lama otomatis dapat 'info'. Sesuaikan lewat /home-post kalau ada yang
-- semestinya 'penting'.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_priority') THEN
    CREATE TYPE post_priority AS ENUM ('penting', 'info', 'pengingat');
  END IF;
END $$;

ALTER TABLE public_posts
  ADD COLUMN IF NOT EXISTS priority post_priority NOT NULL DEFAULT 'info';

-- Verifikasi (opsional):
-- SELECT priority, count(*) FROM public_posts GROUP BY priority;
