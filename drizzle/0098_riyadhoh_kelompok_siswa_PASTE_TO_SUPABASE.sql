-- ============================================================
-- Riyadhoh: pembagian peserta per pengampu
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • riyadhoh_kelompok_siswa → BARU, siswa → pengampu Riyadhoh-nya
--
-- Tiap Sabtu satu kelompok (putra/putri) masuk, tetapi di dalamnya dibagi
-- ke beberapa pengampu (kelompok Ust Sofa, Ust Dian, …). Pengampu hanya
-- melihat & mencatat anak kelompoknya; anak yang belum ditetapkan tetap
-- bisa dicatat oleh semua pengampu segender, seperti sebelum migrasi ini.
-- Koordinator SMP menetapkan & memindahkan dari halaman Riyadhoh.
-- ============================================================

CREATE TABLE IF NOT EXISTS "riyadhoh_kelompok_siswa" (
  "student_id"  uuid PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
  "teacher_id"  uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "diubah_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "riyadhoh_kelompok_siswa_guru_idx" ON "riyadhoh_kelompok_siswa" ("teacher_id");

ALTER TABLE "riyadhoh_kelompok_siswa" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT t.full_name, count(*) FROM riyadhoh_kelompok_siswa k JOIN teachers t ON t.id = k.teacher_id GROUP BY 1;
