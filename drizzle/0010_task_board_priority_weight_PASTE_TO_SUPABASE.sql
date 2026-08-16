-- ============================================================
-- Papan Tugas — kolom Problem & Review, priority low/middle/high, bobot tugas
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman dalam 1 transaksi & idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • task_priority : normal/mendesak/jangka_panjang → low/middle/high
--                     (mendesak→high, normal→middle, jangka_panjang→low)
--   • task_status   : + 'problem'  (dipakai tasks.status & task_history)
--   • kolom baru    : weight (easy/medium/hard), horizon (pendek/panjang),
--                     problem_type (bottleneck/blocked/wip_limit/others),
--                     problem_notes
--
-- ⚠️ URUTAN PENTING: horizon di-backfill dari priority LAMA lebih dulu, karena
--    nilai 'jangka_panjang' selama ini merangkap penanda "Tugas Pribadi Jangka
--    Panjang". Kalau priority diubah duluan, penanda itu hilang permanen.
-- ============================================================

-- 1) Enum & kolom baru
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_weight') THEN
    CREATE TYPE "task_weight" AS ENUM ('easy', 'medium', 'hard');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_horizon') THEN
    CREATE TYPE "task_horizon" AS ENUM ('pendek', 'panjang');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_problem_type') THEN
    CREATE TYPE "task_problem_type" AS ENUM ('bottleneck', 'blocked', 'wip_limit', 'others');
  END IF;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "weight"        "task_weight"      DEFAULT 'medium';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "horizon"       "task_horizon"     DEFAULT 'pendek';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "problem_type"  "task_problem_type";
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "problem_notes" text;

-- 2) Backfill horizon dari priority LAMA (sebelum enum priority ditulis ulang)
UPDATE "tasks" SET "horizon" = 'panjang'
WHERE "priority"::text = 'jangka_panjang' AND "horizon" IS DISTINCT FROM 'panjang';

-- 3) priority → low / middle / high
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'task_priority' AND e.enumlabel = 'mendesak'
  ) THEN
    ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT;

    CREATE TYPE "task_priority_new" AS ENUM ('low', 'middle', 'high');
    ALTER TABLE "tasks"
      ALTER COLUMN "priority" TYPE "task_priority_new"
      USING (CASE "priority"::text
               WHEN 'mendesak'       THEN 'high'
               WHEN 'jangka_panjang' THEN 'low'
               ELSE 'middle'
             END)::"task_priority_new";
    DROP TYPE "task_priority";
    ALTER TYPE "task_priority_new" RENAME TO "task_priority";

    ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'middle';
  END IF;
END $$;

-- 4) status: tambah 'problem'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'task_status' AND e.enumlabel = 'problem'
  ) THEN
    ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;

    CREATE TYPE "task_status_new" AS ENUM ('todo', 'in_progress', 'problem', 'submitted', 'done', 'returned');
    ALTER TABLE "tasks"        ALTER COLUMN "status"     TYPE "task_status_new" USING "status"::text::"task_status_new";
    ALTER TABLE "task_history" ALTER COLUMN "old_status" TYPE "task_status_new" USING "old_status"::text::"task_status_new";
    ALTER TABLE "task_history" ALTER COLUMN "new_status" TYPE "task_status_new" USING "new_status"::text::"task_status_new";
    DROP TYPE "task_status";
    ALTER TYPE "task_status_new" RENAME TO "task_status";

    ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'todo';
  END IF;
END $$;

-- 5) Rapikan NULL pada kolom baru untuk baris lama
UPDATE "tasks" SET "weight"  = 'medium' WHERE "weight"  IS NULL;
UPDATE "tasks" SET "horizon" = 'pendek' WHERE "horizon" IS NULL;

-- Verifikasi:
--   SELECT unnest(enum_range(NULL::task_priority));  -- low, middle, high
--   SELECT unnest(enum_range(NULL::task_status));    -- ..., problem, ...
--   SELECT priority, weight, horizon, count(*) FROM tasks GROUP BY 1,2,3 ORDER BY 1;

CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id serial PRIMARY KEY, tag text UNIQUE NOT NULL, applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0010_task_board_priority_weight')
ON CONFLICT (tag) DO NOTHING;
