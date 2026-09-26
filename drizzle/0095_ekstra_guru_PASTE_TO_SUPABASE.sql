-- ============================================================
-- Ekstra: daftar guru yang bersedia menjadi pengampu ekstra
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_guru → BARU, guru (lintas unit) yang bersedia mengampu ekstra
--
-- Koordinator Ekstra menambah guru dari seluruh guru aktif. Hanya guru di
-- daftar ini yang:
--   • tombol Booking-nya aktif di kartu guru publik,
--   • muncul di pilihan "guru pilihan" formulir orang tua,
--   • bisa dijadikan pengampu halaqoh ekstra.
-- Guru yang tidak bersedia cukup tidak dimasukkan (atau dinonaktifkan).
--
-- Guru yang saat ini sudah mengampu halaqoh ekstra berjalan dimasukkan
-- otomatis, supaya halaqoh yang ada tidak tiba-tiba kehilangan pengampunya.
-- ============================================================

CREATE TABLE IF NOT EXISTS "ekstra_guru" (
  "teacher_id"  uuid PRIMARY KEY REFERENCES "teachers"("id") ON DELETE CASCADE,
  "aktif"       boolean NOT NULL DEFAULT true,
  "catatan"     text NOT NULL DEFAULT '',
  "ditambah_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "ekstra_guru" ENABLE ROW LEVEL SECURITY;

INSERT INTO "ekstra_guru" ("teacher_id")
SELECT DISTINCT s."teacher_id" FROM "ekstra_slot" s WHERE s."aktif"
ON CONFLICT ("teacher_id") DO NOTHING;

-- Verifikasi (opsional):
-- SELECT count(*) FILTER (WHERE aktif) AS guru_ekstra FROM ekstra_guru;
