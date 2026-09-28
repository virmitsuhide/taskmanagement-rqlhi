-- ============================================================
-- Panduan Guru — SOP & dokumen PDF untuk guru Qur'an
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru  : panduan_guru
--   • bucket baru : panduan-guru (PRIVAT, hanya PDF, maks 25 MB)
--
-- ── SIAPA MENGUNGGAH, SIAPA MEMBACA ─────────────────────────
--
--   sasaran 'semua'    ← Kepala RQ, Bendahara, SDM, Kumik, Koor Ekstra
--   sasaran unit       ← koordinator unitnya: paud (TPAIT), sd, sd_juara,
--                        smp, sma
--   sasaran 'quls_sd'  ← Koor QULS SD
--
-- Guru membaca dokumen 'semua' ditambah dokumen unit tempat ia ditempatkan
-- atau mengampu halaqoh (lib/data/panduan-guru.ts). Bucket-nya privat: berkas
-- hanya bisa dibuka lewat tautan bertanda tangan yang dibuat server sesudah
-- izinnya diperiksa, jadi alamat berkas tidak bisa dibagikan ke luar.
-- ============================================================

CREATE TABLE IF NOT EXISTS panduan_guru (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  kategori text NOT NULL,
  keterangan text NOT NULL DEFAULT '',
  sasaran text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  diunggah_oleh uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT panduan_guru_kategori_sah CHECK (kategori IN ('sop_kepegawaian', 'sop_pembelajaran', 'sop_keuangan', 'dokumen')),
  CONSTRAINT panduan_guru_sasaran_sah CHECK (sasaran IN ('semua', 'paud', 'sd', 'sd_juara', 'smp', 'sma', 'quls_sd'))
);

CREATE INDEX IF NOT EXISTS panduan_guru_sasaran_idx ON panduan_guru (sasaran, kategori);

ALTER TABLE panduan_guru ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('panduan-guru', 'panduan-guru', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Verifikasi (opsional):
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'panduan-guru';
