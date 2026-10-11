-- ============================================================
-- Tahsin Rekomendasi SDIT LHI — kelompok tahsin tambahan Jum'at sore
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0081 (tipe absensi_status).
--
-- Yang berubah:
--   • tr_pengampu  → BARU, akun pengampu TR (TR1, TR2, …) + tempatnya
--   • tr_peserta   → BARU, siswa SDIT → kelompok (pengampu) TR-nya
--   • tr_hadir     → BARU, kehadiran tiap Jum'at
--   • tahsin_logs.tahsin_rekomendasi → BARU, penanda setoran Jum'at sore
--
-- ── APA ITU TAHSIN REKOMENDASI ─────────────────────────────
--
-- Kelompok tahsin tambahan tiap Jum'at sore untuk siswa SDIT LHI (bukan SD
-- Juara) yang direkomendasikan koordinator SD. Pengampunya bisa wali kelas
-- SD, bukan guru Qur'an — karena itu tiap kelompok memakai AKUN BERSAMA
-- (username TR1, TR2, …) yang namanya diganti koordinator bila pengampunya
-- berganti, bukan akun pribadi guru.
--
-- ── KENAPA PESERTA DISIMPAN, BUKAN DITURUNKAN DARI ATURAN ──
--
-- Berbeda dengan Riyadhoh (seluruh kelas 9 otomatis ikut), peserta TR dipilih
-- satu per satu — direkomendasikan karena bacaannya perlu dikejar. Jadi
-- daftarnya memang data, dan satu anak masuk paling banyak satu kelompok.
--
-- ── CAPAIAN JUM'AT IKUT CAPAIAN SEKOLAH (seperti Riyadhoh) ─
--
-- Setoran TR adalah setoran tahsin biasa di tahsin_logs — posisi jilid anak
-- maju, dan guru halaqohnya melanjutkan dari situ pekan berikutnya. Kolom
-- `tahsin_rekomendasi` menandai asalnya, sekaligus memisahkan JALURNYA:
-- Jum'at adalah hari sekolah, jadi anak bisa setor pagi di halaqoh dan sore
-- di TR. Aturan satu setoran per hari berlaku per jalur, bukan per tanggal.
--
-- ── KEHADIRAN TERPISAH DARI absensi_harian ─────────────────
--
-- absensi_harian terikat pada halaqoh sekolah. Hadir Jum'at sore dicatat di
-- tr_hadir supaya tidak menambah pertemuan halaqoh yang tidak terjadi.

DO $$ BEGIN
  CREATE TYPE absensi_status AS ENUM ('hadir','izin','sakit','alfa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Pengampu: satu akun TR = satu kelompok ──────────────────
CREATE TABLE IF NOT EXISTS "tr_pengampu" (
  "teacher_id" uuid PRIMARY KEY REFERENCES "teachers"("id") ON DELETE CASCADE,
  -- Tempat belajar: "Ruang Kelas 2C", "M. Darmi", …
  "tempat"     text NOT NULL DEFAULT '',
  "urutan"     smallint NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE "tr_pengampu" IS
  'Kelompok Tahsin Rekomendasi: satu akun pengampu (TR1, TR2, …) satu kelompok. Nama pengampunya = teachers.full_name akun itu.';

-- ── Peserta: siswa → kelompoknya ────────────────────────────
CREATE TABLE IF NOT EXISTS "tr_peserta" (
  "student_id"   uuid PRIMARY KEY REFERENCES "students"("id") ON DELETE CASCADE,
  "teacher_id"   uuid NOT NULL REFERENCES "tr_pengampu"("teacher_id") ON DELETE CASCADE,
  -- Capaian saat direkomendasikan, teks bebas dari koordinator ("Jilid 2 hal 25").
  "capaian_awal" text NOT NULL DEFAULT '',
  "diubah_oleh"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tr_peserta_teacher_idx" ON "tr_peserta" ("teacher_id");

-- ── Kehadiran tiap Jum'at ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "tr_hadir" (
  "student_id"   uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "tanggal"      date NOT NULL,
  "status"       absensi_status NOT NULL,
  "catatan"      text NOT NULL DEFAULT '',
  "dicatat_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("student_id", "tanggal"),
  CONSTRAINT "tr_hadir_jumat" CHECK (extract(isodow FROM "tanggal") = 5)
);
CREATE INDEX IF NOT EXISTS "tr_hadir_tanggal_idx" ON "tr_hadir" ("tanggal");

-- ── Penanda setoran Jum'at sore ─────────────────────────────
ALTER TABLE "tahsin_logs" ADD COLUMN IF NOT EXISTS "tahsin_rekomendasi" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "tahsin_logs_tr_idx" ON "tahsin_logs" ("student_id", "setoran_date") WHERE "tahsin_rekomendasi";

-- Akses hanya lewat server (service role), seperti tabel lain.
ALTER TABLE "tr_pengampu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tr_peserta"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tr_hadir"    ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT t.username, t.full_name, p.tempat, count(s.*) FROM tr_pengampu p
--   JOIN teachers t ON t.id = p.teacher_id LEFT JOIN tr_peserta s ON s.teacher_id = p.teacher_id
--   GROUP BY 1, 2, 3 ORDER BY 1;
