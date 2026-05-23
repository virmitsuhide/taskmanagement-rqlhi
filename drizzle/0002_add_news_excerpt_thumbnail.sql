ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "excerpt" text;
ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
