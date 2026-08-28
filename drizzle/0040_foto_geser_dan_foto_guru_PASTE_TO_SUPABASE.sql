-- ============================================================
-- Posisi foto dalam lingkaran (users + teachers)
-- ============================================================
-- CARA PAKAI: Supabase SQL Editor -> paste seluruh file -> Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   * users    : + photo_focus (jsonb, default {"x":50,"y":50,"zoom":100})
--   * teachers : + photo_focus (jsonb, default sama)
--
-- Bentuknya: { "x": 50, "y": 32, "zoom": 140 }
--   x,y  : titik fokus dalam persen, dipakai sebagai CSS object-position
--   zoom : perbesaran dalam persen, 100 = tanpa perbesaran
--
-- -- KENAPA POSISI, BUKAN MEMOTONG BERKASNYA -------------------
--
-- Alternatifnya adalah memotong gambar saat diunggah dan menyimpan hasil
-- potongannya. Itu merusak: sekali dipotong, bagian yang terbuang tidak bisa
-- dikembalikan, padahal lingkaran di aplikasi ini muncul dalam beberapa ukuran
-- (size-11 di panel Humas, size-14 di beranda, size-20 di /profil-guru) dan
-- suatu saat bisa berubah jadi kotak. Menyimpan titik fokus membuat berkas
-- aslinya utuh dan potongannya dihitung ulang oleh CSS di tiap tempat.
--
-- Karena itu kolomnya ada di baris pemilik foto, bukan di nama berkas: satu
-- foto tetap satu berkas di storage, posisinya data terpisah yang bisa
-- disunting berulang kali tanpa mengunggah ulang.
--
-- -- KENAPA TEACHERS IKUT ------------------------------------
--
-- Foto guru dipakai di lingkaran yang sama persis di beranda dan /profil-guru.
-- Kalau hanya users yang punya kolom ini, foto guru yang diunggah Humas tidak
-- bisa dirapikan sama sekali, dan foto pengurus yang dipinjam guru (lihat
-- getPublicTeachers) akan berubah posisi begitu guru itu punya fotonya sendiri.
-- ============================================================

ALTER TABLE "users"    ADD COLUMN IF NOT EXISTS "photo_focus" jsonb DEFAULT '{"x":50,"y":50,"zoom":100}'::jsonb;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "photo_focus" jsonb DEFAULT '{"x":50,"y":50,"zoom":100}'::jsonb;

UPDATE "users"    SET "photo_focus" = '{"x":50,"y":50,"zoom":100}'::jsonb WHERE "photo_focus" IS NULL;
UPDATE "teachers" SET "photo_focus" = '{"x":50,"y":50,"zoom":100}'::jsonb WHERE "photo_focus" IS NULL;

-- Verifikasi (opsional):
-- SELECT username, photo_url, photo_focus FROM users WHERE photo_url IS NOT NULL;
