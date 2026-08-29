-- ============================================================
-- Tugas Rutin — checklist pekanan & bulanan tiap pengurus
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang ditambahkan:
--   • enum routine_cadence      → pekanan / bulanan
--   • tabel routine_tasks       → daftar tugas rutin milik seorang pengurus
--   • tabel routine_task_checks → satu baris per (tugas, periode) yang dicentang
--
-- KENAPA CENTANGNYA TABEL SENDIRI, BUKAN KOLOM is_done DI routine_tasks
--
-- Tugas rutin menurut definisinya berulang. Kolom boolean pada barisnya hanya
-- bisa menyimpan satu keadaan, jadi begitu "Rekap setoran pekanan" dicentang,
-- ia akan tetap tercentang selamanya — kecuali ada pekerjaan terjadwal yang
-- membersihkannya tiap Senin dini hari. Menaruh pekerjaan terjadwal di jalur
-- ini berarti checklist seluruh pengurus bergantung pada satu cron yang, kalau
-- gagal atau telat, membuat semua orang melihat pekan lalu sebagai pekan ini.
--
-- Baris per periode membalik ketergantungan itu: tidak ada yang perlu
-- direset. "Sudah dikerjakan pekan ini?" dijawab dengan menanyakan apakah ada
-- baris untuk periode berjalan, dan pergantian pekan terjadi sendirinya karena
-- kunci periodenya berubah. Riwayatnya ikut tersimpan sebagai efek samping.
--
-- KENAPA KUNCI PRIMERNYA (task_id, period)
--
-- Mencentang adalah operasi yang harus tahan diulang — dua ketukan cepat di
-- HP tidak boleh menghasilkan dua baris. Dengan kunci gabungan ini, mencentang
-- cukup INSERT ... ON CONFLICT DO NOTHING dan membatalkan centang cukup
-- DELETE; tidak ada keadaan setengah jadi yang mungkin terbentuk.
--
-- Format `period` mengikuti lib/rutin/periode.ts: '2026-W36' untuk pekanan
-- (pekan ISO, mulai Senin) dan '2026-08' untuk bulanan. Keduanya terurut benar
-- secara leksikografis, jadi pertanyaan "periode terakhir yang dicentang"
-- cukup ORDER BY period DESC tanpa mengurai apa pun.
--
-- KENAPA HAPUSNYA PERMANEN, BEDA DENGAN tasks (0018)
--
-- Tugas biasa dihapus secara lunak karena notifikasi diturunkan dari
-- task_history, sehingga hard delete ikut menghapus notifikasi yang baru saja
-- dibuat. Tugas rutin tidak menurunkan notifikasi apa pun dan hanya dilihat
-- pemiliknya sendiri; menyimpan bangkainya cuma akan memenuhi kueri dengan
-- syarat deleted_at yang tidak berguna bagi siapa pun.
-- ============================================================

-- 1) Irama pengulangan
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routine_cadence') THEN
    CREATE TYPE routine_cadence AS ENUM ('pekanan', 'bulanan');
  END IF;
END $$;

-- 2) Daftar tugas rutin
CREATE TABLE IF NOT EXISTS "routine_tasks" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Pemiliknya. Tugas rutin adalah alat kerja pribadi: hanya pemiliknya yang
  -- melihat, menyunting, dan mencentangnya.
  "owner_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "cadence"     routine_cadence NOT NULL,
  -- Urutan tampil di dalam kelompok iramanya.
  "order_num"   integer NOT NULL DEFAULT 0,
  "created_at"  timestamptz DEFAULT now(),
  "updated_at"  timestamptz DEFAULT now()
);

-- Satu-satunya pola query: "semua tugas rutin saya, terkelompok & terurut".
CREATE INDEX IF NOT EXISTS "routine_tasks_owner_idx"
  ON "routine_tasks" ("owner_id", "cadence", "order_num");

-- 3) Centang per periode
CREATE TABLE IF NOT EXISTS "routine_task_checks" (
  "task_id"    uuid NOT NULL REFERENCES "routine_tasks"("id") ON DELETE CASCADE,
  -- '2026-W36' (pekan ISO) atau '2026-08' — lihat lib/rutin/periode.ts.
  "period"     text NOT NULL,
  "checked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "checked_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("task_id", "period")
);

-- Halaman checklist mengambil centang periode berjalan untuk semua tugas
-- sekaligus, jadi yang dicari adalah periodenya lebih dulu.
CREATE INDEX IF NOT EXISTS "routine_task_checks_period_idx"
  ON "routine_task_checks" ("period");

-- Verifikasi (opsional):
-- SELECT t.description, t.cadence, c.period, c.checked_at
--   FROM routine_tasks t
--   LEFT JOIN routine_task_checks c ON c.task_id = t.id
--  ORDER BY t.cadence, t.order_num;
