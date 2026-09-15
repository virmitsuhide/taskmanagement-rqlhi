-- ============================================================
-- Pembinaan Gukar — setoran tahsin & tahfidz yang terukur
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • jilid_levels        : UMMI "Tajwid" 28 → 20 halaman (koreksi RQ LHI)
--   • gukar_participants  : + metode_id
--   • gukar_monthly       : + jilid_id, halaman, surat/ayat tahsin & tahfidz,
--                           + setoran_tahsin_halaman, setoran_tahfidz_halaman
--
-- ── KENAPA METODE DI PESERTA, BUKAN DI BARIS BULANAN ────────
--
-- Metode tahsin seseorang ditetapkan sekali lalu tidak berganti-ganti: orang
-- yang dibina dengan UMMI tidak pindah ke Syajaroh bulan depan. Menaruhnya di
-- baris bulanan berarti nilainya bisa berbeda antar bulan untuk orang yang
-- sama — dan tidak ada yang mencegahnya, sebab tiap bulan adalah baris baru.
-- Di tabel peserta, "terkunci setelah dipilih sekali" menjadi sifat datanya
-- sendiri, bukan aturan yang harus diingat setiap formulir.
--
-- ── KENAPA JILID MENUNJUK jilid_levels, BUKAN TEKS ──────────
--
-- Tabel itu sudah menyimpan tahap tiap metode beserta jumlah halamannya, dan
-- sudah dipakai setoran santri. Menyalin daftarnya sebagai teks di modul
-- gukar akan membuat dua daftar yang harus dijaga tetap sama — dan begitu
-- keduanya berbeda, halaman yang sama dihitung berbeda untuk guru dan untuk
-- muridnya.
--
-- Kolom tahap_tahsin yang lama TIDAK dihapus: catatan 2026 yang sudah masuk
-- memakainya, dan analitik SDM masih membaca kolom itu.
--
-- ── KENAPA JUMLAH SETORAN DISIMPAN, BUKAN DIHITUNG SAAT DIBACA ──
--
-- Angkanya adalah SELISIH posisi bulan ini dengan posisi bulan sebelumnya.
-- Menghitungnya saat dibaca berarti setiap tampilan harus menarik baris bulan
-- lalu — dan baris itu bisa disunting kemudian, sehingga angka yang sudah
-- dilaporkan ke SDM berubah sendiri di belakang. Disimpan saat menyimpan:
-- yang tercatat adalah jarak yang benar-benar ditempuh pada saat itu.
--
-- ── SOAL TAJWID 28 → 20 ─────────────────────────────────────
--
-- Angka 28 yang ada sebelumnya menyamakan Tajwid dengan Gharib. RQ LHI
-- memastikan buku Tajwid UMMI berisi 20 halaman. Perubahan ini ikut terasa di
-- setoran santri yang sedang berada di tahap Tajwid — memang disengaja: satu
-- buku hanya boleh punya satu jumlah halaman.
-- ============================================================

-- 1) Koreksi jumlah halaman buku Tajwid UMMI
UPDATE "jilid_levels" l
   SET "total_pages" = 20
  FROM "tahsin_methods" m
 WHERE l."method_id" = m."id"
   AND m."name" = 'UMMI'
   AND l."label" = 'Tajwid'
   AND l."total_pages" IS DISTINCT FROM 20;

-- 2) Metode tahsin peserta — dipilih sekali, lalu tetap
ALTER TABLE "gukar_participants"
  ADD COLUMN IF NOT EXISTS "metode_id" uuid REFERENCES "tahsin_methods"("id") ON DELETE SET NULL;

-- 3) Posisi tahsin & tahfidz akhir bulan
ALTER TABLE "gukar_monthly"
  ADD COLUMN IF NOT EXISTS "jilid_id"      uuid REFERENCES "jilid_levels"("id") ON DELETE SET NULL,
  -- Halaman ke berapa di dalam jilid itu. NULL untuk tahap yang tidak berbuku
  -- (Al-Qur'an, Talaqqi, Lulus Tahsin).
  ADD COLUMN IF NOT EXISTS "halaman"       smallint,
  -- Dipakai saat tahapnya Al-Qur'an: surat & ayat terakhir yang dibaca.
  ADD COLUMN IF NOT EXISTS "tahsin_surat"  smallint,
  ADD COLUMN IF NOT EXISTS "tahsin_ayat"   smallint,
  -- Setoran hafalan: surat & ayat terakhir yang disetorkan.
  ADD COLUMN IF NOT EXISTS "tahfidz_surat" smallint,
  ADD COLUMN IF NOT EXISTS "tahfidz_ayat"  smallint,
  -- Jarak yang ditempuh bulan ini, dalam halaman. Dihitung saat menyimpan.
  ADD COLUMN IF NOT EXISTS "setoran_tahsin_halaman"  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "setoran_tahfidz_halaman" integer NOT NULL DEFAULT 0;

-- 4) Batas nilai yang masuk akal — menjaring salah ketik sebelum ia jadi
--    angka di rekap SDM.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gukar_monthly_surat_ck') THEN
    ALTER TABLE "gukar_monthly" ADD CONSTRAINT "gukar_monthly_surat_ck" CHECK (
      ("tahsin_surat"  IS NULL OR "tahsin_surat"  BETWEEN 1 AND 114) AND
      ("tahfidz_surat" IS NULL OR "tahfidz_surat" BETWEEN 1 AND 114) AND
      ("tahsin_ayat"   IS NULL OR "tahsin_ayat"   >= 1) AND
      ("tahfidz_ayat"  IS NULL OR "tahfidz_ayat"  >= 1) AND
      ("halaman"       IS NULL OR "halaman"       >= 1)
    );
  END IF;
END $$;

-- Satu-satunya pola baca baru: "posisi peserta ini bulan lalu".
CREATE INDEX IF NOT EXISTS "gukar_monthly_peserta_periode_idx"
  ON "gukar_monthly" ("participant_id", "period" DESC);

-- Verifikasi (opsional):
-- SELECT m.name, l.label, l.total_pages FROM jilid_levels l
--   JOIN tahsin_methods m ON m.id = l.method_id
--  WHERE m.name IN ('UMMI','Syajaroh') ORDER BY m.name, l.order_num;
