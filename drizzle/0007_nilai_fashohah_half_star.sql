-- ============================================================
-- PHASE 8 — Penilaian: rename makhraj→fashohah + dukung setengah bintang
--   • nilai_makhraj  → nilai_fashohah (tahsin_logs, tahfidz_logs, tasmi_logs)
--   • smallint (1-5) → numeric(2,1) supaya bisa 0.5 (mis. 4.5, 3.5)
--   • CHECK baru: 0.5–5 kelipatan 0.5
-- Aman dalam 1 transaksi (tidak ada perubahan enum).
-- ============================================================

-- ── tahsin_logs ────────────────────────────────────────────────
ALTER TABLE "tahsin_logs" DROP CONSTRAINT IF EXISTS "tahsin_logs_nilai_makhraj_check";
--> statement-breakpoint
ALTER TABLE "tahsin_logs" DROP CONSTRAINT IF EXISTS "tahsin_logs_nilai_tajwid_check";
--> statement-breakpoint
ALTER TABLE "tahsin_logs" DROP CONSTRAINT IF EXISTS "tahsin_logs_nilai_kelancaran_check";
--> statement-breakpoint
ALTER TABLE "tahsin_logs" RENAME COLUMN "nilai_makhraj" TO "nilai_fashohah";
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ALTER COLUMN "nilai_fashohah"   TYPE numeric(2,1) USING "nilai_fashohah"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ALTER COLUMN "nilai_tajwid"     TYPE numeric(2,1) USING "nilai_tajwid"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ALTER COLUMN "nilai_kelancaran" TYPE numeric(2,1) USING "nilai_kelancaran"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_nilai_fashohah_check"   CHECK ("nilai_fashohah"   >= 0.5 AND "nilai_fashohah"   <= 5 AND "nilai_fashohah"   * 2 = floor("nilai_fashohah"   * 2));
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_nilai_tajwid_check"     CHECK ("nilai_tajwid"     >= 0.5 AND "nilai_tajwid"     <= 5 AND "nilai_tajwid"     * 2 = floor("nilai_tajwid"     * 2));
--> statement-breakpoint
ALTER TABLE "tahsin_logs" ADD CONSTRAINT "tahsin_logs_nilai_kelancaran_check" CHECK ("nilai_kelancaran" >= 0.5 AND "nilai_kelancaran" <= 5 AND "nilai_kelancaran" * 2 = floor("nilai_kelancaran" * 2));
--> statement-breakpoint

-- ── tahfidz_logs ───────────────────────────────────────────────
ALTER TABLE "tahfidz_logs" DROP CONSTRAINT IF EXISTS "tahfidz_logs_nilai_makhraj_check";
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" DROP CONSTRAINT IF EXISTS "tahfidz_logs_nilai_tajwid_check";
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" DROP CONSTRAINT IF EXISTS "tahfidz_logs_nilai_kelancaran_check";
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" RENAME COLUMN "nilai_makhraj" TO "nilai_fashohah";
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ALTER COLUMN "nilai_fashohah"   TYPE numeric(2,1) USING "nilai_fashohah"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ALTER COLUMN "nilai_tajwid"     TYPE numeric(2,1) USING "nilai_tajwid"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ALTER COLUMN "nilai_kelancaran" TYPE numeric(2,1) USING "nilai_kelancaran"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_nilai_fashohah_check"   CHECK ("nilai_fashohah"   >= 0.5 AND "nilai_fashohah"   <= 5 AND "nilai_fashohah"   * 2 = floor("nilai_fashohah"   * 2));
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_nilai_tajwid_check"     CHECK ("nilai_tajwid"     >= 0.5 AND "nilai_tajwid"     <= 5 AND "nilai_tajwid"     * 2 = floor("nilai_tajwid"     * 2));
--> statement-breakpoint
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_nilai_kelancaran_check" CHECK ("nilai_kelancaran" >= 0.5 AND "nilai_kelancaran" <= 5 AND "nilai_kelancaran" * 2 = floor("nilai_kelancaran" * 2));
--> statement-breakpoint

-- ── tasmi_logs ─────────────────────────────────────────────────
ALTER TABLE "tasmi_logs" DROP CONSTRAINT IF EXISTS "tasmi_logs_nilai_makhraj_check";
--> statement-breakpoint
ALTER TABLE "tasmi_logs" DROP CONSTRAINT IF EXISTS "tasmi_logs_nilai_tajwid_check";
--> statement-breakpoint
ALTER TABLE "tasmi_logs" DROP CONSTRAINT IF EXISTS "tasmi_logs_nilai_kelancaran_check";
--> statement-breakpoint
ALTER TABLE "tasmi_logs" RENAME COLUMN "nilai_makhraj" TO "nilai_fashohah";
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ALTER COLUMN "nilai_fashohah"   TYPE numeric(2,1) USING "nilai_fashohah"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ALTER COLUMN "nilai_tajwid"     TYPE numeric(2,1) USING "nilai_tajwid"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ALTER COLUMN "nilai_kelancaran" TYPE numeric(2,1) USING "nilai_kelancaran"::numeric(2,1);
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_nilai_fashohah_check"   CHECK ("nilai_fashohah"   >= 0.5 AND "nilai_fashohah"   <= 5 AND "nilai_fashohah"   * 2 = floor("nilai_fashohah"   * 2));
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_nilai_tajwid_check"     CHECK ("nilai_tajwid"     >= 0.5 AND "nilai_tajwid"     <= 5 AND "nilai_tajwid"     * 2 = floor("nilai_tajwid"     * 2));
--> statement-breakpoint
ALTER TABLE "tasmi_logs" ADD CONSTRAINT "tasmi_logs_nilai_kelancaran_check" CHECK ("nilai_kelancaran" >= 0.5 AND "nilai_kelancaran" <= 5 AND "nilai_kelancaran" * 2 = floor("nilai_kelancaran" * 2));
