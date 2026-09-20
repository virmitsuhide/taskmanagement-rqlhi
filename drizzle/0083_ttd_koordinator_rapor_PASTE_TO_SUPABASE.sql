-- ============================================================
-- Tanda tangan koordinator pada template rapor Qur'an
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0082 (rapor_templates).
--
-- Template rapor menyediakan ruang tanda tangan di antara baris jabatan dan
-- baris nama — di berkas Word aslinya berupa empat paragraf kosong. Ruang itu
-- kini terisi sendiri: tanda tangan pengampu diambil dari profilnya
-- (teachers.signature_path), sedangkan tanda tangan koordinator tidak punya
-- sumber sebelum ini.
--
-- Disimpan di template, bukan di profil pengguna: yang menandatangani rapor
-- unit adalah jabatan koordinatornya, dan berkas yang sama dipakai seluruh
-- angkatan. Menautkannya ke akun perorangan berarti seluruh rapor kehilangan
-- tanda tangannya begitu koordinatornya berganti.
--
-- Path-nya menunjuk bucket `signatures` yang TERTUTUP (lihat
-- lib/kpi/ttd-berkas.ts) — gambar diambil lewat url bertanda tangan berumur
-- pendek, bukan url publik. Gambar tanda tangan yang bisa diunduh siapa saja
-- adalah bahan untuk memalsukan dokumen mana pun.
-- ============================================================

ALTER TABLE "rapor_templates"
  ADD COLUMN IF NOT EXISTS "ttd_koordinator_path" text;

COMMENT ON COLUMN "rapor_templates"."ttd_koordinator_path" IS
  'Path objek di bucket signatures (tertutup). NULL = ruang tanda tangan
   dibiarkan kosong untuk ditandatangani basah.';
