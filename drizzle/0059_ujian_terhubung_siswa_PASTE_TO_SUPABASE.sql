-- ============================================================
-- Pengajuan ujian terhubung ke data siswa, dan nama ayah dibuang
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah pada ujian_tahfidz:
--   • + student_id  → tautan ke siswa, sumber riwayat & analitik hafalan
--   • + nama_flyer  → nama singkat untuk flyer & broadcast
--   • - nama_ayah   → DIBUANG PERMANEN
--
-- ── KENAPA TAUTAN KE SISWA, BUKAN COCOK NAMA ────────────────
--
-- Sampai sekarang ujian hanya menyimpan nama_siswa sebagai teks bebas. Dari
-- 38 catatan yang ada, hanya 2 yang namanya cocok dengan baris di students —
-- sisanya sudah tersingkat ("A. Rafif. F. I", "Nafisah S.H."). Artinya
-- pencocokan nama tidak pernah bisa jadi dasar riwayat per siswa: yang
-- diketik pengaju memang bukan nama lengkapnya.
--
-- student_id menjadikannya tautan sungguhan. ON DELETE SET NULL, bukan
-- CASCADE: catatan ujian adalah peristiwa yang benar-benar terjadi, dan tidak
-- semestinya lenyap karena barisnya siswa dirapikan.
--
-- ── KENAPA NAMA FLYER DIPISAH ───────────────────────────────
--
-- Flyer dan broadcast beredar ke luar, jadi yang tercantum di sana bukan nama
-- lengkap. Selama ini pemisahan itu dikerjakan dengan cara menyingkat nama di
-- kolom nama_siswa — yang sekaligus menghapus satu-satunya petunjuk anak mana
-- yang dimaksud. Dua kolom membuat keduanya bisa benar sekaligus: nama_siswa
-- lengkap untuk internal, nama_flyer singkat untuk yang beredar.
--
-- Baris lama disalin nama_siswa → nama_flyer, sebab nilai yang ada di sana
-- memang sudah bentuk singkatnya.
--
-- ── KENAPA NAMA AYAH DIBUANG, BUKAN DIKOSONGKAN ─────────────
--
-- Data pribadi yang tidak dipakai sebaiknya tidak disimpan. Mengosongkan
-- isinya tapi menyisakan kolomnya mengundang pengisian ulang oleh fitur
-- berikutnya; membuang kolomnya menutup pintu itu.
--
-- ⚠️ TIDAK BISA DIBATALKAN. Nama ayah pada 38 catatan hilang permanen.
--
-- ⚠️ Jalankan SQL ini BERSAMAAN dengan deploy kodenya. Di antara keduanya ada
--    jeda: kode lama masih mengirim nama_ayah ke kolom yang sudah tidak ada,
--    jadi pengajuan ujian baru akan gagal sampai kode barunya hidup. Tidak ada
--    data yang rusak — hanya pengajuan yang perlu diulang.
-- ============================================================

ALTER TABLE ujian_tahfidz
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE ujian_tahfidz
  ADD COLUMN IF NOT EXISTS nama_flyer text;

COMMENT ON COLUMN ujian_tahfidz.student_id IS
  'Siswa yang diuji. NULL = catatan lama yang belum dipetakan (lihat /ujian/pemetaan).';
COMMENT ON COLUMN ujian_tahfidz.nama_flyer IS
  'Nama singkat untuk flyer & broadcast. NULL = pakai nama_siswa.';

-- Nilai lama di nama_siswa memang sudah bentuk singkatnya, jadi disalin apa
-- adanya. Hanya yang masih kosong, supaya aman dijalankan ulang.
UPDATE ujian_tahfidz SET nama_flyer = nama_siswa WHERE nama_flyer IS NULL;

-- Riwayat ujian per siswa dibaca dari profil siswa: satu siswa, urut waktu.
CREATE INDEX IF NOT EXISTS ujian_tahfidz_student_idx
  ON ujian_tahfidz (student_id, created_at DESC)
  WHERE student_id IS NOT NULL;

-- Layar pemetaan mencari justru yang belum bertaut.
CREATE INDEX IF NOT EXISTS ujian_tahfidz_belum_terpetakan_idx
  ON ujian_tahfidz (created_at DESC)
  WHERE student_id IS NULL;

ALTER TABLE ujian_tahfidz DROP COLUMN IF EXISTS nama_ayah;

-- Verifikasi (opsional):
-- SELECT count(*) FILTER (WHERE student_id IS NULL)     AS belum_terpetakan,
--        count(*) FILTER (WHERE student_id IS NOT NULL) AS sudah_terpetakan
-- FROM ujian_tahfidz;
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'ujian_tahfidz' AND column_name = 'nama_ayah';  -- harus kosong
