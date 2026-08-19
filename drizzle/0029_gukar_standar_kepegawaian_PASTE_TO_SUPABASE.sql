-- ============================================================
-- Gukar: capaian berstruktur & status kepegawaian
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : gukar_status_pegawai
--   • kolom baru : gukar_participants.status_pegawai, .kategori_peran
--   • kolom baru : gukar_monthly.tahap_tahsin, .juz_tuntas, .juz_berjalan,
--                  .nilai_tahfidz, .surat_pilihan
--
-- ── KENAPA CAPAIAN PERLU BERSTRUKTUR ────────────────────────
--
-- Laporan Eksekutif SDM Juni 2026 menutup dengan satu temuan tentang data,
-- bukan tentang orang: "Capaian berupa free-text; sulit dibandingkan otomatis
-- ke standar", dengan rekomendasi "Standarkan format input (jilid, juz, nilai,
-- surat pilihan) — selaras rencana web app operasional RQ."
--
-- Analisis pada laporan itu memang harus menebak: ambang "≥ 1 juz" di sana
-- DIESTIMASI dari surah terjauh yang tertulis bebas. Estimasi itu cukup untuk
-- satu laporan, tetapi tidak cukup untuk keputusan kepegawaian — berkas
-- pegawai tetap ditutup 30 Juni dan keputusannya mengikat kontrak 5 tahun.
--
-- Karena itu kolom teks bebas TIDAK dihapus: ia tetap tempat pengampu menulis
-- apa adanya ("Al-Buruj (Juz 30)", "Jilid 4 drill"), dan seluruh data rekap
-- 2026 yang sudah ada tetap terbaca. Yang ditambahkan adalah lima kolom
-- terukur di sebelahnya. Bila kolom terukur kosong, analitik jatuh kembali
-- membaca teks bebasnya — jadi pengampu tidak dipaksa mengisi ulang masa lalu.
--
-- ── KENAPA STATUS PEGAWAI DISIMPAN DI PESERTA ───────────────
--
-- Bab 06 laporan memisahkan tiga kelompok tindak lanjut: calon pegawai tetap
-- yang dipacu sebelum batas berkas, pegawai tetap yang capaiannya justru di
-- bawah standar pemeliharaan, dan kelompok yang belum terdata sama sekali.
-- Ketiganya tidak bisa disimpulkan dari data setoran; statusnya keputusan
-- kepegawaian.
--
-- Tidak dititipkan ke teachers.employment_type karena peserta gukar bukan
-- baris teachers: mayoritas dari 161 peserta adalah pegawai SIT LHI yang
-- tidak punya akun di sistem ini (lihat alasan lengkap di 0023).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE gukar_status_pegawai AS ENUM ('tetap', 'calon_tetap', 'kontrak');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Peserta: status kepegawaian & kategori peran ────────────
ALTER TABLE gukar_participants
  /** NULL = belum ditetapkan SDM. */
  ADD COLUMN IF NOT EXISTS status_pegawai gukar_status_pegawai,
  /** Kunci baris standar kepegawaian, mis. 'guru_kelas', 'guru_quran'.
      Menentukan ambang tahsin & tahfidz mana yang dipakai membandingkan. */
  ADD COLUMN IF NOT EXISTS kategori_peran text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS gukar_participants_status_idx
  ON gukar_participants (status_pegawai) WHERE status_pegawai IS NOT NULL;

-- ── Catatan bulanan: capaian terukur di samping teks bebas ──
ALTER TABLE gukar_monthly
  /** Tahap tahsin baku: 'Jilid 1'…'Jilid 6', 'Al-Qur''an', 'Ghorib',
      'Tajwid', 'Tashih', 'Syajaroh', 'Belum mengaji'. Kosong = belum diisi
      terstruktur, analitik membaca capaian_tahsin sebagai gantinya. */
  ADD COLUMN IF NOT EXISTS tahap_tahsin text NOT NULL DEFAULT '',
  /** Jumlah juz yang SUDAH tuntas. 0 berarti masih dalam juz pertama. */
  ADD COLUMN IF NOT EXISTS juz_tuntas smallint,
  /** Nomor juz yang sedang dihafal, mis. 30 atau 29. */
  ADD COLUMN IF NOT EXISTS juz_berjalan smallint,
  /** Nilai ujian hafalan 0–100 → predikat Mumtaz/Jayyid Jiddan/Jayyid/Maqbul. */
  ADD COLUMN IF NOT EXISTS nilai_tahfidz smallint,
  /** Banyak surat pilihan di luar juz yang sudah dikuasai. */
  ADD COLUMN IF NOT EXISTS surat_pilihan smallint NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE gukar_monthly ADD CONSTRAINT gukar_monthly_juz_tuntas_wajar
    CHECK (juz_tuntas IS NULL OR juz_tuntas BETWEEN 0 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gukar_monthly ADD CONSTRAINT gukar_monthly_juz_berjalan_wajar
    CHECK (juz_berjalan IS NULL OR juz_berjalan BETWEEN 1 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gukar_monthly ADD CONSTRAINT gukar_monthly_nilai_tahfidz_wajar
    CHECK (nilai_tahfidz IS NULL OR nilai_tahfidz BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE gukar_monthly ADD CONSTRAINT gukar_monthly_surat_pilihan_wajar
    CHECK (surat_pilihan BETWEEN 0 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verifikasi (opsional):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'gukar_monthly' ORDER BY ordinal_position;
