-- ============================================================
-- Ekstra: peserta non-LHI punya data & posisi tahsin sendiri
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_peserta_luar  → BARU, satu baris per peserta ekstra dari luar LHI
--     (mis. orang tua yang ikut Kelas Kursus). TERPISAH dari "students":
--     mereka bukan siswa, tidak masuk statistik/capaian sekolah.
--     method_id/jilid_id/halaman = penempatan awal; posisi berjalan dihitung
--     aplikasi dari setoran terbaru menurut tanggal.
--   • ekstra_setoran_luar  → BARU, setoran tahsin peserta luar per pertemuan
--     (jilid, halaman, baris, status lulus/lanjut/ulang). Terpisah dari
--     tahsin_logs.
--   • ekstra_booking.peserta_luar_id → tautan keikutsertaan di halaqoh ekstra
--     ke data peserta luarnya. Booking asal 'luar' yang sudah ada diisi
--     otomatis di bawah (satu peserta per booking).
--
-- Aplikasi aman dijalankan sebelum file ini: bagian setoran non-LHI
-- menampilkan pesan bila tabelnya belum ada.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "ekstra_peserta_luar" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nama"        text NOT NULL CHECK (length(btrim("nama")) > 0),
  "kelas"       text NOT NULL DEFAULT '',
  "nama_ortu"   text NOT NULL DEFAULT '',
  "wa_ortu"     text NOT NULL DEFAULT '',
  -- Penempatan awal (diisi guru pada setoran pertama atau koordinator).
  "method_id"   uuid REFERENCES "tahsin_methods"("id") ON DELETE SET NULL,
  "jilid_id"    uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  "halaman"     integer CHECK ("halaman" IS NULL OR "halaman" BETWEEN 1 AND 604),
  "catatan"     text NOT NULL DEFAULT '',
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ekstra_setoran_luar" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "peserta_id"  uuid NOT NULL REFERENCES "ekstra_peserta_luar"("id") ON DELETE CASCADE,
  "slot_id"     uuid REFERENCES "ekstra_slot"("id") ON DELETE SET NULL,
  "teacher_id"  uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "tanggal"     date NOT NULL,
  "jilid_id"    uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  -- Halaman buku, atau halaman mushaf (1–604) untuk tahap Al-Qur'an.
  "halaman"     integer CHECK ("halaman" IS NULL OR "halaman" BETWEEN 1 AND 604),
  "baris_dari"  smallint CHECK ("baris_dari" IS NULL OR "baris_dari" BETWEEN 1 AND 30),
  "baris_ke"    smallint CHECK ("baris_ke" IS NULL OR "baris_ke" BETWEEN 1 AND 30),
  "status"      text NOT NULL CHECK ("status" IN ('lulus', 'lanjut', 'ulang')),
  "catatan"     text NOT NULL DEFAULT '',
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ekstra_setoran_luar_peserta_idx" ON "ekstra_setoran_luar" ("peserta_id", "tanggal");
CREATE INDEX IF NOT EXISTS "ekstra_setoran_luar_slot_idx"    ON "ekstra_setoran_luar" ("slot_id", "tanggal");

ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "peserta_luar_id" uuid
  REFERENCES "ekstra_peserta_luar"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ekstra_booking_peserta_luar_idx" ON "ekstra_booking" ("peserta_luar_id");

-- Isi data peserta untuk booking non-LHI yang sudah ada.
DO $$
DECLARE b record; pid uuid;
BEGIN
  FOR b IN SELECT "id", "nama_anak", "kelas", "nama_ortu", "wa_ortu"
           FROM "ekstra_booking" WHERE "asal" = 'luar' AND "peserta_luar_id" IS NULL
  LOOP
    INSERT INTO "ekstra_peserta_luar" ("nama", "kelas", "nama_ortu", "wa_ortu")
    VALUES (b."nama_anak", b."kelas", b."nama_ortu", b."wa_ortu") RETURNING "id" INTO pid;
    UPDATE "ekstra_booking" SET "peserta_luar_id" = pid WHERE "id" = b."id";
  END LOOP;
END $$;

ALTER TABLE "ekstra_peserta_luar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ekstra_setoran_luar" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verifikasi (opsional):
-- SELECT count(*) FROM ekstra_booking WHERE asal = 'luar' AND peserta_luar_id IS NULL;  -- harus 0
