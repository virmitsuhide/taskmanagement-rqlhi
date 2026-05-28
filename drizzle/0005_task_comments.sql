-- ============================================================
-- PHASE 6 — Komentar/diskusi per task (Slack-style)
-- ============================================================

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id"    uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "author_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body"       text NOT NULL,
  "mentions"   uuid[],
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_comments_task" ON "task_comments"("task_id", "created_at");
--> statement-breakpoint
ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;
