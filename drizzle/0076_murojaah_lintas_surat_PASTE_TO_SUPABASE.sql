-- ============================================================
-- Muroja'ah lintas surat — "dari surat A ayat x sampai surat B ayat y"
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tahfidz_logs.surat_ke_id → BARU, surat tempat muroja'ah berakhir
--   • CHECK (ayat_ke >= ayat_dari) → diganti aturan yang mengenal lintas surat
--   • CHECK baru: surat_ke_id hanya untuk muroja'ah
--
-- ── ARTI KOLOMNYA ───────────────────────────────────────────
--
-- surat_ke_id NULL (semua baris lama, dan tiap ziyadah) = satu surat, persis
-- seperti sebelumnya: ayat_dari..ayat_ke di surat_id.
--
-- surat_ke_id terisi = mulai dari surat_id ayat ayat_dari, lalu surat-surat
-- di antaranya utuh, berakhir di surat_ke_id ayat ayat_ke. Arahnya boleh
-- maju (An-Naba → An-Nazi'at) maupun mundur (An-Nas → Ad-Duha, lazim di
-- juz 30); tiap surat tetap dibaca dari ayat awal ke akhir.
--
-- ── KENAPA HANYA MURO'JAAH ──────────────────────────────────
--
-- Ziyadah menggerakkan juz_progress (trigger upsert_juz_progress_from_tahfidz
-- menjumlahkan ayat_ke - ayat_dari + 1 ke juz surat_id), masa drill, target
-- tahfidz, dan statistik "tercepat". Semuanya berasumsi satu surat. Muroja'ah
-- tidak menyentuh satu pun dari itu, jadi lintas surat aman di sana — dan
-- memang di muroja'ah-lah anak lazim mengulang beberapa surat sekaligus.
-- ============================================================

ALTER TABLE "tahfidz_logs"
  ADD COLUMN IF NOT EXISTS "surat_ke_id" int REFERENCES "surat_master"("id") ON DELETE RESTRICT;

-- Nama CHECK lama dibuat otomatis oleh Postgres (tahfidz_logs_check), jadi
-- dicari lewat isinya, bukan ditebak namanya.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tahfidz_logs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ayat_ke >= ayat_dari%'
      AND conname <> 'tahfidz_logs_rentang_check'
  LOOP
    EXECUTE format('ALTER TABLE "tahfidz_logs" DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE "tahfidz_logs" DROP CONSTRAINT IF EXISTS "tahfidz_logs_rentang_check";
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_rentang_check" CHECK (
  "ayat_dari" IS NULL OR "ayat_ke" IS NULL
  OR ("surat_ke_id" IS NULL AND "ayat_ke" >= "ayat_dari")
  OR ("surat_ke_id" IS NOT NULL AND "surat_ke_id" <> "surat_id")
);

ALTER TABLE "tahfidz_logs" DROP CONSTRAINT IF EXISTS "tahfidz_logs_surat_ke_murojaah_check";
ALTER TABLE "tahfidz_logs" ADD CONSTRAINT "tahfidz_logs_surat_ke_murojaah_check" CHECK (
  "surat_ke_id" IS NULL OR "kind"::text IN ('murojaah_baru', 'murojaah_lama', 'murojaah')
);
