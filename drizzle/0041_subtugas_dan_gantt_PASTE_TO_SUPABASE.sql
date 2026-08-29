-- ============================================================
-- Sub-tugas berdeadline + garis waktu (Gantt) untuk tugas
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum subtask_status            → todo / in_progress / done
--   • tabel task_subtasks            → rincian sebuah tugas, masing-masing bertenggat
--   • tasks + kolom start_date       → ujung kiri batang Gantt
--
-- KENAPA TABEL BARU, BUKAN tasks YANG MENUNJUK DIRINYA SENDIRI
--
-- Tugas di aplikasi ini punya banyak beban yang tidak dimiliki rincian kecil:
-- alur kanban enam status, verifikasi oleh pemberi tugas, notifikasi, diskusi,
-- riwayat, soft delete. Menjadikan sub-tugas sebagai baris tasks berarti
-- semuanya ikut terbawa — kartu anak bermunculan di papan, ikut terhitung di
-- badge "Tugas Aktif", dan minta diverifikasi satu per satu. Rincian di sini
-- adalah langkah pengerjaan, bukan penugasan tersendiri, jadi ia diberi tabel
-- sendiri dengan siklus hidup yang jauh lebih ringan (tiga status, tanpa review).
--
-- KENAPA tasks BUTUH start_date
--
-- Gantt butuh dua ujung. Sampai sekarang tugas hanya menyimpan due_date, jadi
-- batangnya tidak punya titik mulai. Kolom ini opsional: kalau kosong, lapisan
-- data memakai tanggal pembuatan tugas sebagai awal (lihat lib/tasks/gantt.ts),
-- sehingga tugas lama tetap tergambar tanpa perlu backfill yang menebak-nebak.
--
-- KENAPA STATUS SUB-TUGAS PUNYA 'in_progress', BUKAN SEKADAR CENTANG
--
-- Batang Gantt yang cuma tahu "selesai / belum" tidak bisa membedakan langkah
-- yang sedang berjalan dari langkah yang belum disentuh — padahal justru itu
-- yang dicari saat membaca garis waktu orang lain. Tiga status memberi tiga
-- warna batang tanpa menambah beban alur kerja.
-- ============================================================

-- 1) Enum status sub-tugas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subtask_status') THEN
    CREATE TYPE subtask_status AS ENUM ('todo', 'in_progress', 'done');
  END IF;
END $$;

-- 2) Titik mulai tugas induk
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "start_date" date;

-- 3) Rincian tugas
CREATE TABLE IF NOT EXISTS "task_subtasks" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id"      uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "title"        text NOT NULL,
  -- Urutan tampil di daftar & Gantt. Dipakai apa adanya (bukan diturunkan dari
  -- tanggal) karena langkah bisa saja belum bertanggal tapi tetap punya urutan.
  "order_num"    integer NOT NULL DEFAULT 0,
  "start_date"   date,
  "due_date"     date,
  "status"       subtask_status NOT NULL DEFAULT 'todo',
  "created_by"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" timestamptz,
  "created_at"   timestamptz DEFAULT now(),
  "updated_at"   timestamptz DEFAULT now()
);

-- Satu-satunya pola query: "semua rincian tugas X, terurut".
CREATE INDEX IF NOT EXISTS "task_subtasks_task_order_idx"
  ON "task_subtasks" ("task_id", "order_num");

-- Gantt lintas pengguna menyaring rentang tanggal sebelum mengelompokkan per
-- tugas induk, jadi tenggat rincian ikut dicari langsung.
CREATE INDEX IF NOT EXISTS "task_subtasks_due_date_idx"
  ON "task_subtasks" ("due_date")
  WHERE "due_date" IS NOT NULL;

-- Gantt "tugas saya" memfilter tasks.assigned_to lalu mengurutkan rentang
-- waktunya. Index parsial ini sejajar dengan tasks_assigned_to_active_idx
-- (migrasi 0018) tapi membawa serta kolom tanggal yang dipakai mengurutkan.
CREATE INDEX IF NOT EXISTS "tasks_gantt_range_idx"
  ON "tasks" ("assigned_to", "start_date", "due_date")
  WHERE "deleted_at" IS NULL;

-- Verifikasi (opsional):
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'task_subtasks' ORDER BY ordinal_position;
