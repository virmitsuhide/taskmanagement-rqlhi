-- Papan tugas: kolom Problem + Review, priority low/middle/high, bobot, horizon.
--
-- Urutan penting: horizon di-backfill dari priority LAMA sebelum enum priority
-- ditulis ulang, karena 'jangka_panjang' selama ini merangkap penanda tugas
-- pribadi jangka panjang (app/tasks/page.tsx bucketOf).

-- 1) Kolom & enum baru
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
--> statement-breakpoint

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "weight"        "task_weight"       DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "horizon"       "task_horizon"      DEFAULT 'pendek';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "problem_type"  "task_problem_type";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "problem_notes" text;--> statement-breakpoint

-- 2) Backfill horizon dari priority lama (sebelum enum priority diubah)
UPDATE "tasks" SET "horizon" = 'panjang'
WHERE "priority"::text = 'jangka_panjang' AND "horizon" IS DISTINCT FROM 'panjang';--> statement-breakpoint

-- 3) priority: normal/mendesak/jangka_panjang → low/middle/high
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
--> statement-breakpoint

-- 4) status: tambah 'problem' (dipakai juga oleh task_history.old_status/new_status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'task_status' AND e.enumlabel = 'problem'
  ) THEN
    ALTER TABLE "tasks"        ALTER COLUMN "status"     DROP DEFAULT;

    CREATE TYPE "task_status_new" AS ENUM ('todo', 'in_progress', 'problem', 'submitted', 'done', 'returned');
    ALTER TABLE "tasks"        ALTER COLUMN "status"     TYPE "task_status_new" USING "status"::text::"task_status_new";
    ALTER TABLE "task_history" ALTER COLUMN "old_status" TYPE "task_status_new" USING "old_status"::text::"task_status_new";
    ALTER TABLE "task_history" ALTER COLUMN "new_status" TYPE "task_status_new" USING "new_status"::text::"task_status_new";
    DROP TYPE "task_status";
    ALTER TYPE "task_status_new" RENAME TO "task_status";

    ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'todo';
  END IF;
END $$;
--> statement-breakpoint

-- 5) Rapikan nilai NULL pada kolom baru untuk baris lama
UPDATE "tasks" SET "weight"  = 'medium' WHERE "weight"  IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "horizon" = 'pendek' WHERE "horizon" IS NULL;
