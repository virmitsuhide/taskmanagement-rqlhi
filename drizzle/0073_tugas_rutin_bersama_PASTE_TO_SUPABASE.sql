-- ============================================================
-- Tugas rutin bersama — undangan @pengurus & konfirmasi selesai
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • routine_task_members        → BARU, pengurus yang diajak mengerjakan
--   • routine_task_checks         → + konfirmasi (selesai / menunggu / ditolak)
--   • routine_check_konfirmasi    → BARU, keputusan tiap rekan atas laporan
--
-- ── ALURNYA ─────────────────────────────────────────────────
--
-- 1. Pembuat menulis "Rekrutmen guru Qur'an bersama @SDM". Setiap @pengurus
--    yang dipilih menjadi baris routine_task_members berstatus 'menunggu'.
-- 2. Yang diajak melihat kartu undangan di halaman Tugas Rutin dan memilih
--    terima atau tolak. Yang menerima ikut memiliki tugas itu di checklistnya.
-- 3. Satu pihak melaporkan TERLAKSANA → laporan berstatus 'menunggu'. Rekan
--    lain mendapat kartu "benar sudah selesai?". Baru setelah SEMUA rekan
--    setuju, laporan menjadi 'selesai' dan tugas terhitung tercentang. Satu
--    penolakan membuat laporan 'ditolak' — pelapor melihatnya dan bisa
--    melapor ulang setelah dibicarakan.
--
-- ── KENAPA HANYA "TERLAKSANA" YANG DIKONFIRMASI ─────────────
--
-- Klaim "sudah selesai" atas pekerjaan bersama menyangkut kerja orang lain,
-- jadi perlu diiyakan. Laporan TIDAK terlaksana sudah wajib beralasan dan
-- bukan klaim atas hasil siapa pun; menahannya menunggu persetujuan hanya
-- membuat kendala terlambat sampai ke papan Kepala RQ.
--
-- ── KENAPA PEMBUAT TETAP PEMILIK TUNGGAL ────────────────────
--
-- routine_tasks.owner_id tidak berubah: pembuat yang menyunting, menghapus,
-- dan mengatur siapa yang diajak. Rekan boleh melapor, mengonfirmasi, dan
-- keluar dari tugas itu, tapi tidak mengubah isinya — sama seperti tugas
-- delegasi yang tidak disunting sepihak oleh penerimanya.
--
-- ── DEFAULT 'selesai' UNTUK BARIS LAMA ──────────────────────
--
-- Semua laporan yang sudah ada berasal dari tugas pribadi, yang memang tidak
-- butuh konfirmasi siapa pun. Default itu membuat seluruh riwayat tetap
-- terbaca persis seperti sebelum migrasi ini.
-- ============================================================

CREATE TABLE IF NOT EXISTS "routine_task_members" (
  "task_id"      uuid NOT NULL REFERENCES "routine_tasks"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"       text NOT NULL DEFAULT 'menunggu' CHECK ("status" IN ('menunggu', 'diterima', 'ditolak')),
  "invited_by"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "responded_at" timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("task_id", "user_id")
);

-- Pola query utama: "undangan & tugas bersama milik saya".
CREATE INDEX IF NOT EXISTS "routine_task_members_user_idx"
  ON "routine_task_members" ("user_id", "status");

ALTER TABLE "routine_task_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "routine_task_checks"
  ADD COLUMN IF NOT EXISTS "konfirmasi" text NOT NULL DEFAULT 'selesai';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routine_task_checks_konfirmasi_ck') THEN
    ALTER TABLE "routine_task_checks"
      ADD CONSTRAINT "routine_task_checks_konfirmasi_ck" CHECK (
        "konfirmasi" IN ('selesai', 'menunggu', 'ditolak')
        -- Hanya laporan terlaksana yang bisa menunggu atau ditolak.
        AND ("outcome" = 'terlaksana' OR "konfirmasi" = 'selesai')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "routine_check_konfirmasi" (
  "task_id"    uuid NOT NULL,
  "period"     text NOT NULL,
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "keputusan"  text NOT NULL CHECK ("keputusan" IN ('setuju', 'tolak')),
  "decided_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("task_id", "period", "user_id"),
  -- Membatalkan atau melapor ulang menghapus laporan induknya; keputusan atas
  -- laporan yang sudah tidak ada ikut hilang.
  FOREIGN KEY ("task_id", "period") REFERENCES "routine_task_checks"("task_id", "period") ON DELETE CASCADE
);

ALTER TABLE "routine_check_konfirmasi" ENABLE ROW LEVEL SECURITY;
