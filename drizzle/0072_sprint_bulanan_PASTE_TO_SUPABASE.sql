-- ============================================================
-- Sprint bulanan — Scrum yang tersambung dengan Gantt
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • sprints        → BARU, satu baris per bulan kalender, seluruh RQ
--   • sprint_goals   → BARU, Sprint Goal + review + retrospektif PER JABATAN
--   • sprint_items   → BARU, tugas yang disanggupi sebuah jabatan di sprint itu
--
-- ── BENTUKNYA ───────────────────────────────────────────────
--
-- Scrum Guide 2020 membatasi sprint paling lama satu bulan. RQ memakai tepat
-- satu bulan kalender, sejalan dengan ritme yang sudah ada: Laporan BPH, KPI,
-- dan rangkuman capaian siswa semuanya bulanan.
--
--   Gantt  = rencana panjang (tugas boleh membentang berbulan-bulan)
--   Sprint = janji bulan ini: potongan dari Gantt yang benar-benar disanggupi
--
-- Keputusan RQ (2026-09-17):
--   • Product Owner = Kepala RQ — dialah yang mengesahkan Sprint Goal.
--   • Sprint Goal dibuat per JABATAN, bukan per orang: sejalan dengan Gantt
--     yang memantau amanah. Satu jabatan yang dipegang dua orang berbagi satu
--     goal dan satu daftar komitmen.
--
-- ── STATUS SPRINT TIDAK DISIMPAN ────────────────────────────
--
-- Perencanaan / berjalan / menunggu penutupan diturunkan dari tanggal hari
-- ini terhadap `periode`. Yang disimpan hanya penutupannya (ditutup_at),
-- karena menutup adalah keputusan Kepala RQ, bukan akibat kalender.
--
-- ── KENAPA ADA POTRET SAAT DITUTUP ──────────────────────────
--
-- Status tugas terus bergerak setelah bulannya lewat. Tanpa potret, laporan
-- sprint Agustus yang dibuka bulan Oktober akan menghitung tugas yang baru
-- selesai September sebagai "selesai di Agustus" — dan angka komitmen
-- terpenuhi naik sendiri seiring waktu. status_saat_tutup & poin membekukan
-- apa yang benar-benar terjadi di bulan itu.
--
-- ── TUGAS YANG TIDAK SELESAI ────────────────────────────────
--
-- Mengikuti Scrum Guide: tidak dipindahkan otomatis ke bulan berikutnya. Ia
-- kembali ke backlog dan muncul sebagai SARAN di perencanaan bulan depan
-- dengan tanda "terbawa N bulan"; menyanggupinya lagi adalah keputusan sadar.
-- ============================================================

CREATE TABLE IF NOT EXISTS "sprints" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Selalu tanggal 1 bulan itu.
  "periode"     date NOT NULL UNIQUE CHECK (EXTRACT(DAY FROM "periode") = 1),
  "ditutup_at"  timestamptz,
  "ditutup_by"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sprint_goals" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sprint_id"       uuid NOT NULL REFERENCES "sprints"("id") ON DELETE CASCADE,
  "jabatan"         user_role NOT NULL,
  "goal"            text NOT NULL DEFAULT '',
  -- Pengesahan Product Owner. Mengubah goal setelah disahkan melepas
  -- pengesahannya (dijaga aplikasi), supaya yang disahkan selalu yang tertulis.
  "disahkan_at"     timestamptz,
  "disahkan_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  -- Review akhir bulan.
  "hasil"           text CHECK ("hasil" IN ('tercapai', 'sebagian', 'tidak')),
  "catatan_review"  text NOT NULL DEFAULT '',
  -- Retrospektif: tiga pertanyaan singkat.
  "retro_baik"      text NOT NULL DEFAULT '',
  "retro_hambatan"  text NOT NULL DEFAULT '',
  "retro_ubah"      text NOT NULL DEFAULT '',
  "updated_by"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sprint_goals_satu_per_jabatan" UNIQUE ("sprint_id", "jabatan")
);

CREATE TABLE IF NOT EXISTS "sprint_items" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sprint_id"          uuid NOT NULL REFERENCES "sprints"("id") ON DELETE CASCADE,
  "task_id"            uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  -- Jabatan yang menyanggupi, dibekukan saat itu: tugas bisa dialihkan ke
  -- jabatan lain kemudian, tapi komitmen bulan ini tetap milik yang berjanji.
  "jabatan"            user_role NOT NULL,
  -- Bobot tugas saat disanggupi: mudah 1, sedang 2, sulit 3.
  "poin"               smallint NOT NULL CHECK ("poin" BETWEEN 1 AND 3),
  -- Disanggupi setelah pekan pertama bulan berjalan — scope yang masuk di
  -- tengah sprint, dilaporkan terpisah di review.
  "tengah_sprint"      boolean NOT NULL DEFAULT false,
  -- Potret saat sprint ditutup. NULL = sprint belum ditutup.
  "status_saat_tutup"  task_status,
  "created_by"         uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sprint_items_sekali_per_sprint" UNIQUE ("sprint_id", "task_id")
);

CREATE INDEX IF NOT EXISTS "sprint_items_task_idx" ON "sprint_items" ("task_id");

ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sprint_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sprint_items" ENABLE ROW LEVEL SECURITY;
