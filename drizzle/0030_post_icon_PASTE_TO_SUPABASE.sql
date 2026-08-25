-- ============================================================
-- Pilihan ikon untuk post di beranda publik
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : post_icon (info | pengumuman | pengingat | tugas)
--   • public_posts + kolom icon, NULL-able
--
-- Kenapa: sampai sekarang ikon di papan pengumuman diturunkan dari `priority`,
-- jadi penulis tidak bisa membedakan "tugas guru" dari "pengumuman biasa"
-- selain lewat judulnya. Ikon dijadikan pilihan sendiri.
--
-- Kenapa NULL-able, bukan DEFAULT: NULL berarti "penulis belum pernah memilih",
-- dan post lama memang begitu — ikonnya diturunkan dari type & priority di
-- lib/home/post-icons.ts. Kalau diberi default, semua post lama akan mendadak
-- mengaku telah memilih ikon yang sebenarnya tidak pernah mereka pilih, dan
-- tugas guru lama ikut berubah jadi gambar pengumuman.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_icon') THEN
    CREATE TYPE post_icon AS ENUM ('info', 'pengumuman', 'pengingat', 'tugas');
  END IF;
END $$;

ALTER TABLE public_posts
  ADD COLUMN IF NOT EXISTS icon post_icon;

-- Verifikasi (opsional):
-- SELECT icon, count(*) FROM public_posts GROUP BY icon;
