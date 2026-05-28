-- ============================================================
-- PHASE 6 — Komentar/diskusi per task (Slack-style)
-- ============================================================
-- 📋 CARA PAKAI:
--    1. Supabase Dashboard → SQL Editor → New query
--    2. Copy seluruh isi file ini, paste, Run
--    3. (Opsional) sudah otomatis terdaftar di drizzle_migrations di bawah
-- ============================================================

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id"    uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "author_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body"       text NOT NULL,
  "mentions"   uuid[],
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_task_comments_task" ON "task_comments"("task_id", "created_at");

ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;

-- Verifikasi:
--   SELECT count(*) FROM task_comments;   -- harus 0, tabel ada

-- Daftarkan ke drizzle_migrations supaya `npm run db:migrate` tidak apply ulang
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id         serial PRIMARY KEY,
  tag        text UNIQUE NOT NULL,
  applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0005_task_comments')
ON CONFLICT (tag) DO NOTHING;
