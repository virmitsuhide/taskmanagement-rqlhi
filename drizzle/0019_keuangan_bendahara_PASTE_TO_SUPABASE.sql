-- ============================================================
-- Modul Keuangan Bendahara — pencatatan, rekap, dan laporan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : finance_account_kind, finance_payment_status
--   • tabel baru : finance_accounts, finance_transactions, finance_funding,
--                  finance_budgets, finance_trust_funds, finance_trust_entries,
--                  finance_program_plans, finance_report_notes
--   • seed       : 7 pos pemasukan + 7 pos pengeluaran + 2 buku dana titipan,
--                  mengikuti Laporan Eksekutif RQ (bab 01 Laporan Keuangan).
--
-- Tabel private_notes LAMA tidak disentuh. "Catatan Keuangan" bebas tetap
-- hidup di /notes; modul ini menambah pencatatan terstruktur di /keuangan.
--
-- ── Dua konsep yang menentukan bentuk skema ini ──────────────
--
-- 1. BASIS KAS. Laporan mengakui pemasukan saat UANG DITERIMA, bukan saat
--    tagihan terbit — lihat "MoU Riyadhoh Februari dan Maret diterima pada
--    bulan ini" di laporan April. Karena itu tiap transaksi punya dua tanggal:
--      • period   = bulan tagihan itu MILIK siapa   (Februari)
--      • paid_at  = kapan uangnya benar-benar masuk (April)
--    Laporan bulan M menjumlahkan baris yang paid_at-nya jatuh di bulan M.
--    Baris berstatus 'piutang' belum punya paid_at dan tidak ikut dijumlah,
--    tapi tetap terlacak lewat period-nya.
--
-- 2. ALOKASI DANA SUMBER. Tabel 1.5 memecah tiap pos pengeluaran menurut
--    sumber dananya (Gaji YYS dibiayai Subsidi + SD + SMP + Ekstra + Lain).
--    Karena satu pengeluaran bisa dibiayai beberapa sumber, relasinya
--    many-to-many lewat finance_funding — bukan satu kolom sumber.
--    Alokasi bersifat OPSIONAL: pengeluaran tanpa baris alokasi dianggap
--    "belum dialokasikan" dan ditandai di laporan, bukan ditolak.
-- ============================================================

-- ── Enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE finance_account_kind AS ENUM ('pemasukan', 'pengeluaran');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finance_payment_status AS ENUM ('lunas', 'piutang');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Master pos pemasukan & pengeluaran ──────────────────────
-- Baris tabel 1.2 dan 1.3 laporan. Urutan tampil disimpan supaya susunan
-- baris laporan tetap sama tiap bulan tanpa perlu di-hardcode di UI.
CREATE TABLE IF NOT EXISTS finance_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          finance_account_kind NOT NULL,
  slug          text NOT NULL,
  name          text NOT NULL,
  /** Catatan tetap soal pos ini — muncul sebagai bantuan saat input. */
  hint          text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (kind, slug)
);

CREATE INDEX IF NOT EXISTS finance_accounts_order_idx
  ON finance_accounts (kind, display_order);

-- ── Transaksi (realisasi) ───────────────────────────────────
-- period selalu dinormalkan ke tanggal 1 supaya pengelompokan per bulan
-- cukup pakai kesamaan nilai, tanpa date_trunc di setiap query.
CREATE TABLE IF NOT EXISTS finance_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  period      date NOT NULL,
  /** Rupiah bulat — RQ tidak pernah mencatat sen. */
  amount      integer NOT NULL,
  description text NOT NULL DEFAULT '',
  status      finance_payment_status NOT NULL DEFAULT 'lunas',
  paid_at     date,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT finance_transactions_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1),
  CONSTRAINT finance_transactions_amount_positif CHECK (amount > 0),
  -- Lunas wajib bertanggal bayar, piutang wajib tidak — mencegah baris
  -- setengah jadi yang bikin total laporan meleset tanpa ketahuan.
  CONSTRAINT finance_transactions_status_selaras CHECK (
    (status = 'lunas'   AND paid_at IS NOT NULL) OR
    (status = 'piutang' AND paid_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS finance_transactions_paid_idx
  ON finance_transactions (paid_at);
CREATE INDEX IF NOT EXISTS finance_transactions_period_idx
  ON finance_transactions (period, account_id);
CREATE INDEX IF NOT EXISTS finance_transactions_piutang_idx
  ON finance_transactions (status, period) WHERE status = 'piutang';

-- ── Alokasi dana sumber (matriks tabel 1.5) ─────────────────
CREATE TABLE IF NOT EXISTS finance_funding (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  uuid NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  source_slug     text NOT NULL,
  amount          integer NOT NULL,
  CONSTRAINT finance_funding_amount_positif CHECK (amount > 0),
  UNIQUE (transaction_id, source_slug)
);

COMMENT ON COLUMN finance_funding.source_slug IS
  'Slug pos pemasukan (finance_accounts.slug, kind=pemasukan) yang membiayai. Disimpan sebagai slug, bukan FK id, supaya kolom matriks laporan lama tidak ikut berubah kalau pos pemasukan dinonaktifkan.';

CREATE INDEX IF NOT EXISTS finance_funding_trx_idx
  ON finance_funding (transaction_id);

-- ── Anggaran per pos per bulan (tabel 1.5) ──────────────────
CREATE TABLE IF NOT EXISTS finance_budgets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  period     date NOT NULL,
  amount     integer NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT finance_budgets_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1),
  CONSTRAINT finance_budgets_amount_wajar CHECK (amount >= 0),
  UNIQUE (account_id, period)
);

-- ── Dana titipan (bab 1.4) ──────────────────────────────────
-- Saldo awal disimpan sekali di buku-nya, bukan diketik ulang tiap bulan:
-- saldo akhir bulan berjalan = saldo awal buku + seluruh mutasi s.d. bulan itu.
-- Dengan begitu koreksi mutasi lama otomatis merambat ke bulan-bulan sesudahnya.
CREATE TABLE IF NOT EXISTS finance_trust_funds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  opening_balance integer NOT NULL DEFAULT 0,
  /** Tanggal berlakunya saldo awal — mutasi sebelum tanggal ini diabaikan. */
  opening_date    date NOT NULL DEFAULT '2026-01-01',
  display_order   integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_trust_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id     uuid NOT NULL REFERENCES finance_trust_funds(id) ON DELETE CASCADE,
  entry_date  date NOT NULL,
  description text NOT NULL,
  /** Bertanda: positif = dana masuk, negatif = dana diambil. */
  amount      integer NOT NULL,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT finance_trust_entries_amount_bukan_nol CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS finance_trust_entries_fund_idx
  ON finance_trust_entries (fund_id, entry_date);

-- ── Rencana pengeluaran program bulan depan (bab 2.1) ───────
-- period = bulan yang DIRENCANAKAN (Mei), meski tampil di laporan April.
CREATE TABLE IF NOT EXISTS finance_program_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period         date NOT NULL,
  name           text NOT NULL,
  funding_source text NOT NULL DEFAULT '',
  amount         integer NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT finance_program_plans_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1)
);

CREATE INDEX IF NOT EXISTS finance_program_plans_period_idx
  ON finance_program_plans (period);

-- ── Narasi laporan ──────────────────────────────────────────
-- Bagian laporan yang memang harus ditulis manusia: evaluasi anggaran (1.5),
-- analisis kemandirian (1.9), komentar diagram (1.2.2 & 1.3.2).
CREATE TABLE IF NOT EXISTS finance_report_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period     date NOT NULL,
  section    text NOT NULL,
  content    text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT finance_report_notes_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1),
  UNIQUE (period, section)
);

-- ── Seed pos, mengikuti susunan baris laporan ───────────────
INSERT INTO finance_accounts (kind, slug, name, hint, display_order) VALUES
  ('pemasukan', 'subsidi_yayasan',    'Subsidi Yayasan',    'Gaji guru tetap dan tidak tetap yang tersubsidi bulan ini.', 1),
  ('pemasukan', 'proposal_yayasan',   'Proposal Yayasan',   'Proposal program yang diajukan ke Yayasan.',                 2),
  ('pemasukan', 'sd',                 'SD',                 'MoU SD dan penjualan buku.',                                 3),
  ('pemasukan', 'sd_quls_takhassus',  'SD Quls Takhassus',  'Iuran SD Quls Takhassus.',                                   4),
  ('pemasukan', 'smp',                'SMP',                'MoU Reguler, Riyadhoh, dan Quls SMP.',                       5),
  ('pemasukan', 'ekstra',             'Ekstra',             'Kursus, privat keluarga, privat individu, privat kelompok.', 6),
  ('pemasukan', 'lain_lain',          'Lain-lain',          'Penjualan buku ummi & buku prestasi stock RQ.',              7),
  ('pengeluaran', 'gaji_yys',           'Gaji Tetap/Tidak Tetap YYS', 'Termasuk kafalah mentoring Qur''an.',       1),
  ('pengeluaran', 'gaji_os_sd',         'Gaji OS SD',                 'Honor guru OS jenjang SD.',                 2),
  ('pengeluaran', 'gaji_os_smp',        'Gaji OS SMP',                'Reguler, Quls, dan Riyadhoh SMP.',          3),
  ('pengeluaran', 'gaji_ekstra',        'Gaji Ekstra',                'Honor pengampu ekstra.',                    4),
  ('pengeluaran', 'biaya_operasional',  'Biaya Operasional',          'Listrik, ATK, snack rapat, dana sosial.',   5),
  ('pengeluaran', 'program',            'Program',                    'Belanja program kerja RQ.',                 6),
  ('pengeluaran', 'lain_lain',          'Lain-lain',                  'Pembelian buku pesanan dan sejenisnya.',    7)
ON CONFLICT (kind, slug) DO NOTHING;

INSERT INTO finance_trust_funds (slug, name, display_order) VALUES
  ('lain_lain',       'Dana Titipan Lain-lain',       1),
  ('program_liburan', 'Dana Titipan Program Liburan', 2)
ON CONFLICT (slug) DO NOTHING;

-- Verifikasi (opsional):
-- SELECT kind, slug, name, display_order FROM finance_accounts ORDER BY kind, display_order;
-- SELECT slug, name, opening_balance FROM finance_trust_funds ORDER BY display_order;
