-- ============================================================
-- Penanda pengumuman terbaca untuk guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • teachers.announcements_seen_at : kolom baru
--
-- Portal Guru kini memberi tahu guru saat ada pengumuman baru di berandanya.
-- Tanpa kolom ini, lencana angkanya tidak pernah bisa padam — ia akan terus
-- menghitung pengumuman yang sama sampai pengumumannya dinonaktifkan, dan
-- lencana yang tidak pernah berubah cepat berhenti dibaca orang.
--
-- Sebentuk dengan users.notifications_seen_at yang sudah dipakai lonceng
-- pengurus: satu penanda waktu, bukan tabel baris-per-baris. Yang ditanyakan
-- memang cuma "adakah yang lebih baru daripada terakhir kali ia melihat" —
-- tabel penghubung akan menyimpan satu baris per guru per pengumuman untuk
-- menjawab pertanyaan yang tidak pernah ditanyakan siapa pun.
--
-- NULL = belum pernah membuka beranda; semua pengumuman aktif dihitung baru.

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "announcements_seen_at" timestamptz;
