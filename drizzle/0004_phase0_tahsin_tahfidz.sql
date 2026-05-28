-- ============================================================
-- PHASE 0 — Foundation untuk modul Tahsin & Tahfidz
-- Tabel: teachers, halaqoh, students, tahsin_methods, jilid_levels,
--        surat_master, tahsin_logs, tahfidz_logs, jilid_promotions,
--        juz_progress, juz_promotions
-- ============================================================

-- ENUMS ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE gender AS ENUM ('L','P');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE jenjang AS ENUM ('paud','sd','smp','sma');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE tahsin_status AS ENUM ('lulus','ulang');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE tahfidz_kind AS ENUM ('hafalan_baru','murojaah');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- TAHSIN METHODS ---------------------------------------------------
-- e.g. Tilawati, Ummi, Iqro
CREATE TABLE IF NOT EXISTS "tahsin_methods" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text UNIQUE NOT NULL,
  "description" text,
  "is_active"   boolean DEFAULT true NOT NULL,
  "created_at"  timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- JILID LEVELS -----------------------------------------------------
-- Level/jilid per metode. Misal Tilawati: Jilid 1..6, Al-Qur'an
CREATE TABLE IF NOT EXISTS "jilid_levels" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "method_id"     uuid NOT NULL REFERENCES "tahsin_methods"("id") ON DELETE CASCADE,
  "label"         text NOT NULL,
  "order_num"     int  NOT NULL,
  "total_pages"   int,
  "is_quran"      boolean DEFAULT false NOT NULL,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("method_id", "order_num")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jilid_levels_method" ON "jilid_levels"("method_id");
--> statement-breakpoint

-- SURAT MASTER (114 surat Al-Qur'an) -------------------------------
CREATE TABLE IF NOT EXISTS "surat_master" (
  "id"            int PRIMARY KEY,
  "name_arabic"   text NOT NULL,
  "name_latin"    text NOT NULL,
  "name_id"       text NOT NULL,
  "total_ayat"    int  NOT NULL,
  "juz_start"     int  NOT NULL,
  "juz_end"       int  NOT NULL,
  "is_makkiyah"   boolean NOT NULL
);
--> statement-breakpoint

-- TEACHERS (entity terpisah dari users) ----------------------------
-- Guru pakai login sendiri di /guru/login dengan username + password
CREATE TABLE IF NOT EXISTS "teachers" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "username"            text UNIQUE NOT NULL,
  "password_hash"       text NOT NULL,
  "full_name"           text NOT NULL,
  "nip"                 text,
  "email"               text,
  "phone"               text,
  "photo_url"           text,
  "is_active"           boolean DEFAULT true NOT NULL,
  "can_change_password" boolean DEFAULT true NOT NULL,
  "joined_at"           date DEFAULT CURRENT_DATE NOT NULL,
  "linked_user_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          timestamptz DEFAULT now() NOT NULL,
  "updated_at"          timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teachers_username" ON "teachers"("username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teachers_linked_user" ON "teachers"("linked_user_id");
--> statement-breakpoint

-- HALAQOH ----------------------------------------------------------
-- Kelompok belajar — punya satu wali guru utama
CREATE TABLE IF NOT EXISTS "halaqoh" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"          text NOT NULL,
  "jenjang"       jenjang NOT NULL,
  "wali_teacher_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "schedule_note" text,
  "is_active"     boolean DEFAULT true NOT NULL,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  "updated_at"    timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_halaqoh_wali" ON "halaqoh"("wali_teacher_id");
--> statement-breakpoint

-- HALAQOH ↔ TEACHERS (banyak guru bisa ngajar satu halaqoh) --------
CREATE TABLE IF NOT EXISTS "halaqoh_teachers" (
  "halaqoh_id"  uuid NOT NULL REFERENCES "halaqoh"("id") ON DELETE CASCADE,
  "teacher_id"  uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "role"        text DEFAULT 'pengampu' NOT NULL,
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("halaqoh_id", "teacher_id")
);
--> statement-breakpoint

-- STUDENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "students" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nis"                text UNIQUE,
  "full_name"          text NOT NULL,
  "gender"             gender,
  "birth_date"         date,
  "photo_url"          text,
  "jenjang"            jenjang NOT NULL,
  "kelas"              text,
  "halaqoh_id"         uuid REFERENCES "halaqoh"("id") ON DELETE SET NULL,
  "wali_name"          text,
  "wali_phone"         text,
  "wali_email"         text,
  "current_method_id"  uuid REFERENCES "tahsin_methods"("id") ON DELETE SET NULL,
  "current_jilid_id"   uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  "current_jilid_page" int,
  "is_active"          boolean DEFAULT true NOT NULL,
  "enrolled_at"        date DEFAULT CURRENT_DATE NOT NULL,
  "created_at"         timestamptz DEFAULT now() NOT NULL,
  "updated_at"         timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_students_halaqoh" ON "students"("halaqoh_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_students_jenjang" ON "students"("jenjang");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_students_active" ON "students"("is_active");
--> statement-breakpoint

-- TAHSIN LOGS (setoran tahsin harian) ------------------------------
CREATE TABLE IF NOT EXISTS "tahsin_logs" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"     uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "teacher_id"     uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
  "halaqoh_id"     uuid REFERENCES "halaqoh"("id") ON DELETE SET NULL,
  "setoran_date"   date DEFAULT CURRENT_DATE NOT NULL,
  "method_id"      uuid REFERENCES "tahsin_methods"("id") ON DELETE SET NULL,
  "jilid_id"       uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  "halaman"        int,
  "baris_dari"     int,
  "baris_ke"       int,
  "nilai_makhraj"  smallint CHECK (nilai_makhraj BETWEEN 1 AND 5),
  "nilai_tajwid"   smallint CHECK (nilai_tajwid  BETWEEN 1 AND 5),
  "nilai_kelancaran" smallint CHECK (nilai_kelancaran BETWEEN 1 AND 5),
  "status"         tahsin_status DEFAULT 'lulus' NOT NULL,
  "catatan"        text,
  "created_at"     timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahsin_logs_student" ON "tahsin_logs"("student_id", "setoran_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahsin_logs_teacher_date" ON "tahsin_logs"("teacher_id", "setoran_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahsin_logs_date" ON "tahsin_logs"("setoran_date" DESC);
--> statement-breakpoint

-- JILID PROMOTIONS (riwayat kenaikan jilid) ------------------------
CREATE TABLE IF NOT EXISTS "jilid_promotions" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"    uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "from_jilid_id" uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  "to_jilid_id"   uuid NOT NULL REFERENCES "jilid_levels"("id") ON DELETE RESTRICT,
  "promoted_by"   uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "promotion_date" date DEFAULT CURRENT_DATE NOT NULL,
  "exam_score"    numeric(5,2),
  "catatan"       text,
  "created_at"    timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jilid_prom_student" ON "jilid_promotions"("student_id", "promotion_date" DESC);
--> statement-breakpoint

-- TAHFIDZ LOGS (setoran tahfidz harian) ----------------------------
CREATE TABLE IF NOT EXISTS "tahfidz_logs" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"     uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "teacher_id"     uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
  "halaqoh_id"     uuid REFERENCES "halaqoh"("id") ON DELETE SET NULL,
  "setoran_date"   date DEFAULT CURRENT_DATE NOT NULL,
  "kind"           tahfidz_kind DEFAULT 'hafalan_baru' NOT NULL,
  "surat_id"       int  NOT NULL REFERENCES "surat_master"("id") ON DELETE RESTRICT,
  "ayat_dari"      int  NOT NULL,
  "ayat_ke"        int  NOT NULL,
  "nilai_makhraj"  smallint CHECK (nilai_makhraj BETWEEN 1 AND 5),
  "nilai_tajwid"   smallint CHECK (nilai_tajwid  BETWEEN 1 AND 5),
  "nilai_kelancaran" smallint CHECK (nilai_kelancaran BETWEEN 1 AND 5),
  "catatan"        text,
  "created_at"     timestamptz DEFAULT now() NOT NULL,
  CHECK (ayat_ke >= ayat_dari)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahfidz_logs_student" ON "tahfidz_logs"("student_id", "setoran_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahfidz_logs_teacher_date" ON "tahfidz_logs"("teacher_id", "setoran_date" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tahfidz_logs_surat" ON "tahfidz_logs"("surat_id");
--> statement-breakpoint

-- JUZ PROGRESS (agregat hafalan per siswa & juz) -------------------
-- Diperbarui via trigger setiap kali tahfidz_logs di-insert
CREATE TABLE IF NOT EXISTS "juz_progress" (
  "student_id"    uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "juz_number"    int  NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  "ayat_hafal"    int  DEFAULT 0 NOT NULL,
  "last_setoran_at" timestamptz,
  "mutqin"        boolean DEFAULT false NOT NULL,
  "updated_at"    timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("student_id", "juz_number")
);
--> statement-breakpoint

-- JUZ PROMOTIONS (riwayat khatam juz) ------------------------------
CREATE TABLE IF NOT EXISTS "juz_promotions" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"    uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "juz_number"    int  NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  "promoted_by"   uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "promotion_date" date DEFAULT CURRENT_DATE NOT NULL,
  "exam_score"    numeric(5,2),
  "catatan"       text,
  "created_at"    timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("student_id", "juz_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_juz_prom_student" ON "juz_promotions"("student_id");
--> statement-breakpoint

-- UPDATED_AT TRIGGERS ----------------------------------------------
CREATE TRIGGER teachers_updated_at  BEFORE UPDATE ON "teachers"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--> statement-breakpoint
CREATE TRIGGER halaqoh_updated_at   BEFORE UPDATE ON "halaqoh"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--> statement-breakpoint
CREATE TRIGGER students_updated_at  BEFORE UPDATE ON "students"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--> statement-breakpoint
CREATE TRIGGER juz_progress_updated_at BEFORE UPDATE ON "juz_progress"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
--> statement-breakpoint

-- AGGREGATE TRIGGER ------------------------------------------------
-- Setiap tahfidz_logs insert → update juz_progress ayat_hafal
-- Catatan: ini menambah, tidak mengurangi. Untuk koreksi (delete log),
-- aplikasi sebaiknya recompute manual via server action.
CREATE OR REPLACE FUNCTION upsert_juz_progress_from_tahfidz()
RETURNS trigger AS $$
DECLARE
  v_juz_start int;
  v_ayat_count int;
BEGIN
  IF NEW.kind <> 'hafalan_baru' THEN
    RETURN NEW;
  END IF;

  SELECT juz_start INTO v_juz_start FROM surat_master WHERE id = NEW.surat_id;
  v_ayat_count := NEW.ayat_ke - NEW.ayat_dari + 1;

  INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
  VALUES (NEW.student_id, v_juz_start, v_ayat_count, now(), now())
  ON CONFLICT (student_id, juz_number)
  DO UPDATE SET
    ayat_hafal       = juz_progress.ayat_hafal + EXCLUDED.ayat_hafal,
    last_setoran_at  = EXCLUDED.last_setoran_at,
    updated_at       = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER tahfidz_logs_aggregate
  AFTER INSERT ON "tahfidz_logs"
  FOR EACH ROW EXECUTE FUNCTION upsert_juz_progress_from_tahfidz();
--> statement-breakpoint

-- RLS (off di app, tapi enable untuk extra safety) -----------------
ALTER TABLE "teachers"          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "halaqoh"           ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "halaqoh_teachers"  ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "students"          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tahsin_methods"    ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jilid_levels"      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "surat_master"      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tahsin_logs"       ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tahfidz_logs"      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jilid_promotions"  ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "juz_promotions"    ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "juz_progress"      ENABLE ROW LEVEL SECURITY;
