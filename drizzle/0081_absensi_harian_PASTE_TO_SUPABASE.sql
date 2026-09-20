-- ============================================================
-- Absensi harian siswa — kehadiran per pertemuan halaqoh
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • absensi_status   → BARU, enum hadir/izin/sakit/alfa
--   • absensi_harian   → BARU, satu baris per anak per hari
--
-- ── KENAPA TABEL SENDIRI, BUKAN DITURUNKAN DARI SETORAN ─────
--
-- Rapor semester meminta Hadir / Izin / Alfa. Selama ini yang bisa dihitung
-- sistem hanyalah "hari anak itu punya setoran" — dan itu bukan kehadiran:
-- anak yang datang tapi tidak kebagian giliran setor akan tercatat tidak
-- hadir, sedangkan anak yang izin tidak bisa dibedakan dari yang bolos.
-- Rapor yang memberi tahu orang tua bahwa anaknya 8 kali tidak hadir padahal
-- ia hadir penuh adalah kesalahan yang mahal, jadi kehadiran dicatat sendiri.
--
-- ── KENAPA KUNCINYA (student_id, tanggal) ───────────────────
--
-- Seorang anak hanya anggota satu halaqoh (students.halaqoh_id), jadi dalam
-- satu hari ia hanya punya satu pertemuan Qur'an. halaqoh_id tetap disimpan
-- supaya rekap per sesi tidak perlu menebak penempatan yang berlaku saat itu
-- — anak yang pindah halaqoh di tengah semester tetap terhitung di sesi tempat
-- ia benar-benar hadir hari itu.
--
-- "Total pertemuan" TIDAK disimpan: ia dihitung sebagai jumlah tanggal berbeda
-- yang pernah diabsen untuk halaqoh itu. Pertemuan yang tidak pernah diabsen
-- memang tidak terjadi — libur, guru berhalangan, pekan ujian — dan menghitung
-- pembaginya dari kalender akan menghukum anak atas pertemuan yang tidak ada.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE absensi_status AS ENUM ('hadir','izin','sakit','alfa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE absensi_status IS
  'Kehadiran satu anak pada satu pertemuan. izin = berhalangan dengan kabar;
   sakit dipisah dari izin karena rapor SMP menghitungnya sendiri; alfa =
   tidak hadir tanpa kabar.';

CREATE TABLE IF NOT EXISTS "absensi_harian" (
  "student_id"  uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "tanggal"     date NOT NULL,
  "halaqoh_id"  uuid NOT NULL REFERENCES "halaqoh"("id") ON DELETE CASCADE,
  "status"      absensi_status NOT NULL,
  "catatan"     text NOT NULL DEFAULT '',
  "dicatat_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("student_id", "tanggal")
);

-- Rekap per sesi (rapor, daftar hadir) selalu menyaring halaqoh + rentang
-- tanggal sekaligus.
CREATE INDEX IF NOT EXISTS "absensi_harian_halaqoh_tanggal_idx"
  ON "absensi_harian" ("halaqoh_id", "tanggal");

ALTER TABLE "absensi_harian" ENABLE ROW LEVEL SECURITY;
