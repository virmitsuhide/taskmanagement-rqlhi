-- ============================================================
-- Materi hafalan Gharib & Tajwid (UMMI) — setoran per materi
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--    SESUDAHNYA jalankan: npm run seed:materi
--
-- Yang berubah:
--   • tabel baru tahsin_materi       : daftar materi tiap buku
--   • tabel baru tahsin_log_materi   : materi apa saja yang disetor per setoran
--
-- ── KENAPA MATERI, BUKAN HALAMAN ────────────────────────────
--
-- Gharib dan Tajwid bukan setoran BACA melainkan setoran HAFALAN, dan satu
-- halaman bukunya memuat lebih dari satu materi. Satu halaman bisa memakan
-- sampai empat pertemuan, sehingga mencatatnya sebagai nomor halaman
-- menghasilkan angka yang sama berulang kali: baris keempat tidak bisa
-- dibedakan dari baris pertama, dan tidak ada query yang bisa menjawab
-- "materi mana yang sudah hafal".
--
-- Hafalan adalah DAFTAR PERIKSA, bukan angka yang merayap naik. Karena itu
-- satuannya materi, dan halaman menjadi turunan — tetap ikut disimpan di
-- tahsin_logs.halaman supaya rekap lama yang menghitung halaman tidak perlu
-- tahu apa-apa tentang perubahan ini.
--
-- ── KENAPA SATU SETORAN BISA BANYAK MATERI ─────────────────
--
-- Halaman 6 dan 20 buku Gharib masing-masing memuat tiga materi, dan sering
-- tuntas dalam satu pertemuan. Memaksa satu materi per setoran akan membuat
-- guru menekan simpan tiga kali untuk satu pertemuan yang sama — dan tiga
-- baris setoran bertanggal sama yang sebenarnya satu peristiwa.
--
-- Status hafal disimpan PER MATERI, bukan diwarisi dari status setoran. Dalam
-- satu pertemuan dua materi bisa lulus dan satu belum, dan status tunggal di
-- induknya tidak punya cara mengatakan itu.
--
-- ── HALAMAN REVIU / PENGUATAN TIDAK DIMASUKKAN ─────────────
--
-- Buku Gharib punya halaman reviu (14) dan penguatan (24–28); Tajwid punya
-- halaman latihan (4 dan 20). Halaman-halaman itu tidak memuat materi baru,
-- jadi tidak ada barisnya di sini — progres "x dari 40" hanya menghitung
-- materi yang memang dihafal.
--
-- ── ON DELETE ──────────────────────────────────────────────
--
-- log_id CASCADE: menghapus setoran harus ikut menghapus klaim hafalnya,
-- kalau tidak seorang anak tetap "hafal" karena setoran yang sudah tiada.
-- materi_id RESTRICT: daftar materi adalah data acuan; menghapus satu materi
-- yang sudah dipakai akan melubangi riwayat tanpa peringatan.
-- ============================================================

CREATE TABLE IF NOT EXISTS "tahsin_materi" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "jilid_id"   uuid NOT NULL REFERENCES "jilid_levels"("id") ON DELETE CASCADE,
  "nomor"      smallint NOT NULL CHECK ("nomor" >= 1),
  "halaman"    smallint NOT NULL CHECK ("halaman" >= 1),
  "nama"       text NOT NULL,
  "keterangan" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("jilid_id", "nomor")
);

COMMENT ON TABLE "tahsin_materi" IS
  'Daftar materi hafalan sebuah buku tahsin (Gharib & Tajwid UMMI). Satu baris =
   satu materi yang disetor anak. nomor = urutan materi di buku, halaman =
   halaman tempat materi itu berada (beberapa materi bisa sehalaman).';

CREATE INDEX IF NOT EXISTS tahsin_materi_urut_idx
  ON tahsin_materi (jilid_id, nomor);

CREATE TABLE IF NOT EXISTS "tahsin_log_materi" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "log_id"     uuid NOT NULL REFERENCES "tahsin_logs"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "materi_id"  uuid NOT NULL REFERENCES "tahsin_materi"("id") ON DELETE RESTRICT,
  "hafal"      boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("log_id", "materi_id")
);

COMMENT ON TABLE "tahsin_log_materi" IS
  'Materi yang disetor pada satu setoran tahsin, dengan status hafal per materi.
   student_id sengaja didenormalisasi: progres seorang anak dibaca jauh lebih
   sering daripada isi satu setoran, dan tanpa kolom ini setiap pembacaan harus
   melewati tahsin_logs lebih dulu.';

-- Indeks progres: "materi mana saja yang sudah hafal" — pertanyaan yang
-- ditanyakan setiap kali formulir setoran dibuka.
CREATE INDEX IF NOT EXISTS tahsin_log_materi_hafal_idx
  ON tahsin_log_materi (student_id, materi_id) WHERE hafal;
CREATE INDEX IF NOT EXISTS tahsin_log_materi_log_idx
  ON tahsin_log_materi (log_id);

-- Seluruh akses lewat service-role di server, sama seperti tabel lain.
ALTER TABLE "tahsin_materi"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tahsin_log_materi" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT l.label, count(*) AS materi
--   FROM tahsin_materi m JOIN jilid_levels l ON l.id = m.jilid_id
--  GROUP BY l.label;          -- harapan: Gharib 40, Tajwid 33
