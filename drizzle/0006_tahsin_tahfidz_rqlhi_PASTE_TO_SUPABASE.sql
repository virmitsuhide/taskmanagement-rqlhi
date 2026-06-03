-- ============================================================
-- PHASE 7 — Tahsin & Tahfidz RQ LHI — STEP 2 dari 2 (OBJEK + BACKFILL)
-- ============================================================
-- 📋 CARA PAKAI:
--    1. WAJIB jalankan STEP 1 dulu: 0006a_enums_PASTE_TO_SUPABASE.sql
--       (sampai sukses — nilai enum baru harus commit dulu).
--    2. Baru paste & Run file ini.
--
--    Pemisahan ini wajib karena SQL Editor membungkus skrip dalam 1 transaksi,
--    sedangkan nilai enum baru (mis. 'ziyadah') tak boleh dipakai di transaksi
--    yang sama saat ia ditambahkan → error 55P04. STEP 1 meng-commit enum,
--    STEP 2 (transaksi baru) aman memakainya di UPDATE backfill.
-- ============================================================

-- jilid_levels: tahap terakhir = "Lulus Tahsin"
ALTER TABLE "jilid_levels"
  ADD COLUMN IF NOT EXISTS "is_terminal" boolean DEFAULT false NOT NULL;

-- TASMI LOGS (setoran 3 / 5 juz sekaligus)
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

CREATE INDEX IF NOT EXISTS "idx_tasmi_logs_student"      ON "tasmi_logs"("student_id", "setoran_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_tasmi_logs_teacher_date" ON "tasmi_logs"("teacher_id", "setoran_date" DESC);
ALTER TABLE "tasmi_logs" ENABLE ROW LEVEL SECURITY;

-- Trigger agregasi juz: hanya ziyadah (hafalan baru) yang menambah ayat_hafal.
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

-- BACKFILL istilah lama → baru (aman: nilai enum sudah di-commit di STEP 1)
UPDATE "tahfidz_logs" SET "kind" = 'ziyadah'       WHERE "kind" = 'hafalan_baru';
UPDATE "tahfidz_logs" SET "kind" = 'murojaah_baru' WHERE "kind" = 'murojaah';

-- Verifikasi:
--   SELECT unnest(enum_range(NULL::jenjang));       -- harus memuat sd_juara
--   SELECT unnest(enum_range(NULL::tahfidz_kind));  -- ziyadah, murojaah_baru, murojaah_lama, tasmi
--   SELECT count(*) FROM tasmi_logs;                -- 0, tabel ada
--   SELECT label, is_terminal FROM jilid_levels LIMIT 5;

-- Daftarkan ke drizzle_migrations supaya `npm run db:migrate` tidak apply ulang
CREATE TABLE IF NOT EXISTS drizzle_migrations (
  id         serial PRIMARY KEY,
  tag        text UNIQUE NOT NULL,
  applied_at timestamptz DEFAULT now()
);
INSERT INTO drizzle_migrations (tag) VALUES ('0006_tahsin_tahfidz_rqlhi')
ON CONFLICT (tag) DO NOTHING;
