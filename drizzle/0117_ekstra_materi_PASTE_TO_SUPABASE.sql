-- ============================================================
-- Ekstra: setoran ke-3 "materi" — Bahasa Arab & Pelatihan Guru Qur'an
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_jenis.bidang  → nilai baru 'materi' (selain tahsin/tahfidz/campuran).
--     Jenis bidang materi tidak menyetor tahsin/tahfidz; gurunya mencatat
--     deskripsi materi tiap pertemuan.
--   • Jenis "Kelas Bahasa Arab — …" dan "Pelatihan Guru Al-Qur'an" dipindah ke
--     bidang 'materi'. Bisa diubah lagi kapan saja di Ekstra → Jenis ekstra.
--   • ekstra_materi        → BARU, satu deskripsi materi per pertemuan
--     (halaqoh ekstra + tanggal). Peserta yang hadir hari itu dianggap
--     menerima materi tersebut — di Progres tampil sebagai kode "M".
--
-- Aplikasi sudah aman dijalankan sebelum file ini: tombol Setor materi
-- menampilkan pesan bila tabelnya belum ada.
-- ============================================================

BEGIN;

ALTER TABLE "ekstra_jenis" DROP CONSTRAINT IF EXISTS "ekstra_jenis_bidang_check";
ALTER TABLE "ekstra_jenis" ADD CONSTRAINT "ekstra_jenis_bidang_check"
  CHECK ("bidang" IN ('tahsin', 'tahfidz', 'campuran', 'materi'));

UPDATE "ekstra_jenis" SET "bidang" = 'materi', "updated_at" = now()
WHERE "bidang" <> 'materi'
  AND ("nama" ILIKE '%bahasa arab%' OR "nama" ILIKE 'pelatihan guru%');

CREATE TABLE IF NOT EXISTS "ekstra_materi" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slot_id"     uuid NOT NULL REFERENCES "ekstra_slot"("id") ON DELETE CASCADE,
  "tanggal"     date NOT NULL,
  "deskripsi"   text NOT NULL CHECK (length(btrim("deskripsi")) > 0),
  "teacher_id"  uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("slot_id", "tanggal")
);
CREATE INDEX IF NOT EXISTS "ekstra_materi_tanggal_idx" ON "ekstra_materi" ("tanggal");

ALTER TABLE "ekstra_materi" ENABLE ROW LEVEL SECURITY;

COMMIT;
