-- ============================================================
-- Reset rapor KPI: hapus barisnya, pertahankan jejaknya
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang). Jalankan SETELAH 0050.
--
-- Yang berubah:
--   • kpi_rapor_riwayat : + teacher_id, year, month; FK jadi ON DELETE SET NULL
--   • kpi_banding       : + year, month; FK jadi ON DELETE SET NULL
--
-- ── MASALAH YANG DIPERBAIKI ─────────────────────────────────
--
-- 0050 menjalankan reset sebagai PENGOSONGAN: seluruh angka dinolkan dan
-- barisnya kembali ke 'draft'. Itu keliru, dan kekeliruannya tidak kelihatan
-- sampai ada yang benar-benar mereset.
--
-- Di rubrik ini nol tidak berarti kosong — untuk empat indikator, nol berarti
-- SEMPURNA:
--   0 menit terlambat  → 100  (tidak pernah telat)
--   0 hari telat isi DB→ 100  (selalu tepat waktu)
--   0 kasus izin WA    → 100  (tidak ada pelanggaran)
--   0 kasus cari ganti → 100  (tidak pernah absen)
-- ditambah dua indikator yang punya nilai basis (hafalan 40, buku pegangan 4).
--
-- Hasilnya, rapor yang "dikosongkan" tetap menghitung 40,4 — dan tampil
-- sebagai penilaian sungguhan berpredikat "Sangat Kurang Sekali". Guru yang
-- belum dinilai jadi terbaca seolah berkinerja terburuk, dan angka itu ikut
-- terbawa ke rata-rata rapor semesternya.
--
-- ── KENAPA MENGHAPUS BARIS, BUKAN MENANDAINYA ───────────────
--
-- Pilihan lainnya adalah menyimpan barisnya dengan penanda "kosong", lalu
-- menyaringnya di tiap pembacaan. Ada DELAPAN tempat yang membaca kpi_monthly
-- — daftar SDM, meja koordinator, portal guru, rapor semester, riwayat guru,
-- tren tiga bulan, dan dua action. Saringan yang harus diingat di delapan
-- tempat adalah saringan yang cepat atau lambat terlupa di salah satunya, dan
-- yang terlupa tidak akan gagal: ia hanya diam-diam memasukkan 40,4 ke dalam
-- rata-rata semester seseorang.
--
-- Menghapus barisnya membuat "belum dinilai" kembali menjadi keadaan yang
-- sudah dipahami seluruh modul sejak awal — tidak ada baris, tidak ada nilai.
-- Nol tempat yang perlu diubah, nol yang bisa lupa.
--
-- ── LALU BAGAIMANA JEJAKNYA ─────────────────────────────────
--
-- Inilah yang dulu membuat penghapusan ditolak: kpi_rapor_riwayat menunjuk ke
-- kpi_monthly dengan ON DELETE CASCADE, jadi menghapus rapor akan menghapus
-- pula catatan "rapor direset" pada saat catatan itu dibuat.
--
-- Diperbaiki di sini: kunci asingnya jadi ON DELETE SET NULL, dan identitas
-- rapornya (guru, tahun, bulan) DISALIN ke baris riwayat. Sesudah rapornya
-- hilang, riwayatnya tetap bisa menjawab "rapor Agustus 2026 milik siapa yang
-- direset, oleh siapa, kapan, dengan alasan apa" — dan ikut tampil kembali
-- saat periode yang sama dinilai ulang.
--
-- Perlakuan yang sama untuk kpi_banding: sanggahan seorang guru atas penilaian
-- yang kemudian dihapus adalah justru hal yang paling perlu tetap tercatat.

-- ── Riwayat ──────────────────────────────────────────────────

ALTER TABLE "kpi_rapor_riwayat"
  ADD COLUMN IF NOT EXISTS "teacher_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "year"       integer,
  ADD COLUMN IF NOT EXISTS "month"      integer;

-- Isi identitas untuk baris riwayat yang sudah ada, selagi rapornya masih ada.
UPDATE "kpi_rapor_riwayat" r
   SET "teacher_id" = k."teacher_id",
       "year"       = k."year",
       "month"      = k."month"
  FROM "kpi_monthly" k
 WHERE r."kpi_monthly_id" = k."id"
   AND r."teacher_id" IS NULL;

ALTER TABLE "kpi_rapor_riwayat" ALTER COLUMN "kpi_monthly_id" DROP NOT NULL;

ALTER TABLE "kpi_rapor_riwayat"
  DROP CONSTRAINT IF EXISTS "kpi_rapor_riwayat_kpi_monthly_id_fkey";
ALTER TABLE "kpi_rapor_riwayat"
  ADD CONSTRAINT "kpi_rapor_riwayat_kpi_monthly_id_fkey"
  FOREIGN KEY ("kpi_monthly_id") REFERENCES "kpi_monthly"("id") ON DELETE SET NULL;

-- Riwayat dicari per periode, bukan cuma per baris rapor — sebab barisnya
-- bisa sudah tidak ada.
CREATE INDEX IF NOT EXISTS "kpi_rapor_riwayat_periode_idx"
  ON "kpi_rapor_riwayat" ("teacher_id", "year", "month", "created_at" DESC);

-- ── Banding ──────────────────────────────────────────────────

ALTER TABLE "kpi_banding"
  ADD COLUMN IF NOT EXISTS "year"  integer,
  ADD COLUMN IF NOT EXISTS "month" integer;

UPDATE "kpi_banding" b
   SET "year"  = k."year",
       "month" = k."month"
  FROM "kpi_monthly" k
 WHERE b."kpi_monthly_id" = k."id"
   AND b."year" IS NULL;

ALTER TABLE "kpi_banding" ALTER COLUMN "kpi_monthly_id" DROP NOT NULL;

ALTER TABLE "kpi_banding"
  DROP CONSTRAINT IF EXISTS "kpi_banding_kpi_monthly_id_fkey";
ALTER TABLE "kpi_banding"
  ADD CONSTRAINT "kpi_banding_kpi_monthly_id_fkey"
  FOREIGN KEY ("kpi_monthly_id") REFERENCES "kpi_monthly"("id") ON DELETE SET NULL;

-- ── Membereskan rapor yang terlanjur direset dengan cara lama ─
--
-- Ciri-cirinya khas dan tidak mungkin tertukar dengan penilaian sungguhan:
-- direset_at terisi, statusnya kembali draft, DAN seluruh bahan mentahnya nol.
-- Baris seperti itu bukan penilaian, melainkan sisa pengosongan yang keliru —
-- dihapus supaya gurunya kembali terbaca "belum dinilai".
--
-- Riwayatnya selamat: identitasnya sudah disalin di atas, dan kunci asingnya
-- sudah menjadi SET NULL sebelum baris ini dijalankan.

DELETE FROM "kpi_monthly"
 WHERE "direset_at" IS NOT NULL
   AND "status" = 'draft'
   AND COALESCE("late_minutes", 0) = 0
   AND COALESCE("db_late_days", 0) = 0
   AND COALESCE("hafalan_juz", 0) = 0
   AND COALESCE("hafalan_pages", 0) = 0
   AND COALESCE("tuhfatul_bait", 0) = 0
   AND COALESCE("bacaan_score", 0) = 0
   AND COALESCE("buku_pegangan_meetings", 0) = 0
   AND COALESCE("izin_wa_cases", 0) = 0
   AND COALESCE("pengganti_cases", 0) = 0
   AND COALESCE("pengganti_found", 0) = 0
   AND "seragam_daily" IS NULL
   AND "lapor_ortu_daily" IS NULL
   AND "halaqoh_hadir" IS NULL
   AND "halaqoh_akhiri" IS NULL
   AND "seragam_total" IS NULL
   AND "lapor_ortu_total" IS NULL
   AND "halaqoh_total" IS NULL;
