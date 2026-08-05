-- ============================================================
-- BASELINE MARKER — jangan dijalankan manual / paste ke SQL Editor.
-- ============================================================
-- File ini auto-generated oleh `drizzle-kit generate` dari lib/db/schema.ts
-- setelah schema.ts disinkronkan penuh dengan kondisi live DB (Agustus 2026).
-- Isinya mendeskripsikan SELURUH skema (25 tabel) yang SUDAH ADA di database
-- lewat migration 0000-0007 (base + *_PASTE_TO_SUPABASE) sebelumnya.
--
-- Tag "0008_baseline_full_schema" sudah didaftarkan sebagai applied di tabel
-- drizzle_migrations — scripts/migrate.ts akan skip file ini otomatis.
-- TIDAK ADA "IF NOT EXISTS" di statement-statement di bawah (default output
-- drizzle-kit generate), jadi menjalankannya ulang terhadap DB yang sudah
-- berisi tabel-tabel ini AKAN GAGAL (relation already exists).
--
-- Tujuan file ini murni supaya drizzle/meta/_journal.json + snapshot punya
-- titik awal (baseline) yang akurat, sehingga `npm run db:generate` ke depan
-- bisa diff dengan benar terhadap kondisi schema.ts saat ini. Perubahan
-- schema berikutnya akan menghasilkan migration baru (0009, dst) yang PERLU
-- benar-benar dijalankan via `npm run db:migrate`.
-- ============================================================
CREATE TYPE "public"."agenda_tag" AS ENUM('keputusan', 'informasi', 'hasil_diskusi', 'tindak_lanjut');--> statement-breakpoint
CREATE TYPE "public"."content_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."content_request_type" AS ENUM('flyer_ujian', 'flyer_lain', 'video', 'lain_lain');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('requested', 'on_process', 'finish');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('L', 'P');--> statement-breakpoint
CREATE TYPE "public"."jenjang" AS ENUM('paud', 'sd', 'smp', 'sma', 'sd_juara');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('manajemen', 'kumik', 'new_squad', 'koor_sd', 'koor_smp');--> statement-breakpoint
CREATE TYPE "public"."public_post_type" AS ENUM('pengumuman', 'tugas_guru');--> statement-breakpoint
CREATE TYPE "public"."public_target" AS ENUM('all', 'sd', 'smp');--> statement-breakpoint
CREATE TYPE "public"."tahfidz_kind" AS ENUM('hafalan_baru', 'murojaah', 'ziyadah', 'murojaah_baru', 'murojaah_lama', 'tasmi');--> statement-breakpoint
CREATE TYPE "public"."tahsin_status" AS ENUM('lulus', 'ulang');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('normal', 'mendesak', 'jangka_panjang');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('rapat', 'mandiri', 'home_publik');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'submitted', 'done', 'returned');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'humas', 'div_training', 'new_squad');--> statement-breakpoint
CREATE TABLE "about_rq" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"vision" text DEFAULT '',
	"mission" text DEFAULT '',
	"history" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agenda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid,
	"order_num" integer NOT NULL,
	"tag" "agenda_tag" NOT NULL,
	"discussion" text NOT NULL,
	"follow_up" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type" "content_request_type" NOT NULL,
	"description" text NOT NULL,
	"requested_by" uuid,
	"requested_date" date NOT NULL,
	"priority" "content_priority",
	"status" "content_status" DEFAULT 'requested',
	"finished_by" uuid,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "halaqoh" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"jenjang" "jenjang" NOT NULL,
	"wali_teacher_id" uuid,
	"schedule_note" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "halaqoh_teachers" (
	"halaqoh_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"role" text DEFAULT 'pengampu',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "halaqoh_teachers_halaqoh_id_teacher_id_pk" PRIMARY KEY("halaqoh_id","teacher_id")
);
--> statement-breakpoint
CREATE TABLE "jilid_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method_id" uuid NOT NULL,
	"label" text NOT NULL,
	"order_num" integer NOT NULL,
	"total_pages" integer,
	"is_quran" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_terminal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jilid_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"from_jilid_id" uuid,
	"to_jilid_id" uuid NOT NULL,
	"promoted_by" uuid,
	"promotion_date" date DEFAULT now(),
	"exam_score" numeric,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "juz_progress" (
	"student_id" uuid NOT NULL,
	"juz_number" integer NOT NULL,
	"ayat_hafal" integer DEFAULT 0 NOT NULL,
	"last_setoran_at" timestamp with time zone,
	"mutqin" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "juz_progress_student_id_juz_number_pk" PRIMARY KEY("student_id","juz_number")
);
--> statement-breakpoint
CREATE TABLE "juz_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"juz_number" integer NOT NULL,
	"promoted_by" uuid,
	"promotion_date" date DEFAULT now(),
	"exam_score" numeric,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "meeting_type" NOT NULL,
	"subject" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"location" text,
	"mc" text,
	"notulis" text,
	"participants" text[],
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"thumbnail_url" text,
	"category" text,
	"type" text DEFAULT 'berita' NOT NULL,
	"author_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "private_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "program_details" (
	"slug" text PRIMARY KEY NOT NULL,
	"long_description" text DEFAULT '',
	"curriculum" text DEFAULT '',
	"schedule" text DEFAULT '',
	"target_audience" text DEFAULT '',
	"contact_info" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "public_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "public_post_type" NOT NULL,
	"target" "public_target" DEFAULT 'all' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"due_date" date,
	"created_by" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nis" text,
	"full_name" text NOT NULL,
	"gender" "gender",
	"birth_date" date,
	"photo_url" text,
	"jenjang" "jenjang" NOT NULL,
	"kelas" text,
	"halaqoh_id" uuid,
	"wali_name" text,
	"wali_phone" text,
	"wali_email" text,
	"current_method_id" uuid,
	"current_jilid_id" uuid,
	"current_jilid_page" integer,
	"is_active" boolean DEFAULT true,
	"enrolled_at" date DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "surat_master" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_arabic" text NOT NULL,
	"name_latin" text NOT NULL,
	"name_id" text NOT NULL,
	"total_ayat" integer NOT NULL,
	"juz_start" integer NOT NULL,
	"juz_end" integer NOT NULL,
	"is_makkiyah" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tahfidz_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"halaqoh_id" uuid,
	"setoran_date" date DEFAULT now(),
	"kind" "tahfidz_kind" DEFAULT 'hafalan_baru' NOT NULL,
	"surat_id" integer NOT NULL,
	"ayat_dari" integer,
	"ayat_ke" integer,
	"nilai_fashohah" numeric(2, 1),
	"nilai_tajwid" numeric(2, 1),
	"nilai_kelancaran" numeric(2, 1),
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tahsin_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"halaqoh_id" uuid,
	"setoran_date" date DEFAULT now(),
	"method_id" uuid,
	"jilid_id" uuid,
	"halaman" integer,
	"baris_dari" integer,
	"baris_ke" integer,
	"nilai_fashohah" numeric(2, 1),
	"nilai_tajwid" numeric(2, 1),
	"nilai_kelancaran" numeric(2, 1),
	"status" "tahsin_status" DEFAULT 'lulus',
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tahsin_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"mentions" uuid[],
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"changed_by" uuid,
	"old_status" "task_status",
	"new_status" "task_status" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_type" "task_source" NOT NULL,
	"source_meeting_id" uuid,
	"source_agenda_id" uuid,
	"assigned_by" uuid,
	"assigned_to" uuid,
	"public_target" "public_target",
	"priority" "task_priority" DEFAULT 'normal',
	"status" "task_status" DEFAULT 'todo',
	"due_date" date,
	"return_notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasmi_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"halaqoh_id" uuid,
	"setoran_date" date DEFAULT now(),
	"scope_juz" smallint NOT NULL,
	"juz_from" integer NOT NULL,
	"juz_to" integer NOT NULL,
	"nilai_fashohah" numeric(2, 1),
	"nilai_tajwid" numeric(2, 1),
	"nilai_kelancaran" numeric(2, 1),
	"status" "tahsin_status" DEFAULT 'lulus',
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"nip" text,
	"email" text,
	"phone" text,
	"photo_url" text,
	"is_active" boolean DEFAULT true,
	"can_change_password" boolean DEFAULT true,
	"joined_at" date DEFAULT now(),
	"linked_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"can_change_password" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "about_rq" ADD CONSTRAINT "about_rq_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_finished_by_users_id_fk" FOREIGN KEY ("finished_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "halaqoh" ADD CONSTRAINT "halaqoh_wali_teacher_id_teachers_id_fk" FOREIGN KEY ("wali_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "halaqoh_teachers" ADD CONSTRAINT "halaqoh_teachers_halaqoh_id_halaqoh_id_fk" FOREIGN KEY ("halaqoh_id") REFERENCES "public"."halaqoh"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "halaqoh_teachers" ADD CONSTRAINT "halaqoh_teachers_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jilid_levels" ADD CONSTRAINT "jilid_levels_method_id_tahsin_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."tahsin_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jilid_promotions" ADD CONSTRAINT "jilid_promotions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jilid_promotions" ADD CONSTRAINT "jilid_promotions_from_jilid_id_jilid_levels_id_fk" FOREIGN KEY ("from_jilid_id") REFERENCES "public"."jilid_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jilid_promotions" ADD CONSTRAINT "jilid_promotions_to_jilid_id_jilid_levels_id_fk" FOREIGN KEY ("to_jilid_id") REFERENCES "public"."jilid_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jilid_promotions" ADD CONSTRAINT "jilid_promotions_promoted_by_teachers_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juz_progress" ADD CONSTRAINT "juz_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juz_promotions" ADD CONSTRAINT "juz_promotions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juz_promotions" ADD CONSTRAINT "juz_promotions_promoted_by_teachers_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_notes" ADD CONSTRAINT "private_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_details" ADD CONSTRAINT "program_details_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_posts" ADD CONSTRAINT "public_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_halaqoh_id_halaqoh_id_fk" FOREIGN KEY ("halaqoh_id") REFERENCES "public"."halaqoh"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_current_method_id_tahsin_methods_id_fk" FOREIGN KEY ("current_method_id") REFERENCES "public"."tahsin_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_current_jilid_id_jilid_levels_id_fk" FOREIGN KEY ("current_jilid_id") REFERENCES "public"."jilid_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_halaqoh_id_halaqoh_id_fk" FOREIGN KEY ("halaqoh_id") REFERENCES "public"."halaqoh"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_surat_id_surat_master_id_fk" FOREIGN KEY ("surat_id") REFERENCES "public"."surat_master"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_halaqoh_id_halaqoh_id_fk" FOREIGN KEY ("halaqoh_id") REFERENCES "public"."halaqoh"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_method_id_tahsin_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."tahsin_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_jilid_id_jilid_levels_id_fk" FOREIGN KEY ("jilid_id") REFERENCES "public"."jilid_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_meeting_id_meetings_id_fk" FOREIGN KEY ("source_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_agenda_id_agenda_items_id_fk" FOREIGN KEY ("source_agenda_id") REFERENCES "public"."agenda_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_halaqoh_id_halaqoh_id_fk" FOREIGN KEY ("halaqoh_id") REFERENCES "public"."halaqoh"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;