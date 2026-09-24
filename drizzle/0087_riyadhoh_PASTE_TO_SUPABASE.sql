-- ============================================================
-- Riyadhoh Qur'an SMP — halaqoh tambahan hari Sabtu
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0081 (tipe absensi_status), 0086.
--
-- Yang berubah:
--   • riyadhoh_jadwal     → BARU, Sabtu mana untuk putra / putri
--   • riyadhoh_pengampu   → BARU, guru pengampu Sabtu + kelompoknya (L/P)
--   • riyadhoh_peserta    → BARU, pengecualian dari aturan peserta bawaan
--   • riyadhoh_hadir      → BARU, kehadiran tiap Sabtu
--   • tahsin_logs.riyadhoh, tahfidz_logs.riyadhoh → BARU, penanda setoran Sabtu
--
-- ── APA ITU RIYADHOH ───────────────────────────────────────
--
-- Sesi tambahan hari Sabtu untuk seluruh siswa kelas 9 SMP (termasuk QuLS)
-- dan siswa QuLS kelas 7–8. Putra dan putri masuk bergantian: satu Sabtu
-- putra, satu Sabtu putri. Koordinator SMP menentukan tiap Sabtu dalam
-- sebulan milik siapa (riyadhoh_jadwal); pengampunya guru SD atau SMP.
--
-- ── KENAPA BUKAN HALAQOH BIASA ─────────────────────────────
--
-- students.halaqoh_id hanya menampung SATU halaqoh — halaqoh sekolahnya.
-- Riyadhoh ditambahkan di atasnya, bukan menggantikannya. Karena itu
-- pesertanya tidak disimpan sebagai anggota halaqoh, melainkan diturunkan
-- dari aturan (kelas 9, atau kelas 7–8 berprogram QuLS) — dan hanya
-- pengecualiannya yang disimpan di riyadhoh_peserta. Anak yang naik kelas
-- otomatis ikut; koordinator tidak perlu mendaftarkan ulang tiap tahun.
--
-- ── CAPAIAN SABTU IKUT CAPAIAN SEKOLAH ─────────────────────
--
-- Setoran Sabtu adalah setoran biasa di tahsin_logs / tahfidz_logs — posisi
-- hafalan berjalan terus, dan guru sekolah melanjutkannya hari Senin.
-- Kolom `riyadhoh` hanya penanda asalnya: dipakai rapor untuk mengisi tabel
-- halaman Riyadhoh, dan untuk membedakan pencatatnya dari guru sekolah.
--
-- ── KEHADIRAN TERPISAH DARI absensi_harian ─────────────────
--
-- absensi_harian terikat pada halaqoh sekolah dan dijumlah untuk rekap
-- kehadiran sekolah. Sabtu Riyadhoh bukan hari sekolah; mencatatnya di sana
-- akan menambah "pertemuan" yang tidak pernah terjadi di halaqoh itu.

DO $$ BEGIN
  CREATE TYPE absensi_status AS ENUM ('hadir','izin','sakit','alfa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Jadwal: satu baris per Sabtu ────────────────────────────
CREATE TABLE IF NOT EXISTS "riyadhoh_jadwal" (
  "tanggal"     date PRIMARY KEY,
  "gender"      gender NOT NULL,
  "catatan"     text NOT NULL DEFAULT '',
  "dibuat_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "riyadhoh_jadwal_sabtu" CHECK (extract(isodow FROM "tanggal") = 6)
);
COMMENT ON TABLE "riyadhoh_jadwal" IS
  'Sabtu Riyadhoh dan kelompok yang masuk (L = putra, P = putri). Sabtu tanpa baris = libur.';

-- ── Pengampu: guru + kelompok yang diampunya ────────────────
CREATE TABLE IF NOT EXISTS "riyadhoh_pengampu" (
  "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "gender"     gender NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("teacher_id", "gender")
);
COMMENT ON TABLE "riyadhoh_pengampu" IS
  'Guru pengampu Riyadhoh per kelompok. Pengampu boleh mencatat kehadiran & setoran peserta kelompoknya, hanya pada Sabtu kelompok itu.';

-- ── Peserta: pengecualian dari aturan bawaan ────────────────
CREATE TABLE IF NOT EXISTS "riyadhoh_peserta" (
  "student_id"  uuid PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
  "ikut"        boolean NOT NULL,
  "diubah_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE "riyadhoh_peserta" IS
  'Pengecualian peserta Riyadhoh. Aturan bawaan: SMP kelas 9, atau kelas 7–8 program QuLS. ikut=false mengeluarkan anak yang memenuhi aturan; ikut=true memasukkan anak di luar aturan.';

-- ── Kehadiran tiap Sabtu ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "riyadhoh_hadir" (
  "student_id"   uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "tanggal"      date NOT NULL,
  "status"       absensi_status NOT NULL,
  "catatan"      text NOT NULL DEFAULT '',
  "dicatat_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("student_id", "tanggal")
);
CREATE INDEX IF NOT EXISTS "riyadhoh_hadir_tanggal_idx" ON "riyadhoh_hadir" ("tanggal");

-- ── Penanda setoran Sabtu ───────────────────────────────────
ALTER TABLE "tahsin_logs"  ADD COLUMN IF NOT EXISTS "riyadhoh" boolean NOT NULL DEFAULT false;
ALTER TABLE "tahfidz_logs" ADD COLUMN IF NOT EXISTS "riyadhoh" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "tahsin_logs_riyadhoh_idx"  ON "tahsin_logs"  ("student_id", "setoran_date") WHERE "riyadhoh";
CREATE INDEX IF NOT EXISTS "tahfidz_logs_riyadhoh_idx" ON "tahfidz_logs" ("student_id", "setoran_date") WHERE "riyadhoh";

-- Akses hanya lewat server (service role), seperti tabel lain.
ALTER TABLE "riyadhoh_jadwal"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "riyadhoh_pengampu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "riyadhoh_peserta"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "riyadhoh_hadir"    ENABLE ROW LEVEL SECURITY;
