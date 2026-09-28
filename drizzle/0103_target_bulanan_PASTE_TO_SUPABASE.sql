-- ============================================================
-- Target bulanan tahsin & tahfidz per unit (menu Kumik)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang). Sesudahnya isian awal:
--        npm run seed:target-bulanan
--
-- Yang berubah:
--   • tabel baru : target_bulanan        — rentang "sesuai target" per
--                  tahun ajaran × bulan × unit × kelompok × kelas × jenis
--   • tabel baru : target_bulanan_ambang — lebar kategori di luar rentang,
--                  per unit × jenis, dalam halaman
--
-- ── KENAPA ──────────────────────────────────────────────────
--
-- Kumik menetapkan, tiap bulan, rentang posisi yang dianggap SESUAI target
-- untuk tiap kelas (mis. kelas 1 Juli: Jilid 1 hal 1 – Jilid 1 hal 5). Empat
-- kategori lain dihitung dari jarak ke rentang itu (lib/rq/target-bulanan.ts):
--
--   jauh di bawah │ di bawah │   SESUAI   │ melampaui │ sangat melampaui
--   ──────────────┼──────────┼────────────┼───────────┼─────────────────
--                 awal−bawah awal       akhir   akhir+atas
--
-- Posisi tahsin = metode + tahap (label jilid_levels) + halaman.
-- Posisi tahfidz = surat + ayat. Kolom yang bukan jenisnya dibiarkan NULL.
-- ============================================================

CREATE TABLE IF NOT EXISTS target_bulanan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun_ajaran text NOT NULL,              -- '2026/2027'
  bulan text NOT NULL,                     -- 'YYYY-MM'
  jenjang jenjang NOT NULL,
  kelompok text NOT NULL,                  -- 'semua' | 'clil' | 'quls' | 'internal' | 'eksternal'
  tingkat smallint NOT NULL,
  jenis text NOT NULL,                     -- 'tahsin' | 'tahfidz'

  metode text,                             -- tahsin: UMMI | KIBAR | IQRO | Syajaroh
  awal_tahap text,
  awal_halaman smallint,
  akhir_tahap text,
  akhir_halaman smallint,

  awal_surat smallint,
  awal_ayat smallint,
  akhir_surat smallint,
  akhir_ayat smallint,

  keterangan text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT target_bulanan_jenis_sah CHECK (jenis IN ('tahsin', 'tahfidz')),
  CONSTRAINT target_bulanan_bulan_sah CHECK (bulan ~ '^\d{4}-\d{2}$'),
  CONSTRAINT target_bulanan_tingkat_sah CHECK (tingkat BETWEEN 0 AND 12),
  CONSTRAINT target_bulanan_unik UNIQUE (tahun_ajaran, bulan, jenjang, kelompok, tingkat, jenis)
);

CREATE INDEX IF NOT EXISTS target_bulanan_cari_idx
  ON target_bulanan (tahun_ajaran, jenjang, jenis, kelompok);

CREATE TABLE IF NOT EXISTS target_bulanan_ambang (
  jenjang jenjang NOT NULL,
  jenis text NOT NULL,
  -- Lebar "di bawah" di belakang awal rentang, dan "melampaui" di depan akhir
  -- rentang, dalam halaman. Lewat dari itu: jauh di bawah / sangat melampaui.
  bawah numeric NOT NULL,
  atas numeric NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jenjang, jenis),
  CONSTRAINT target_bulanan_ambang_jenis_sah CHECK (jenis IN ('tahsin', 'tahfidz')),
  CONSTRAINT target_bulanan_ambang_positif CHECK (bawah >= 0 AND atas >= 0)
);

-- Ambang bawaan: tahsin 5 halaman ke tiap arah; tahfidz 2 halaman tertinggal
-- dan 1 juz (20 halaman) melampaui — sama dengan ambang melampaui yang sudah
-- dipakai Analitik target tahfidz.
INSERT INTO target_bulanan_ambang (jenjang, jenis, bawah, atas)
SELECT j::jenjang, x.jenis, x.bawah, x.atas
  FROM unnest(ARRAY['paud', 'sd', 'sd_juara', 'smp', 'sma']) AS j
 CROSS JOIN (VALUES ('tahsin', 5, 5), ('tahfidz', 2, 20)) AS x(jenis, bawah, atas)
ON CONFLICT (jenjang, jenis) DO NOTHING;

-- Verifikasi (opsional):
-- SELECT * FROM target_bulanan_ambang ORDER BY 1, 2;   -- 10 baris
