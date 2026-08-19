-- ============================================================
-- Tahun ajaran, halaqoh per semester, sesi mengajar, & status guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru : academic_terms, halaqoh_members, halaqoh_sessions
--   • halaqoh    + term_id            → halaqoh milik satu semester
--   • teachers   + employment_type, contract_start, contract_end
--   • backfill   : satu tahun ajaran berjalan dibuat, seluruh halaqoh dan
--                  penempatan santri yang ada sekarang dipindahkan ke sana.
--
-- ── MASALAH YANG DISELESAIKAN ───────────────────────────────
--
-- Tiap semester santri dan guru diacak ulang, dan guru OS berganti tiap tahun.
-- Model lama hanya menyimpan KEADAAN SEKARANG: students.halaqoh_id satu
-- pointer, halaqoh_teachers tanpa dimensi waktu. Begitu pembagian baru dibuat,
-- pembagian lama tertimpa dan tidak bisa dipulihkan.
--
-- Akibat nyatanya ada di rapor: nama halaqoh dan wali diambil dari penempatan
-- santri yang berlaku sekarang, sehingga rapor Semester 1 yang dicetak setelah
-- pengacakan Semester 2 akan menampilkan halaqoh dan ustadz yang keliru.
--
-- ── PRINSIP RANCANGAN ───────────────────────────────────────
--
-- Capaian menempel pada ANAK, bukan pada halaqoh atau gurunya. Itu sudah
-- benar sejak awal: tahsin_logs & tahfidz_logs menyimpan student_id beserta
-- teacher_id dan halaqoh_id sebagai rekaman saat setoran terjadi. Tabel-tabel
-- itu SENGAJA TIDAK DISENTUH migrasi ini — justru merekalah alasan setoran
-- selamat dari pergantian guru.
--
-- Yang ditambahkan hanyalah dimensi waktu pada sisi pengelompokan:
--   • halaqoh milik satu semester (term_id). Mengacak ulang = membuat baris
--     halaqoh baru untuk semester berikutnya, bukan menimpa yang lama.
--   • keanggotaan santri dicatat di halaqoh_members, jadi "anak ini di halaqoh
--     mana pada Semester 1" tetap bisa dijawab bertahun-tahun kemudian.
--
-- students.halaqoh_id SENGAJA DIPERTAHANKAN sebagai penunjuk penempatan yang
-- berlaku sekarang. Ia dipakai di puluhan tempat untuk pertanyaan "halaqoh
-- anak ini sekarang apa?" — pertanyaan yang tetap sah dan tidak perlu jadi
-- JOIN di setiap layar. Sumber kebenaran riwayat ada di halaqoh_members;
-- pointer ini turunannya, disegarkan saat penempatan berubah.
-- ============================================================

-- ── Enum ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE academic_semester AS ENUM ('ganjil', 'genap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tiga jenis kepegawaian yang berlaku di RQ. Nama posnya sengaja selaras
-- dengan pos gaji di laporan keuangan (Gaji Tetap/Tidak Tetap YYS vs Gaji OS)
-- supaya beban gaji bisa ditelusuri sampai ke orangnya.
DO $$ BEGIN
  CREATE TYPE teacher_employment AS ENUM ('tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tahun ajaran ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_terms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Label tahun ajaran, mis. '2025/2026'. */
  year_label text NOT NULL,
  semester   academic_semester NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  /** Semester yang sedang berjalan. Dijaga hanya satu lewat index unik. */
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (year_label, semester),
  CONSTRAINT academic_terms_rentang_masuk_akal CHECK (end_date > start_date)
);

-- Hanya boleh ada satu semester berjalan. Dijaga database, bukan sekadar
-- disiplin aplikasi — dua semester aktif membuat setiap query "halaqoh
-- sekarang" mengembalikan dua himpunan yang bertabrakan.
CREATE UNIQUE INDEX IF NOT EXISTS academic_terms_satu_yang_berjalan
  ON academic_terms ((is_current)) WHERE is_current;

-- ── Halaqoh milik satu semester ─────────────────────────────
ALTER TABLE halaqoh ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES academic_terms(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS halaqoh_term_idx ON halaqoh (term_id, jenjang);

-- ── Keanggotaan santri per halaqoh ──────────────────────────
-- Karena halaqoh sudah milik satu semester, keanggotaan di sini otomatis
-- ikut bersemester — tidak perlu term_id lagi di sini.
CREATE TABLE IF NOT EXISTS halaqoh_members (
  halaqoh_id uuid NOT NULL REFERENCES halaqoh(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at  date NOT NULL DEFAULT CURRENT_DATE,
  /** Terisi kalau santri pindah halaqoh di tengah semester. */
  left_at    date,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (halaqoh_id, student_id)
);

CREATE INDEX IF NOT EXISTS halaqoh_members_student_idx ON halaqoh_members (student_id);

-- ── Sesi mengajar (jadwal nyata) ────────────────────────────
-- Sesi menempel pada halaqoh, bukan pada guru: yang punya jadwal tetap adalah
-- kelompoknya, sedangkan gurunya bisa berganti tanpa mengubah jadwal. Beban
-- mengajar seorang guru OS ("2 sesi" / "3 sesi") dihitung dari jumlah sesi
-- seluruh halaqoh yang diampunya pada semester berjalan.
CREATE TABLE IF NOT EXISTS halaqoh_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  halaqoh_id  uuid NOT NULL REFERENCES halaqoh(id) ON DELETE CASCADE,
  /** 1 = Senin … 7 = Ahad, mengikuti ISO-8601. */
  day_of_week smallint NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT halaqoh_sessions_hari_sah CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT halaqoh_sessions_jam_sah CHECK (end_time > start_time),
  -- Satu halaqoh tidak mungkin punya dua sesi yang mulai bersamaan di hari
  -- yang sama; ini menangkap input ganda saat menyusun jadwal.
  UNIQUE (halaqoh_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS halaqoh_sessions_halaqoh_idx ON halaqoh_sessions (halaqoh_id, day_of_week, start_time);

-- ── Status kepegawaian & masa kontrak guru ──────────────────
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employment_type teacher_employment;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS contract_start date;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS contract_end date;

COMMENT ON COLUMN teachers.contract_end IS
  'Hari terakhir kontrak berlaku (inklusif). Lewat tanggal ini akses login dicabut otomatis oleh getTeacherSession() — guru tetap yayasan dibiarkan NULL agar tidak pernah kedaluwarsa.';

-- Guru OS yang kontraknya segera habis perlu bisa didaftar cepat menjelang
-- pergantian tahun ajaran.
CREATE INDEX IF NOT EXISTS teachers_contract_end_idx
  ON teachers (contract_end)
  WHERE contract_end IS NOT NULL AND deleted_at IS NULL;

-- ── Backfill: pindahkan keadaan sekarang ke semester berjalan ──
-- Tanggal semester dibuat lebar (Juli–Juni) supaya data yang sudah ada pasti
-- tercakup; Kepala RQ tinggal merapikannya lewat panel tahun ajaran.
INSERT INTO academic_terms (year_label, semester, start_date, end_date, is_current)
SELECT '2025/2026', 'genap', DATE '2026-01-01', DATE '2026-06-30', true
WHERE NOT EXISTS (SELECT 1 FROM academic_terms);

-- Seluruh halaqoh yang belum bersemester dianggap milik semester berjalan.
UPDATE halaqoh
SET term_id = (SELECT id FROM academic_terms WHERE is_current LIMIT 1)
WHERE term_id IS NULL;

-- Penempatan santri yang sekarang jadi baris keanggotaan pertama. Tanpa ini
-- semester berjalan akan terlihat kosong riwayatnya begitu ada pengacakan.
INSERT INTO halaqoh_members (halaqoh_id, student_id, joined_at)
SELECT s.halaqoh_id, s.id, COALESCE(s.enrolled_at, CURRENT_DATE)
FROM students s
WHERE s.halaqoh_id IS NOT NULL
ON CONFLICT (halaqoh_id, student_id) DO NOTHING;

-- Verifikasi (opsional):
-- SELECT year_label, semester, is_current FROM academic_terms;
-- SELECT COUNT(*) AS halaqoh_tanpa_semester FROM halaqoh WHERE term_id IS NULL;
-- SELECT COUNT(*) AS anggota_terdaftar FROM halaqoh_members;
