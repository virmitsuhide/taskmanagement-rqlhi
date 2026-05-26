ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'berita' NOT NULL;
