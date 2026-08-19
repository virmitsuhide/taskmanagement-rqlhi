-- ============================================================
-- Pembinaan Tahsin & Tahfidz Guru dan Karyawan (Gukar)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : gukar_kind
--   • tabel baru : gukar_groups, gukar_participants, gukar_monthly
--
-- ── KENAPA MODUL SENDIRI, BUKAN MENUMPANG TABEL SANTRI ──────
--
-- Sempat terpikir menambahkan jenjang 'guru_karyawan' ke tabel students agar
-- seluruh mesin setoran bisa dipakai ulang. Rekapan Gukar SIT LHI 2026
-- menunjukkan itu keliru, karena dua hal:
--
--   1. Capaian gukar dicatat sebagai TEKS BEBAS — "Syajaroh 1 hal 32",
--      "Jilid 2 Dewasa", "Ghorib", "Al-Qur'an". Modul santri menuntut
--      jilid_id & halaman berstruktur, yang tidak punya padanan untuk ini.
--   2. Kehadiran dicatat PER PEKAN dalam sebulan (Pekan 1–5) dan ditotal di
--      akhir semester dengan ambang 75%. Santri tidak punya konsep itu sama
--      sekali — kehadirannya disimpulkan dari tanggal setoran.
--
-- Menumpang tabel students juga akan menambah 161 orang dewasa ke hitungan
-- "jumlah santri" di beranda publik dan analitik jenjang, membuat angka RQ
-- tampak jauh lebih besar dari kenyataan.
--
-- ── SATU BARIS PER PESERTA PER BULAN ────────────────────────
--
-- Pembinaan berjalan sepekan sekali, dan yang dilaporkan adalah capaian
-- bulanan beserta kehadiran pekanannya. Karena itu satuan penyimpanannya
-- bulan, bukan tiap pertemuan: satu baris memuat capaian akhir bulan itu
-- plus lima kotak kehadiran. Menyimpan per pertemuan akan memaksa pengampu
-- membuat catatan kosong untuk pekan yang tidak ada pembinaan.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE gukar_kind AS ENUM ('guru', 'karyawan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Kelompok pembinaan ──────────────────────────────────────
-- Terikat semester seperti halaqoh santri: tiap semester bisa diacak ulang
-- tanpa menimpa pembagian semester sebelumnya.
CREATE TABLE IF NOT EXISTS gukar_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id       uuid NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  /** Pengampu kelompok. Boleh kosong sementara sampai ditetapkan. */
  pengampu_id   uuid REFERENCES teachers(id) ON DELETE SET NULL,
  /** Unit apa adanya dari rekap: 'SDIT LHI', 'SMPIT LHI', 'PAUD', 'BPH', … */
  unit          text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (term_id, name)
);

CREATE INDEX IF NOT EXISTS gukar_groups_term_idx ON gukar_groups (term_id, display_order);
CREATE INDEX IF NOT EXISTS gukar_groups_pengampu_idx ON gukar_groups (pengampu_id);

-- ── Peserta ─────────────────────────────────────────────────
-- Peserta disimpan sebagai nama, bukan tautan ke tabel teachers: sebagian
-- besar dari 161 orang adalah pegawai SIT LHI yang tidak punya akun di
-- sistem ini, dan memaksa mereka punya akun hanya demi jadi peserta akan
-- membuat 161 akun yang tidak pernah dipakai login.
CREATE TABLE IF NOT EXISTS gukar_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES gukar_groups(id) ON DELETE CASCADE,
  full_name  text NOT NULL,
  unit       text NOT NULL DEFAULT '',
  kind       gukar_kind,
  /** Level bacaan saat masuk, mis. 'Jilid 4', 'Ghorib', 'Al-Qur''an'. */
  level_awal text NOT NULL DEFAULT '',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (group_id, full_name)
);

CREATE INDEX IF NOT EXISTS gukar_participants_group_idx ON gukar_participants (group_id, full_name);

-- ── Catatan bulanan ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gukar_monthly (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   uuid NOT NULL REFERENCES gukar_participants(id) ON DELETE CASCADE,
  period           date NOT NULL,
  capaian_tahsin   text NOT NULL DEFAULT '',
  capaian_tahfidz  text NOT NULL DEFAULT '',
  -- Lima kotak kehadiran, mengikuti kolom "Pekan ke 1..5" pada rekap.
  -- Disimpan sebagai kolom terpisah, bukan larik atau bitmask, supaya
  -- rekap "berapa kali hadir" cukup penjumlahan biasa di SQL maupun di UI.
  hadir_1          boolean NOT NULL DEFAULT false,
  hadir_2          boolean NOT NULL DEFAULT false,
  hadir_3          boolean NOT NULL DEFAULT false,
  hadir_4          boolean NOT NULL DEFAULT false,
  hadir_5          boolean NOT NULL DEFAULT false,
  /** Jumlah halaman yang ditempuh bulan itu. */
  jumlah_halaman   integer NOT NULL DEFAULT 0,
  catatan          text NOT NULL DEFAULT '',
  recorded_by      uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT gukar_monthly_period_awal_bulan CHECK (EXTRACT(DAY FROM period) = 1),
  CONSTRAINT gukar_monthly_halaman_wajar CHECK (jumlah_halaman >= 0),
  UNIQUE (participant_id, period)
);

CREATE INDEX IF NOT EXISTS gukar_monthly_period_idx ON gukar_monthly (period);

-- Verifikasi (opsional):
-- SELECT g.name, COUNT(p.id) AS peserta
-- FROM gukar_groups g LEFT JOIN gukar_participants p ON p.group_id = g.id
-- GROUP BY g.name ORDER BY g.name;
