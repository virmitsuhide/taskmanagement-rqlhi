-- ============================================================
-- Hapus tugas yang bisa dipulihkan + jejak sunting/hapus
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tasks + kolom deleted_at        → "hapus" menyembunyikan, bukan membuang
--   • task_history + kolom action     → membedakan sunting/hapus dari ubah status
--
-- KENAPA SOFT DELETE
--
-- Notifikasi di aplikasi ini diturunkan dari task_history, dan FK-nya
-- ON DELETE CASCADE. Menghapus baris tasks secara fisik akan ikut menghapus
-- seluruh riwayatnya — termasuk notifikasi "si A menghapus tugas" yang baru
-- saja dibuat. Dengan menyembunyikan alih-alih membuang, riwayat tetap utuh,
-- notifikasi tetap punya task induk untuk di-JOIN, dan tugas yang terlanjur
-- terhapus masih bisa dikembalikan.
--
-- KENAPA task_history BUTUH KOLOM action
--
-- new_status bertipe task_status dan NOT NULL, jadi "disunting" dan "dihapus"
-- tidak bisa dititipkan di sana tanpa mengotori daftar status kanban. Kolom
-- action memisahkan jenis peristiwa dari status: saat menyunting, new_status
-- tetap diisi status tugas saat itu, dan action yang menerangkan maksudnya.
--
-- Baris riwayat lama otomatis dapat 'status' — sesuai artinya selama ini.
-- ============================================================

-- 1) Penanda hapus pada tugas
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

-- Index parsial untuk dua pola query yang paling sering dipakai: "tugas saya"
-- dan "tugas yang saya delegasikan", keduanya selalu disertai deleted_at IS NULL.
--
-- Yang di-index adalah kolom yang benar-benar dicari (assigned_to/assigned_by),
-- dengan deleted_at sebagai syarat parsial. Meng-index deleted_at itu sendiri
-- tidak ada gunanya: di dalam index parsial ini nilainya selalu NULL, jadi ia
-- hanya menyimpan konstanta dan tidak bisa mempersempit pencarian apa pun.
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_active_idx"
  ON "tasks" ("assigned_to")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "tasks_assigned_by_active_idx"
  ON "tasks" ("assigned_by")
  WHERE "deleted_at" IS NULL;

-- 2) Jenis peristiwa pada riwayat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_history_action') THEN
    CREATE TYPE task_history_action AS ENUM ('status', 'edited', 'deleted', 'restored');
  END IF;
END $$;

ALTER TABLE "task_history"
  ADD COLUMN IF NOT EXISTS "action" task_history_action NOT NULL DEFAULT 'status';

-- Verifikasi (opsional):
-- SELECT action, count(*) FROM task_history GROUP BY action;
-- SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS aktif,
--        count(*) FILTER (WHERE deleted_at IS NOT NULL) AS terhapus
--   FROM tasks;
