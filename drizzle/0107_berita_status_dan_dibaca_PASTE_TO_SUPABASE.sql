-- ============================================================
-- Berita: status Draf / Terjadwal / Terbit + hitungan dibaca
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • news_articles.status      — 'draf' | 'terbit' (bawaan 'terbit', jadi
--                                 semua berita lama tetap tampil seperti biasa)
--   • news_articles.publish_at  — jadwal tayang (timestamptz, opsional).
--                                 status 'terbit' + publish_at di masa depan
--                                 = Terjadwal; publik baru melihatnya setelah
--                                 waktunya lewat.
--   • news_articles.view_count  — total dibaca (bawaan 0)
--   • news_article_views_daily  — TABEL BARU, hitungan dibaca per hari
--                                 (untuk ubin "Dibaca 30 hari")
--   • increment_news_view(uuid) — FUNGSI BARU, dipanggil halaman /news/[id]
--                                 setiap kali dibuka pengunjung; menambah
--                                 view_count dan baris harian secara atomik.
--   • news_views_summary()      — FUNGSI BARU, jumlah dibaca 30 hari terakhir
--                                 dan 30 hari sebelumnya (ubin Kelola Berita).
--
-- is_active tetap berarti "Nonaktif" (disembunyikan editor) dan tidak diubah.
-- Aplikasi tetap berjalan sebelum file ini dijalankan: kolom baru dibaca
-- sebagai opsional dan panggilan fungsi dibungkus try/catch.
-- ============================================================

BEGIN;

ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'terbit';
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS publish_at timestamptz;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_articles_status_check') THEN
    ALTER TABLE news_articles
      ADD CONSTRAINT news_articles_status_check CHECK (status IN ('draf', 'terbit'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS news_articles_status_publish_idx
  ON news_articles (status, publish_at);

CREATE TABLE IF NOT EXISTS news_article_views_daily (
  news_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  day     date NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (news_id, day)
);
CREATE INDEX IF NOT EXISTS news_article_views_daily_day_idx
  ON news_article_views_daily (day);
ALTER TABLE news_article_views_daily ENABLE ROW LEVEL SECURITY;

-- Satu kali buka halaman = +1 total dan +1 pada hari itu (tanggal WIB).
CREATE OR REPLACE FUNCTION increment_news_view(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE news_articles SET view_count = view_count + 1 WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO news_article_views_daily (news_id, day, count)
  VALUES (p_id, (now() AT TIME ZONE 'Asia/Jakarta')::date, 1)
  ON CONFLICT (news_id, day)
  DO UPDATE SET count = news_article_views_daily.count + 1;
END;
$$;

-- Aplikasi memanggilnya dari server dengan service role; publik tidak perlu.
REVOKE ALL ON FUNCTION increment_news_view(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_news_view(uuid) TO service_role;

-- Ringkasan dibaca untuk ubin "Dibaca 30 hari" (hari ini termasuk, WIB).
CREATE OR REPLACE FUNCTION news_views_summary()
RETURNS TABLE (last30 bigint, prev30 bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date AS d)
  SELECT
    COALESCE(SUM(v.count) FILTER (WHERE v.day >  t.d - 30), 0)::bigint AS last30,
    COALESCE(SUM(v.count) FILTER (WHERE v.day <= t.d - 30), 0)::bigint AS prev30
  FROM today t
  LEFT JOIN news_article_views_daily v ON v.day > t.d - 60;
$$;

REVOKE ALL ON FUNCTION news_views_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION news_views_summary() TO service_role;

COMMIT;

-- Muat ulang cache skema PostgREST supaya kolom & fungsi baru langsung terbaca.
NOTIFY pgrst, 'reload schema';
