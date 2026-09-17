-- ============================================================
-- Target tahfidz bulanan — kalender pekan efektif & asal siswa SMP
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • kalender_pekan_efektif : BARU — pekan efektif tiap bulan per tahun ajaran
--   • students               : + asal_sd_lhi (lulusan SD LHI → target SMPIT internal)
--
-- ── KENAPA YANG DISIMPAN KALENDERNYA, BUKAN TARGETNYA ───────
--
-- Rencana hafalan per program (SDIT CLIL, QuLS, SMPIT internal & eksternal)
-- disusun per PEKAN, dan jarang berubah — ia tinggal di lib/rq/target-tahfidz.ts.
-- Yang berubah tiap tahun adalah KALENDER: berapa pekan efektif yang jatuh di
-- tiap bulan, setelah dipotong MPLS, PTS, PAS, dan libur Idul Fitri yang
-- bergeser ± 11 hari tiap tahun.
--
-- Target akhir bulan tidak disimpan sama sekali. Ia dihitung dari keduanya:
-- pekan efektif yang sudah lewat dalam semester → bagian materi semester yang
-- semestinya sudah dihafal. Mengubah satu angka di kalender menggeser seluruh
-- target bulan sesudahnya dengan sendirinya — tidak ada ratusan baris target
-- yang harus diketik ulang dan bisa saling bertentangan.
--
-- ── KENAPA pekan_efektif BOLEH PECAHAN ──────────────────────
--
-- Bulan yang dibuka atau ditutup di tengah pekan (MPLS mulai Rabu, libur
-- Lebaran mulai Kamis) paling jujur ditulis 2,5 — bukan dibulatkan ke 2 atau
-- 3 lalu selisihnya ditanggung bulan lain.
--
-- ── asal_sd_lhi ─────────────────────────────────────────────
--
-- SMPIT punya dua rencana: INTERNAL untuk lulusan SD LHI (juz 30 dianggap
-- sudah dibawa, hafalan baru mulai juz 29) dan EKSTERNAL untuk selainnya
-- (mulai juz 30). DEFAULT false → semua siswa terhitung eksternal sampai
-- koordinator menandainya, sesuai arahan RQ: "selain itu yang berlaku adalah
-- eksternal".
--
-- Kolomnya hanya bermakna untuk SMP, tapi sengaja tidak diberi CHECK jenjang:
-- anak SD LHI yang naik ke SMPIT membawa tanda ini dari data yang sama, dan
-- menolaknya di jenjang SD hanya memaksa tanda itu diisi dua kali.

CREATE TABLE IF NOT EXISTS "kalender_pekan_efektif" (
  "tahun_ajaran"  text     NOT NULL CHECK ("tahun_ajaran" ~ '^\d{4}/\d{4}$'),
  -- Selalu tanggal 1.
  "bulan"         date     NOT NULL CHECK (EXTRACT(DAY FROM "bulan") = 1),
  "semester"      smallint NOT NULL CHECK ("semester" IN (1, 2)),
  "pekan_efektif" numeric(3, 1) NOT NULL DEFAULT 0 CHECK ("pekan_efektif" BETWEEN 0 AND 6),
  "updated_by"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tahun_ajaran", "bulan")
);

ALTER TABLE "kalender_pekan_efektif" ENABLE ROW LEVEL SECURITY;

-- Perkiraan awal TA 2026/2027 — sama dengan kalenderBawaan() di
-- lib/rq/target-tahfidz.ts. Ganjil 18 pekan, genap 15 pekan. DO NOTHING:
-- menjalankan ulang berkas ini tidak menimpa kalender yang sudah diubah RQ.
INSERT INTO "kalender_pekan_efektif" ("tahun_ajaran", "bulan", "semester", "pekan_efektif") VALUES
  ('2026/2027', '2026-07-01', 1, 2),
  ('2026/2027', '2026-08-01', 1, 4),
  ('2026/2027', '2026-09-01', 1, 4),
  ('2026/2027', '2026-10-01', 1, 3),
  ('2026/2027', '2026-11-01', 1, 4),
  ('2026/2027', '2026-12-01', 1, 1),
  ('2026/2027', '2027-01-01', 2, 4),
  ('2026/2027', '2027-02-01', 2, 3),
  ('2026/2027', '2027-03-01', 2, 1),
  ('2026/2027', '2027-04-01', 2, 3),
  ('2026/2027', '2027-05-01', 2, 3),
  ('2026/2027', '2027-06-01', 2, 1)
ON CONFLICT ("tahun_ajaran", "bulan") DO NOTHING;

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "asal_sd_lhi" boolean NOT NULL DEFAULT false;
