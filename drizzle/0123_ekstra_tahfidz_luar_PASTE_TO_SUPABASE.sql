-- ============================================================
-- Ekstra: setoran tahfidz peserta non-LHI
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang). Butuh 0122 lebih dulu.
--
-- Yang berubah:
--   • ekstra_setoran_tahfidz_luar → BARU, setoran tahfidz peserta ekstra dari
--     luar LHI (ziyadah / muroja'ah: surat + rentang ayat). Terpisah dari
--     tahfidz_logs — tidak masuk capaian hafalan sekolah. Aplikasi hanya
--     menampilkan posisi akhir (ziyadah terbaru menurut tanggal).
--
-- Aplikasi aman dijalankan sebelum file ini: tombol Setor tahfidz untuk
-- peserta non-LHI menampilkan pesan bila tabelnya belum ada.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "ekstra_setoran_tahfidz_luar" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "peserta_id"  uuid NOT NULL REFERENCES "ekstra_peserta_luar"("id") ON DELETE CASCADE,
  "slot_id"     uuid REFERENCES "ekstra_slot"("id") ON DELETE SET NULL,
  "teacher_id"  uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "tanggal"     date NOT NULL,
  "jenis"       text NOT NULL CHECK ("jenis" IN ('ziyadah', 'murojaah')),
  "surat_id"    integer NOT NULL REFERENCES "surat_master"("id"),
  "ayat_dari"   integer NOT NULL CHECK ("ayat_dari" >= 1),
  "ayat_ke"     integer NOT NULL CHECK ("ayat_ke" >= "ayat_dari"),
  "catatan"     text NOT NULL DEFAULT '',
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ekstra_setoran_tahfidz_luar_peserta_idx" ON "ekstra_setoran_tahfidz_luar" ("peserta_id", "tanggal");
CREATE INDEX IF NOT EXISTS "ekstra_setoran_tahfidz_luar_slot_idx"    ON "ekstra_setoran_tahfidz_luar" ("slot_id", "tanggal");

ALTER TABLE "ekstra_setoran_tahfidz_luar" ENABLE ROW LEVEL SECURITY;

COMMIT;
