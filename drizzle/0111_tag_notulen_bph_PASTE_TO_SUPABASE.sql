-- ============================================================
-- Notulen: kategori "Informasi BPH" & "Bahas di BPH"
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tipe agenda_tag mendapat nilai 'informasi_bph' dan 'bahas_bph'
--
-- Arti:
--   informasi_bph — informasi dari/untuk BPH; tidak masuk Papan Rapat
--                   (sama seperti 'informasi').
--   bahas_bph     — poin yang perlu dibawa ke rapat BPH; tampil di Papan
--                   Rapat sampai ditandai "sudah dibahas di BPH".
--
-- Hanya bisa dipilih di Rapat Manajemen dan rapat-rapat Koor — aturan itu
-- ditegakkan aplikasi (lib/auth/permissions.ts → tagNotulenUntuk).
--
-- ALTER TYPE ... ADD VALUE tidak boleh dibungkus BEGIN/COMMIT bersama
-- pemakaian nilainya, jadi file ini sengaja tanpa transaksi.
-- Jalankan SEBELUM kode yang memakai kategori ini ter-deploy.
-- ============================================================

ALTER TYPE public.agenda_tag ADD VALUE IF NOT EXISTS 'informasi_bph';
ALTER TYPE public.agenda_tag ADD VALUE IF NOT EXISTS 'bahas_bph';
