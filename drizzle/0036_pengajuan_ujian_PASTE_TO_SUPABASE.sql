-- ============================================================
-- Pengajuan ujian tahsin & tahfidz
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru ujian_pengujis  — daftar nama penguji (dipakai SD & SMP)
--   • tabel baru ujian_tahfidz   — satu baris per siswa yang tasmi'
--   • tabel baru ujian_tahsin    — satu baris per kelompok yang diuji
--   • kolom baru users.ujian_seen_at — penanda badge "pengajuan baru"
--
-- Modul ini berdiri sendiri dari tahsin_logs/tahfidz_logs. Setoran harian
-- mencatat apa yang SUDAH terjadi di halaqoh; pengajuan ujian mencatat
-- permintaan yang BELUM terjadi dan menunggu koordinator menjadwalkannya.
-- Keduanya bertemu di siswa yang sama tapi tidak saling mengunci: nama siswa
-- di sini sengaja teks bebas, sebab yang diajukan kerap anak yang datanya
-- belum lengkap di master siswa, dan antrian ujian tidak boleh tertahan
-- karena itu.
--
-- unit ditulis 'SD'/'SMP', bukan enum jenjang. Antrian ujian hanya mengenal
-- dua unit ini — PAUD, SD Juara, dan SMA tidak menjalankannya — sehingga
-- memakai enum lima nilai justru mengundang baris yang tak punya koordinator.
--
-- Pengaju bisa datang dari dua jenis akun: guru lewat portal /guru
-- (created_by_teacher) atau pengurus lewat dashboard (created_by_user).
-- Keduanya nullable dan hanya satu yang terisi.
-- ============================================================

-- Fungsi trigger updated_at — dibuat di sini juga supaya file ini bisa
-- dijalankan pada database yang belum pernah menerima migrasi 0004.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Daftar penguji ─────────────────────────────────────────
-- Satu daftar bersama SD & SMP. Sengaja tidak menunjuk ke tabel teachers:
-- penguji tasmi' kerap dari luar RQ (musyrif yayasan, tamu), dan nama yang
-- sudah tercatat pada ujian lampau harus tetap terbaca walau orangnya sudah
-- tidak aktif. Karena itu kolom penguji pada tabel ujian pun teks, bukan id.
CREATE TABLE IF NOT EXISTS ujian_pengujis (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- ─── Pengajuan tahfidz ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ujian_tahfidz (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit        text NOT NULL CHECK (unit IN ('SD', 'SMP')),
  tipe        text NOT NULL CHECK (tipe IN ('1_juz', '3_juz', '5_juz')),
  juz         text NOT NULL,
  nama_siswa  text NOT NULL,
  nama_ayah   text NOT NULL,
  kelas       text NOT NULL,
  is_quls     boolean NOT NULL DEFAULT false,
  jadwal      timestamptz,
  penguji     text,
  predikat    text CHECK (predikat IN ('mumtaz', 'jayyid_jiddan', 'jayyid', 'maqbul', 'mengulang')),
  catatan     text,
  status      text NOT NULL DEFAULT 'diajukan'
                CHECK (status IN ('diajukan', 'dijadwalkan', 'selesai')),
  created_by_teacher uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_by_user    uuid REFERENCES users(id)    ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── Pengajuan tahsin ───────────────────────────────────────
-- Daftar siswa disimpan sebagai jsonb, bukan tabel anak: isinya selalu
-- dibaca dan ditulis sekaligus satu kelompok penuh (koordinator membuka
-- kelompok lalu menilai semua anggotanya dalam satu simpanan), jadi tabel
-- terpisah hanya menambah sambungan tanpa menambah kemampuan.
--
-- Bentuk tiap elemen: { nama, predikat: 'lulus'|'mengulang'|null, level }.
-- Kolom `level` di baris induk adalah ringkasan level yang dipakai kelompok
-- ini — nilai sesungguhnya per anak ada di dalam jsonb.
CREATE TABLE IF NOT EXISTS ujian_tahsin (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit          text NOT NULL CHECK (unit IN ('SD', 'SMP')),
  nama_kelompok text NOT NULL,
  sesi          text NOT NULL,
  level         text NOT NULL,
  siswa         jsonb NOT NULL DEFAULT '[]'::jsonb,
  jadwal        timestamptz,
  penguji       text,
  catatan       text,
  status        text NOT NULL DEFAULT 'diajukan'
                  CHECK (status IN ('diajukan', 'dijadwalkan', 'selesai')),
  created_by_teacher uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_by_user    uuid REFERENCES users(id)    ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── Index ──────────────────────────────────────────────────
-- Dua pola baca yang dominan: antrian per unit (status belum selesai) dan
-- rekap per bulan yang menyaring lewat jadwal.
CREATE INDEX IF NOT EXISTS ujian_tahfidz_unit_status_idx ON ujian_tahfidz (unit, status);
CREATE INDEX IF NOT EXISTS ujian_tahsin_unit_status_idx  ON ujian_tahsin  (unit, status);
CREATE INDEX IF NOT EXISTS ujian_tahfidz_jadwal_idx      ON ujian_tahfidz (jadwal);
CREATE INDEX IF NOT EXISTS ujian_tahsin_jadwal_idx       ON ujian_tahsin  (jadwal);

-- ─── Trigger updated_at ─────────────────────────────────────
DROP TRIGGER IF EXISTS ujian_tahfidz_updated_at ON ujian_tahfidz;
CREATE TRIGGER ujian_tahfidz_updated_at
  BEFORE UPDATE ON ujian_tahfidz
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ujian_tahsin_updated_at ON ujian_tahsin;
CREATE TRIGGER ujian_tahsin_updated_at
  BEFORE UPDATE ON ujian_tahsin
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Penanda "sudah dilihat" untuk badge pengajuan baru ─────
-- Disimpan per pengurus, bukan per pengajuan: yang perlu diketahui hanyalah
-- ada berapa pengajuan yang masuk sejak terakhir ia membuka halaman kelola.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ujian_seen_at timestamptz;

-- ─── RLS ────────────────────────────────────────────────────
-- Seluruh akses aplikasi lewat service-role key di server, sama seperti tabel
-- lain. RLS dinyalakan tanpa policy sehingga anon key tidak bisa membacanya
-- langsung — halaman publik pun mengambil datanya lewat server.
ALTER TABLE ujian_pengujis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ujian_tahfidz  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ujian_tahsin   ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT count(*) FROM ujian_tahfidz;
-- SELECT count(*) FROM ujian_tahsin;
