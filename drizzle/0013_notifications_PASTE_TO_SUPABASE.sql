-- ============================================================
-- Sistem notifikasi — penanda "sudah dilihat" & "sudah dibaca"
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman & idempoten (boleh dijalankan ulang).
--
-- Notifikasi TIDAK disimpan sebagai baris tersendiri. Isinya diturunkan dari
-- task_history yang memang sudah mencatat dua peristiwa yang dibutuhkan:
--   • tugas dibuat/diberikan  → old_status IS NULL
--   • status tugas diubah     → old_status IS NOT NULL
-- Jadi tidak ada pemicu baru yang bisa terlewat, dan riwayat lama otomatis
-- ikut tampil.
--
-- Yang perlu disimpan hanya status baca per pengguna:
--   • users.notifications_seen_at — kapan terakhir dropdown DIBUKA.
--     Mengendalikan angka merah di lonceng.
--   • notification_reads          — item mana yang sudah DIKLIK.
--     Mengendalikan titik biru per baris.
--
-- Dua penanda ini sengaja dipisah: membuka dropdown menghentikan badge, tapi
-- item yang belum diklik tetap bertanda.
-- ============================================================

-- 1) Penanda kapan lonceng terakhir dibuka
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notifications_seen_at" timestamptz;

-- 2) Item notifikasi yang sudah diklik
CREATE TABLE IF NOT EXISTS "notification_reads" (
  "user_id"    uuid NOT NULL REFERENCES "users"(id)        ON DELETE CASCADE,
  "history_id" uuid NOT NULL REFERENCES "task_history"(id) ON DELETE CASCADE,
  "read_at"    timestamptz DEFAULT now(),
  PRIMARY KEY ("user_id", "history_id")
);

CREATE INDEX IF NOT EXISTS "notification_reads_user_idx"
  ON "notification_reads" ("user_id");

-- Verifikasi (opsional):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'users' AND column_name = 'notifications_seen_at';
-- SELECT count(*) FROM notification_reads;
