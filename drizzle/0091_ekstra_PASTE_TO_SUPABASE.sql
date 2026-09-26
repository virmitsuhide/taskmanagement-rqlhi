-- ============================================================
-- Ekstra tahsin & tahfidz — jenis, slot, booking orang tua
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0081 (tipe absensi_status), 0087.
--
-- Yang berubah:
--   • ekstra_jenis     → BARU, program ekstra: nama, bidang, biaya, kuota, waktu
--   • ekstra_slot      → BARU, jadwal pekanan: jenis + guru + hari + jam
--   • ekstra_booking   → BARU, permintaan orang tua dari web → peserta
--   • ekstra_hadir     → BARU, kehadiran peserta tiap pertemuan
--   • tahsin_logs.ekstra_slot_id, tahfidz_logs.ekstra_slot_id → BARU
--
-- ── ALUR ──────────────────────────────────────────────────────
--
-- Koordinator Ekstra membuat JENIS ekstra (mis. "Ekstra Tahsin Privat",
-- "Extra Tahfidz Kafalah") lengkap dengan biaya dan kuota, lalu membuka SLOT
-- pekanan untuk guru yang waktunya tersedia. Orang tua memesan slot dari web
-- (tanpa akun) → booking berstatus 'baru'. Koordinator menerima (→ 'aktif'),
-- menawarkan slot lain (→ 'ditawarkan'), atau menolak. Peserta = booking
-- 'aktif'; kuota slot dihitung dari jumlah peserta aktifnya.
--
-- ── CAPAIAN EKSTRA IKUT CAPAIAN SEKOLAH (seperti Riyadhoh) ────
--
-- Peserta dari LHI ditautkan ke students (student_id). Setorannya disimpan
-- sebagai setoran biasa di tahsin_logs / tahfidz_logs, jadi posisi jilid dan
-- hafalan anak ikut maju. Kolom ekstra_slot_id menandai asalnya: setoran
-- ekstra TIDAK dihitung di laporan orang tua halaqoh, melainkan di laporan
-- ekstra. Peserta dari luar LHI (student_id kosong) hanya tercatat
-- kehadirannya.

-- ── Jenis ekstra ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ekstra_jenis" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nama"          text NOT NULL,
  "bidang"        text NOT NULL DEFAULT 'tahsin' CHECK ("bidang" IN ('tahsin','tahfidz','campuran')),
  "deskripsi"     text NOT NULL DEFAULT '',
  -- Rupiah bulat; 0 = tanpa biaya (mis. program kafalah penuh).
  "biaya"         integer NOT NULL DEFAULT 0 CHECK ("biaya" >= 0),
  "satuan_biaya"  text NOT NULL DEFAULT 'per bulan',
  -- Kuota bawaan peserta per slot; slot boleh menimpanya.
  "kuota"         smallint NOT NULL DEFAULT 1 CHECK ("kuota" > 0),
  -- Waktu belajar: lama tiap pertemuan & keterangan bebas ("2x sepekan").
  "durasi_menit"  smallint NOT NULL DEFAULT 60 CHECK ("durasi_menit" > 0),
  "keterangan_waktu" text NOT NULL DEFAULT '',
  "aktif"         boolean NOT NULL DEFAULT true,
  "urutan"        smallint NOT NULL DEFAULT 0,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

-- ── Slot pekanan ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ekstra_slot" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jenis_id"    uuid NOT NULL REFERENCES "ekstra_jenis"("id") ON DELETE RESTRICT,
  "teacher_id"  uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
  -- 1 = Senin … 7 = Ahad (ISO-8601), sama dengan halaqoh_sessions.
  "hari"        smallint NOT NULL CHECK ("hari" BETWEEN 1 AND 7),
  "jam_mulai"   time NOT NULL,
  "jam_selesai" time NOT NULL,
  "tempat"      text NOT NULL DEFAULT '',
  -- NULL = ikut kuota jenisnya.
  "kuota"       smallint CHECK ("kuota" IS NULL OR "kuota" > 0),
  "aktif"       boolean NOT NULL DEFAULT true,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ekstra_slot_jam" CHECK ("jam_selesai" > "jam_mulai")
);
CREATE INDEX IF NOT EXISTS "ekstra_slot_teacher_idx" ON "ekstra_slot" ("teacher_id") WHERE "aktif";

-- ── Booking → peserta ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ekstra_booking" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slot_id"        uuid NOT NULL REFERENCES "ekstra_slot"("id") ON DELETE RESTRICT,
  -- Slot yang ditawarkan koordinator bila slot pilihan penuh.
  "slot_tawaran_id" uuid REFERENCES "ekstra_slot"("id") ON DELETE SET NULL,
  "status"         text NOT NULL DEFAULT 'baru'
                   CHECK ("status" IN ('baru','ditawarkan','aktif','ditolak','berhenti')),
  "nama_anak"      text NOT NULL,
  "asal"           text NOT NULL DEFAULT 'lhi' CHECK ("asal" IN ('lhi','luar')),
  -- Ditautkan koordinator saat menerima anak LHI.
  "student_id"     uuid REFERENCES "students"("id") ON DELETE SET NULL,
  "kelas"          text NOT NULL DEFAULT '',
  "posisi_bacaan"  text NOT NULL DEFAULT '',
  "nama_ortu"      text NOT NULL,
  "wa_ortu"        text NOT NULL,
  "catatan_ortu"   text NOT NULL DEFAULT '',
  "catatan_koor"   text NOT NULL DEFAULT '',
  "ditangani_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "ditangani_at"   timestamptz,
  "mulai"          date,
  "berhenti"       date,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ekstra_booking_status_idx" ON "ekstra_booking" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "ekstra_booking_slot_idx"   ON "ekstra_booking" ("slot_id") WHERE "status" = 'aktif';
CREATE INDEX IF NOT EXISTS "ekstra_booking_wa_idx"     ON "ekstra_booking" ("wa_ortu", "created_at");

-- ── Kehadiran tiap pertemuan ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "ekstra_hadir" (
  "booking_id"   uuid NOT NULL REFERENCES "ekstra_booking"("id") ON DELETE CASCADE,
  "tanggal"      date NOT NULL,
  "status"       absensi_status NOT NULL,
  "catatan"      text NOT NULL DEFAULT '',
  "dicatat_oleh" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("booking_id", "tanggal")
);

-- ── Penanda setoran ekstra ────────────────────────────────────
ALTER TABLE "tahsin_logs"  ADD COLUMN IF NOT EXISTS "ekstra_slot_id" uuid REFERENCES "ekstra_slot"("id") ON DELETE SET NULL;
ALTER TABLE "tahfidz_logs" ADD COLUMN IF NOT EXISTS "ekstra_slot_id" uuid REFERENCES "ekstra_slot"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "tahsin_logs_ekstra_idx"  ON "tahsin_logs"  ("ekstra_slot_id", "setoran_date") WHERE "ekstra_slot_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tahfidz_logs_ekstra_idx" ON "tahfidz_logs" ("ekstra_slot_id", "setoran_date") WHERE "ekstra_slot_id" IS NOT NULL;

-- Akses hanya lewat server (service role), seperti tabel lain.
ALTER TABLE "ekstra_jenis"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ekstra_slot"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ekstra_booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ekstra_hadir"   ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
