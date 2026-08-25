-- ============================================================
-- Guru bisa pindah unit tanpa merusak riwayat penilaiannya
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    ⚠️ Jalankan SETELAH 0034 (tabel kpi_monthly harus sudah ada).
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • kpi_monthly + kolom unit — unit guru SAAT dinilai
--   • tabel baru teacher_unit_moves — catatan tiap perpindahan
--
-- Kenapa unit perlu ikut disimpan di tiap baris penilaian:
--
-- Rubrik SD dan SMP memakai rumus yang sama persis, tapi TIGA parameternya
-- berbeda — target hafalan 3 juz vs 5 juz, poin per juz 20 vs 12, poin per
-- halaman 1 vs 0,6. Nilai indikator "Hafalan Al-Qur'an" karena itu bergantung
-- pada unit.
--
-- Kalau unit hanya tersimpan di teachers.unit, memindahkan seorang guru dari SD
-- ke SMP akan diam-diam MENGHITUNG ULANG seluruh nilai SD-nya di bulan-bulan
-- lalu dengan rubrik SMP. Guru yang hafalan 2 juz-nya dulu bernilai 80 mendadak
-- jadi 64, tanpa ada yang mengubah datanya dan tanpa jejak apa pun. Dengan unit
-- tercatat per baris, tiap bulan selamanya dibaca dengan rubrik yang memang
-- berlaku saat itu.
--
-- teacher_unit_moves bukan sekadar log: mutasi guru adalah keputusan
-- kepegawaian, dan pertanyaan "sejak kapan ia di SMP?" harus bisa dijawab
-- tanpa menebak dari data nilai.
-- ============================================================

ALTER TABLE kpi_monthly
  ADD COLUMN IF NOT EXISTS unit jenjang;

-- Baris yang sudah terlanjur ada (kalau ada) diisi dari unit guru saat ini.
-- Untuk data yang belum pernah mengalami mutasi, itu memang nilai yang benar.
UPDATE kpi_monthly k
   SET unit = t.unit
  FROM teachers t
 WHERE k.teacher_id = t.id
   AND k.unit IS NULL;

CREATE TABLE IF NOT EXISTS teacher_unit_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- NULL kalau sebelumnya guru memang belum punya unit.
  from_unit jenjang,
  to_unit jenjang NOT NULL,
  /** Tanggal mutasi berlaku — bukan tanggal pencatatan. */
  effective_date date NOT NULL,
  notes text,
  moved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_unit_moves_guru_idx
  ON teacher_unit_moves (teacher_id, effective_date DESC);

-- Verifikasi (opsional):
-- SELECT unit, count(*) FROM kpi_monthly GROUP BY unit;
-- SELECT count(*) FROM teacher_unit_moves;
