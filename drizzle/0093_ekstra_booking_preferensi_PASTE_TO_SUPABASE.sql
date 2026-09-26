-- ============================================================
-- Ekstra: booking = preferensi orang tua, koordinator yang menempatkan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_booking.slot_id     → boleh kosong (permintaan belum ditempatkan)
--   • ekstra_booking.jenis_id    → BARU, jenis ekstra yang diminta (diisi dari slot untuk data lama)
--   • ekstra_booking.guru_pilihan_id → BARU, guru yang dipilih orang tua (preferensi, boleh kosong)
--   • ekstra_booking.hari_pilihan    → BARU, hari yang diinginkan (1 = Senin … 7 = Ahad)
--   • ekstra_booking.waktu_pilihan   → BARU, bagian hari: pagi / siang / sore / malam
--   • ekstra_booking.catatan_waktu   → BARU, keterangan jam dari orang tua
--   • ekstra_slot.aktif              → halaqoh yang punya peserta aktif dinyalakan
--
-- ── ALUR BARU ────────────────────────────────────────────────
--
-- Semua guru terbuka untuk ekstra. Orang tua memilih JENIS, WAKTU yang
-- diinginkan, dan (opsional) GURU pilihan — tanpa memilih jadwal. Koordinator
-- menanyakan guru di luar sistem, lalu memasukkan anak ke HALAQOH EKSTRA
-- (= baris ekstra_slot: pengampu + hari + jam + tempat) yang sudah ada atau
-- dibuat baru. Bila guru pilihan tidak bisa, koordinator menawarkan guru lain.
--
-- Karena halaqoh tidak lagi dipamerkan ke publik, ekstra_slot.aktif kini
-- berarti "halaqoh sedang berjalan" — bukan "dibuka untuk dipesan". Halaqoh
-- hasil impor yang dibuat nonaktif (supaya tidak tampil ke orang tua) padahal
-- sudah punya peserta dinyalakan, supaya gurunya bisa mencatat kehadiran
-- dan setoran di portal guru.
-- ============================================================

ALTER TABLE "ekstra_booking" ALTER COLUMN "slot_id" DROP NOT NULL;

ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "jenis_id" uuid REFERENCES "ekstra_jenis"("id") ON DELETE RESTRICT;
ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "guru_pilihan_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL;
ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "hari_pilihan" smallint[] NOT NULL DEFAULT '{}';
ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "waktu_pilihan" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "catatan_waktu" text NOT NULL DEFAULT '';

-- Data lama: jenis diambil dari slot tempatnya.
UPDATE "ekstra_booking" b SET "jenis_id" = s."jenis_id"
  FROM "ekstra_slot" s WHERE b."slot_id" = s."id" AND b."jenis_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ekstra_booking" WHERE "jenis_id" IS NULL) THEN
    ALTER TABLE "ekstra_booking" ALTER COLUMN "jenis_id" SET NOT NULL;
  END IF;
  -- Peserta aktif selalu berada di sebuah halaqoh.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ekstra_booking_aktif_punya_halaqoh') THEN
    ALTER TABLE "ekstra_booking" ADD CONSTRAINT "ekstra_booking_aktif_punya_halaqoh"
      CHECK ("status" <> 'aktif' OR "slot_id" IS NOT NULL);
  END IF;
END $$;

-- Halaqoh yang sudah punya peserta aktif = sedang berjalan.
UPDATE "ekstra_slot" s SET "aktif" = true, "updated_at" = now()
 WHERE s."aktif" = false
   AND EXISTS (SELECT 1 FROM "ekstra_booking" b WHERE b."slot_id" = s."id" AND b."status" = 'aktif');

-- Verifikasi (opsional):
-- SELECT count(*) FILTER (WHERE jenis_id IS NULL) AS tanpa_jenis, count(*) FROM ekstra_booking;
-- SELECT aktif, count(*) FROM ekstra_slot GROUP BY aktif;
