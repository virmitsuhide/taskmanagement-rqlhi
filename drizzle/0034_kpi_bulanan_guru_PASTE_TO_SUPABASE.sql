-- ============================================================
-- KPI bulanan guru Qur'an
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru kpi_monthly — satu baris per guru per bulan
--
-- Sumber rubriknya: KPI_Bulanan_Guru_SD_RQ_LHI_TA20262027.xlsx. Sebelas
-- indikatornya TIDAK disimpan sebagai kolom nilai, hanya bahan mentahnya —
-- nilai dihitung ulang oleh lib/kpi/hitung.ts setiap kali dibaca.
--
-- Kenapa begitu: rumus dan parameter (target juz, jumlah pertemuan halaqoh,
-- bobot per bait) masih mungkin disesuaikan unit. Kalau nilai jadinya ikut
-- disimpan, mengubah satu parameter akan membuat data lama dan data baru
-- dihitung dengan aturan berbeda tanpa ada tandanya, dan tidak ada cara
-- mengetahui baris mana yang memakai aturan yang mana. Menyimpan bahan mentah
-- membuat seluruh riwayat selalu dibaca dengan aturan yang berlaku sekarang.
--
-- Grid harian disimpan sebagai array, bukan tabel terpisah: isinya selalu
-- dibaca dan ditulis sekaligus satu bulan penuh, tidak pernah per hari, jadi
-- tabel anak hanya menambah sambungan tanpa menambah kemampuan.
--
-- Kolom *_total adalah jalan pintas "isi total langsung". NULL berarti pakai
-- grid hariannya; terisi berarti SDM sengaja melewati rincian harian.
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Isian bulanan (kolom E–N tab "Input")
  late_minutes            numeric NOT NULL DEFAULT 0,
  db_late_days            numeric NOT NULL DEFAULT 0,
  hafalan_juz             numeric NOT NULL DEFAULT 0,
  hafalan_pages           numeric NOT NULL DEFAULT 0,
  tuhfatul_bait           numeric NOT NULL DEFAULT 0,
  bacaan_score            numeric NOT NULL DEFAULT 0,
  buku_pegangan_meetings  numeric NOT NULL DEFAULT 0,
  izin_wa_cases           numeric NOT NULL DEFAULT 0,
  pengganti_cases         numeric NOT NULL DEFAULT 0,
  pengganti_found         numeric NOT NULL DEFAULT 0,

  -- Grid harian
  seragam_daily     integer[],
  lapor_ortu_daily  integer[],
  halaqoh_hadir     integer[],
  halaqoh_akhiri    integer[],

  -- Jalan pintas total (NULL = pakai grid di atas)
  seragam_total     numeric,
  lapor_ortu_total  numeric,
  halaqoh_total     numeric,

  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Satu guru hanya punya satu baris per bulan; ini juga yang membuat
  -- penyimpanan bisa memakai upsert tanpa perlu cek dulu.
  CONSTRAINT kpi_monthly_guru_periode_unik UNIQUE (teacher_id, year, month)
);

CREATE INDEX IF NOT EXISTS kpi_monthly_periode_idx ON kpi_monthly (year, month);

-- Verifikasi (opsional):
-- SELECT count(*) FROM kpi_monthly;
