-- ============================================================
-- Ujian Tahsin — hasilnya masuk ke capaian siswa, bukan berhenti di catatan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • jilid_promotions : + source_ujian_id, + indeks unik pencegah ganda
--
-- ── MASALAHNYA ──────────────────────────────────────────────
--
-- Ujian tahsin selama ini berhenti sebagai catatan. Seorang anak bisa lulus
-- ujian Jilid 3 dan baris ujiannya tercatat rapi, tapi tidak ada apa pun di
-- tabel students yang berubah — jilid berjalannya tetap Jilid 3, analitik
-- tetap menghitungnya belum naik, dan rapornya tidak menyebut kelulusan itu.
-- Satu-satunya jalan capaian masuk ke sistem adalah centang "naik jilid" di
-- formulir setoran harian, yang dikerjakan orang yang berbeda pada waktu yang
-- berbeda — dan karenanya sering tidak dikerjakan sama sekali.
--
-- ── KENAPA source_ujian_id, BUKAN SEKADAR MENULIS PROMOSI ───
--
-- Status ujian bisa diubah bolak-balik: koordinator menandai 'selesai', lalu
-- meralat predikat seorang anak, lalu menyimpannya lagi. Tanpa penanda asal,
-- tiap penyimpanan akan menaikkan anak itu satu jilid lagi — dan tiga kali
-- ralat berarti anak itu melompat tiga jilid tanpa seorang pun menyadarinya.
--
-- Kolomnya berpasangan dengan source_log_id (0027) yang sudah lebih dulu ada
-- untuk kenaikan dari setoran harian. Keduanya menjawab pertanyaan yang sama:
-- peristiwa mana yang menyebabkan kenaikan ini — dan karena itu pula
-- keduanya memungkinkan kenaikan dicabut kembali saat penyebabnya dihapus.
--
-- ── KENAPA INDEKS UNIKNYA PARSIAL ───────────────────────────
--
-- Hanya baris yang PUNYA source_ujian_id yang dijaga. Kenaikan dari setoran
-- harian tidak boleh ikut terkena: seorang anak wajar naik beberapa kali
-- sepanjang tahun lewat jalur itu, dan NULL tidak dianggap sama dengan NULL
-- oleh indeks unik Postgres — tapi menulis syaratnya eksplisit membuat
-- maksudnya terbaca, bukan bergantung pada seluk-beluk itu.
-- ============================================================

-- 1) Ujian yang menyebabkan kenaikan ini
ALTER TABLE "jilid_promotions"
  ADD COLUMN IF NOT EXISTS "source_ujian_id" uuid
    REFERENCES "ujian_tahsin"("id") ON DELETE SET NULL;

-- 2) Satu ujian hanya boleh menaikkan seorang anak satu kali
CREATE UNIQUE INDEX IF NOT EXISTS "jilid_promotions_ujian_unik"
  ON "jilid_promotions" ("student_id", "source_ujian_id")
  WHERE "source_ujian_id" IS NOT NULL;

-- 3) Menelusuri kenaikan yang lahir dari sebuah ujian
CREATE INDEX IF NOT EXISTS "jilid_promotions_ujian_idx"
  ON "jilid_promotions" ("source_ujian_id")
  WHERE "source_ujian_id" IS NOT NULL;

-- Verifikasi (opsional):
-- SELECT p.promotion_date, s.full_name, f.label AS dari, t.label AS ke, p.source_ujian_id
--   FROM jilid_promotions p
--   JOIN students s ON s.id = p.student_id
--   LEFT JOIN jilid_levels f ON f.id = p.from_jilid_id
--   JOIN jilid_levels t ON t.id = p.to_jilid_id
--  WHERE p.source_ujian_id IS NOT NULL
--  ORDER BY p.promotion_date DESC;
