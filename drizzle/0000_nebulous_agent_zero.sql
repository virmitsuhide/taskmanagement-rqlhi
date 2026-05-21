CREATE TYPE "public"."agenda_tag" AS ENUM('keputusan', 'informasi', 'hasil_diskusi', 'tindak_lanjut');--> statement-breakpoint
CREATE TYPE "public"."content_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."content_request_type" AS ENUM('flyer_ujian', 'flyer_lain', 'video', 'lain_lain');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('requested', 'on_process', 'finish');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('manajemen', 'kumik', 'new_squad', 'koor_sd', 'koor_smp');--> statement-breakpoint
CREATE TYPE "public"."public_post_type" AS ENUM('pengumuman', 'tugas_guru');--> statement-breakpoint
CREATE TYPE "public"."public_target" AS ENUM('all', 'sd', 'smp');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('normal', 'mendesak', 'jangka_panjang');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('rapat', 'mandiri', 'home_publik');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'submitted', 'done', 'returned');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'humas', 'div_training', 'new_squad');--> statement-breakpoint
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
CREATE TABLE "private_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_finished_by_users_id_fk" FOREIGN KEY ("finished_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_notes" ADD CONSTRAINT "private_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_posts" ADD CONSTRAINT "public_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_meeting_id_meetings_id_fk" FOREIGN KEY ("source_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_agenda_id_agenda_items_id_fk" FOREIGN KEY ("source_agenda_id") REFERENCES "public"."agenda_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;