-- ============================================================
-- Ekstra: halaqoh boleh punya lebih dari satu waktu per pekan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_slot.jadwal_tambahan → BARU, jsonb array waktu SELAIN jadwal
--     utama: [{ "hari": 1-7, "jam_mulai": "HH:MM", "jam_selesai": "HH:MM",
--     "tempat": "" }, …]. Boleh beberapa hari dalam sepekan, dan boleh dua
--     waktu di hari yang sama (pagi & sore).
--   • Isi hari_2/jam_mulai_2/jam_selesai_2/tempat_2 dipindah ke kolom baru.
--
-- ── KENAPA JADWAL UTAMA TETAP DI hari/jam_mulai ─────────────
--
-- Puluhan tempat (urutan daftar halaqoh, kartu guru, booking) membaca
-- hari & jam_mulai sebagai waktu halaqoh. Jadwal utama tetap di sana dan
-- waktu lain menyusul di jadwal_tambahan; aplikasi membaca keduanya lewat
-- jadwalSlot() di lib/data/ekstra.ts.
--
-- ── SOAL hari_2 DKK ─────────────────────────────────────────
--
-- Kolom itu ada di basis data tetapi tidak pernah dibaca aplikasi, sehingga
-- jadwal kedua dua halaqoh (Ahad, Online) tidak pernah tampil. Isinya disalin
-- ke jadwal_tambahan lalu dikosongkan; kolomnya sendiri TIDAK dihapus —
-- tidak dipakai lagi, aman dihapus kemudian bila sudah dipastikan tak ada
-- yang lain membacanya.
-- ============================================================

BEGIN;

ALTER TABLE "ekstra_slot"
  ADD COLUMN IF NOT EXISTS "jadwal_tambahan" jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE "ekstra_slot" ADD CONSTRAINT "ekstra_slot_jadwal_tambahan_array"
    CHECK (jsonb_typeof("jadwal_tambahan") = 'array' AND jsonb_array_length("jadwal_tambahan") <= 13);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pindahkan jadwal kedua lama (bila kolomnya ada & terisi).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ekstra_slot' AND column_name = 'hari_2') THEN
    UPDATE "ekstra_slot"
       SET "jadwal_tambahan" = "jadwal_tambahan" || jsonb_build_array(jsonb_build_object(
             'hari', "hari_2",
             'jam_mulai', to_char("jam_mulai_2", 'HH24:MI'),
             'jam_selesai', to_char("jam_selesai_2", 'HH24:MI'),
             'tempat', coalesce("tempat_2", ''))),
           "hari_2" = NULL, "jam_mulai_2" = NULL, "jam_selesai_2" = NULL, "tempat_2" = '',
           "updated_at" = now()
     WHERE "hari_2" IS NOT NULL;
  END IF;
END $$;

COMMIT;

-- Verifikasi (opsional):
-- SELECT id, hari, jam_mulai, jadwal_tambahan FROM ekstra_slot
--  WHERE jadwal_tambahan <> '[]'::jsonb;   -- 2 baris (Ahad Online)
