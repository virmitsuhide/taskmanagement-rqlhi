-- ============================================================
-- Target tahsin & tahfidz per angkatan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru : kurikulum_targets
--   • seed       : target Semester Ganjil mengikuti Laporan Eksekutif April 2026
--
-- ── KENAPA PERLU DISIMPAN ───────────────────────────────────
--
-- Bab 02 laporan menghitung "berapa siswa mencapai target" per angkatan —
-- Kelas 1 target Jilid 2, Kelas 4 target Tajwid, Kelas 6 target Tahfidz.
-- Angka itu tidak bisa diturunkan dari data siswa: target adalah keputusan
-- kurikulum, bukan hasil pengukuran.
--
-- Target berbeda tiap semester. Catatan kaki laporan April menjelaskan bahwa
-- persentase turun di hampir semua jenjang bukan karena kemampuan siswa
-- menurun, melainkan karena target semester dinaikkan. Karena itu target
-- diikat ke semester (term_id) — kalau disimpan sebagai satu nilai global,
-- membandingkan antar semester jadi menyesatkan dan riwayatnya hilang.
--
-- Level ditulis sebagai teks yang sama persis dengan tangga di
-- lib/rq/level.ts: 'Jilid 1'…'Jilid 6', 'Al-Qur''an', 'Gharib', 'Tajwid',
-- 'Tahfidz'. Bukan FK ke jilid_levels karena tabel itu memuat label kembar
-- untuk tiap metode (enam baris berlabel 'Jilid 1'), sehingga tidak bisa
-- dipakai sebagai tangga tunggal lintas metode.
-- ============================================================

CREATE TABLE IF NOT EXISTS kurikulum_targets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id       uuid NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  jenjang       jenjang NOT NULL,
  /** Tingkat kelas: 1-6 untuk SD, 7-9 untuk SMP. */
  tingkat       smallint NOT NULL,
  /** Target tahsin, mis. 'Jilid 2' atau 'Tajwid'. Kosong = belum ditetapkan. */
  target_tahsin text NOT NULL DEFAULT '',
  /** Target tahfidz sebagai nomor juz, mis. 30. NULL = tanpa target. */
  target_juz    smallint,
  catatan       text NOT NULL DEFAULT '',
  updated_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT kurikulum_targets_tingkat_sah CHECK (tingkat BETWEEN 1 AND 12),
  CONSTRAINT kurikulum_targets_juz_sah CHECK (target_juz IS NULL OR target_juz BETWEEN 1 AND 30),
  UNIQUE (term_id, jenjang, tingkat)
);

CREATE INDEX IF NOT EXISTS kurikulum_targets_term_idx ON kurikulum_targets (term_id, jenjang, tingkat);

-- ── Seed dari Laporan Eksekutif April 2026 ──────────────────
-- Angka ini target Semester 2 TA 2025/2026. Diisikan ke semester berjalan
-- sebagai titik awal supaya dashboard langsung punya pembanding; Kumik
-- tinggal menyesuaikannya lewat panel bila target semester ini berbeda.
INSERT INTO kurikulum_targets (term_id, jenjang, tingkat, target_tahsin, target_juz, catatan)
SELECT t.id, v.jenjang::jenjang, v.tingkat, v.target_tahsin, v.target_juz,
       'Disalin dari Laporan Eksekutif April 2026 — sesuaikan bila target semester ini berbeda'
FROM academic_terms t
CROSS JOIN (VALUES
  ('sd',  1, 'Jilid 2',   30),
  ('sd',  2, 'Jilid 4',   30),
  ('sd',  3, 'Jilid 6',   29),
  ('sd',  4, 'Tajwid',    29),
  ('sd',  5, 'Tahfidz',   28),
  ('sd',  6, 'Tahfidz',   28),
  ('smp', 7, 'Jilid 6',   30),
  ('smp', 8, 'Al-Qur''an', 29),
  ('smp', 9, 'Tahfidz',   28)
) AS v(jenjang, tingkat, target_tahsin, target_juz)
WHERE t.is_current
ON CONFLICT (term_id, jenjang, tingkat) DO NOTHING;

-- Verifikasi (opsional):
-- SELECT jenjang, tingkat, target_tahsin, target_juz FROM kurikulum_targets ORDER BY jenjang, tingkat;
