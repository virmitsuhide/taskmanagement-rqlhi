-- Tag notulen rapat: + 'approval', 'hasil_diskusi' → 'perlu_diskusi'.
-- Enum di-rebuild (bukan ALTER TYPE ADD VALUE) supaya nilai lama benar-benar
-- hilang dan seluruh perubahan aman dalam satu transaksi (tanpa error 55P04).
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
