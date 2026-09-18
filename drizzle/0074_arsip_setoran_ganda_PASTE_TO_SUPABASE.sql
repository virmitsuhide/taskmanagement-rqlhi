-- ============================================================
-- Arsip setoran yang ditimpa — satu setoran per anak per hari
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • setoran_arsip → BARU, salinan utuh setoran yang ditimpa guru
--
-- ── ALURNYA ─────────────────────────────────────────────────
--
-- Guru menyetor anak yang HARI ITU sudah punya setoran (tahsin, atau tahfidz
-- dengan jenis yang sama). Sebelum tersimpan, guru melihat perbandingan
-- setoran lama vs baru dan harus menekan "Timpa". Setoran lama lalu:
--   1. disalin utuh ke setoran_arsip (termasuk materi Gharib/Tajwid-nya),
--   2. dihapus dari tahsin_logs / tahfidz_logs,
--   3. posisi anak dihitung ulang, baru setoran baru disimpan.
--
-- ── KENAPA TABEL ARSIP, BUKAN KOLOM "diarsipkan" DI TABEL LOG ─
--
-- Puluhan kueri — rapor, rekap bulanan, analitik, KPI — membaca tahsin_logs
-- dan tahfidz_logs apa adanya. Kolom penanda berarti SETIAP kueri itu wajib
-- menambah "AND diarsipkan_at IS NULL", dan satu saja yang lupa membuat
-- setoran yang sudah ditimpa terhitung dua kali. Memindahkannya ke tabel lain
-- membuat semua kueri lama tetap benar tanpa disentuh.
--
-- ── KENAPA JSONB ────────────────────────────────────────────
--
-- Arsip hanya dibaca untuk ditampilkan dan diaudit, tidak pernah dihitung.
-- Menyalin baris sebagai JSONB membuat kolom yang kelak ditambahkan ke tabel
-- log ikut terarsip tanpa migrasi susulan.
-- ============================================================

CREATE TABLE IF NOT EXISTS "setoran_arsip" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jenis"           text NOT NULL CHECK ("jenis" IN ('tahsin', 'tahfidz')),
  "log_id"          uuid NOT NULL,
  "student_id"      uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "setoran_date"    date NOT NULL,
  -- Jenis tahfidz (ziyadah / murojaah_*); NULL untuk tahsin.
  "kind"            text,
  "data"            jsonb NOT NULL,
  -- Materi Gharib/Tajwid milik setoran tahsin itu — ikut terhapus bersama
  -- lognya lewat CASCADE, jadi disalin di sini.
  "materi"          jsonb,
  -- Setoran pengganti. Tanpa FK: bisa menunjuk tahsin_logs maupun
  -- tahfidz_logs, dan pengganti itu sendiri bisa kelak ditimpa lagi.
  "diganti_oleh"    uuid,
  "diarsipkan_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "setoran_arsip_student_idx"
  ON "setoran_arsip" ("student_id", "setoran_date" DESC);

ALTER TABLE "setoran_arsip" ENABLE ROW LEVEL SECURITY;
