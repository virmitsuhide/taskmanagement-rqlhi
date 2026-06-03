-- ============================================================
-- PHASE 7 — Tahsin & Tahfidz sesuai metodologi RQ LHI
--   • jenjang  : tambah unit 'sd_juara' (SD LHI Juara)
--   • tahfidz_kind : ziyadah / murojaah_baru / murojaah_lama / tasmi
--   • jilid_levels.is_terminal : tahap "Lulus Tahsin"
--   • tasmi_logs  : setoran tasmi' 3 / 5 juz
--   • trigger agregasi juz : hanya 'ziyadah' yang menambah progress
-- ============================================================

-- ENUM: unit baru SD Juara -------------------------------------------
ALTER TYPE "jenjang" ADD VALUE IF NOT EXISTS 'sd_juara';
--> statement-breakpoint

-- ENUM: jenis setoran tahfidz baru -----------------------------------
ALTER TYPE "tahfidz_kind" ADD VALUE IF NOT EXISTS 'ziyadah';
--> statement-breakpoint
ALTER TYPE "tahfidz_kind" ADD VALUE IF NOT EXISTS 'murojaah_baru';
--> statement-breakpoint
ALTER TYPE "tahfidz_kind" ADD VALUE IF NOT EXISTS 'murojaah_lama';
--> statement-breakpoint
ALTER TYPE "tahfidz_kind" ADD VALUE IF NOT EXISTS 'tasmi';
--> statement-breakpoint

-- jilid_levels: tahap terakhir = Lulus Tahsin -----------------------
ALTER TABLE "jilid_levels"
  ADD COLUMN IF NOT EXISTS "is_terminal" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- TASMI LOGS (setoran 3 / 5 juz sekaligus) --------------------------
CREATE TABLE IF NOT EXISTS "tasmi_logs" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"       uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "teacher_id"       uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
  "halaqoh_id"       uuid REFERENCES "halaqoh"("id") ON DELETE SET NULL,
  "setoran_date"     date DEFAULT CURRENT_DATE NOT NULL,
  "scope_juz"        smallint NOT NULL CHECK (scope_juz IN (3, 5)),
  "juz_from"         int NOT NULL CHECK (juz_from BETWEEN 1 AND 30),
  "juz_to"           int NOT NULL CHECK (juz_to BETWEEN 1 AND 30),
  "nilai_makhraj"    smallint CHECK (nilai_makhraj BETWEEN 1 AND 5),
  "nilai_tajwid"     smallint CHECK (nilai_tajwid  BETWEEN 1 AND 5),
  "nilai_kelancaran" smallint CHECK (nilai_kelancaran BETWEEN 1 AND 5),
  "status"           tahsin_status DEFAULT 'lulus' NOT NULL,
  "catatan"          text,
  "created_at"       timestamptz DEFAULT now() NOT NULL,
  CHECK (juz_to >= juz_from),
  CHECK (juz_to - juz_from + 1 = scope_juz)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasmi_logs_student" ON "tasmi_logs"("student_id", "setoran_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasmi_logs_teacher_date" ON "tasmi_logs"("teacher_id", "setoran_date" DESC);
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Update trigger agregasi: hanya ziyadah (hafalan baru) yang menambah
-- ayat_hafal ke juz_progress. ('hafalan_baru' tetap diterima utk data lama
-- sebelum backfill di bawah dijalankan.)
CREATE OR REPLACE FUNCTION upsert_juz_progress_from_tahfidz()
RETURNS trigger AS $$
DECLARE
  v_juz_start int;
  v_ayat_count int;
BEGIN
  IF NEW.kind NOT IN ('ziyadah', 'hafalan_baru') THEN
    RETURN NEW;
  END IF;

  SELECT juz_start INTO v_juz_start FROM surat_master WHERE id = NEW.surat_id;
  v_ayat_count := NEW.ayat_ke - NEW.ayat_dari + 1;

  INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
  VALUES (NEW.student_id, v_juz_start, v_ayat_count, now(), now())
  ON CONFLICT (student_id, juz_number)
  DO UPDATE SET
    ayat_hafal      = juz_progress.ayat_hafal + EXCLUDED.ayat_hafal,
    last_setoran_at = EXCLUDED.last_setoran_at,
    updated_at      = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- BACKFILL data lama → istilah baru (jalankan SETELAH enum di atas commit)
UPDATE "tahfidz_logs" SET "kind" = 'ziyadah'       WHERE "kind" = 'hafalan_baru';
--> statement-breakpoint
UPDATE "tahfidz_logs" SET "kind" = 'murojaah_baru' WHERE "kind" = 'murojaah';
