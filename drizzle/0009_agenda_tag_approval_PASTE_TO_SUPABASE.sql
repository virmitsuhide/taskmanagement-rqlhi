-- ============================================================
-- Tag notulen rapat — tambah 'approval', ganti 'hasil_diskusi' → 'perlu_diskusi'
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Aman dalam 1 transaksi & idempoten (boleh dijalankan ulang).
--
-- Enum di-rebuild, bukan ALTER TYPE ... ADD VALUE, karena:
--   1. Postgres tidak bisa MENGHAPUS nilai enum ('hasil_diskusi' harus hilang).
--   2. Nilai enum yang baru ditambah tidak boleh dipakai di UPDATE pada
--      transaksi yang sama (error 55P04) — rebuild menghindari itu.
--
-- Baris lama bertag 'hasil_diskusi' otomatis dikonversi ke 'perlu_diskusi'.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agenda_tag')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'agenda_tag' AND e.enumlabel = 'approval'
     )
  THEN
    CREATE TYPE "agenda_tag_new" AS ENUM ('keputusan', 'informasi', 'perlu_diskusi', 'tindak_lanjut', 'approval');

    ALTER TABLE "agenda_items"
      ALTER COLUMN "tag" TYPE "agenda_tag_new"
      USING (CASE "tag"::text WHEN 'hasil_diskusi' THEN 'perlu_diskusi' ELSE "tag"::text END)::"agenda_tag_new";

    DROP TYPE "agenda_tag";
    ALTER TYPE "agenda_tag_new" RENAME TO "agenda_tag";
  END IF;
END $$;

-- Verifikasi:
--   SELECT unnest(enum_range(NULL::agenda_tag));
--   -- harus: keputusan, informasi, perlu_diskusi, tindak_lanjut, approval
--   SELECT tag, count(*) FROM agenda_items GROUP BY tag;

-- Daftarkan ke drizzle_migrations
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id serial PRIMARY KEY, tag text UNIQUE NOT NULL, applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0009_agenda_tag_approval')
ON CONFLICT (tag) DO NOTHING;
