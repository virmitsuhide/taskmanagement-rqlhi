-- ============================================================
-- Pengumuman beranda: gambar / flyer
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • public_posts.image_url → BARU, url publik gambar/flyer post (opsional)
--
-- Pengumuman kegiatan hampir selalu punya flyer. Beranda menampilkannya
-- sebagai thumbnail di daftar pengumuman, dan halaman pengumuman menampilkan
-- flyer utuhnya.
--
-- Berkasnya disimpan di bucket publik `news-images` (folder `pengumuman/`),
-- bucket yang sama dengan thumbnail berita — flyer memang untuk dibaca
-- publik, dan tidak perlu bucket baru.

ALTER TABLE "public_posts" ADD COLUMN IF NOT EXISTS "image_url" text;
COMMENT ON COLUMN "public_posts"."image_url" IS
  'Url publik gambar/flyer post (bucket news-images, folder pengumuman/). NULL = tanpa gambar.';
