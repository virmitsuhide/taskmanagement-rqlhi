-- ============================================================
-- Ekstra: orang tua boleh memilih lebih dari satu guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ekstra_booking.guru_pilihan_ids → BARU, daftar guru pilihan orang tua (maks. 3, dijaga aplikasi)
--   • ekstra_booking.guru_pilihan_id  → DIHAPUS, isinya dipindah ke daftar di atas
--
-- Guru pilihan tetap PREFERENSI: Koordinator Ekstra memakai daftar ini untuk
-- mencari guru yang bisa lebih dulu, lalu menawarkan guru lain bila semuanya
-- berhalangan. Kolom array tidak bisa ber-FK; guru yang kemudian dihapus
-- cukup diabaikan oleh aplikasi saat menampilkan.
-- ============================================================

ALTER TABLE "ekstra_booking" ADD COLUMN IF NOT EXISTS "guru_pilihan_ids" uuid[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'ekstra_booking' AND column_name = 'guru_pilihan_id') THEN
    UPDATE "ekstra_booking" SET "guru_pilihan_ids" = ARRAY["guru_pilihan_id"]
     WHERE "guru_pilihan_id" IS NOT NULL AND cardinality("guru_pilihan_ids") = 0;
    ALTER TABLE "ekstra_booking" DROP COLUMN "guru_pilihan_id";
  END IF;
END $$;

-- Verifikasi (opsional):
-- SELECT cardinality(guru_pilihan_ids) AS jumlah, count(*) FROM ekstra_booking GROUP BY 1;
