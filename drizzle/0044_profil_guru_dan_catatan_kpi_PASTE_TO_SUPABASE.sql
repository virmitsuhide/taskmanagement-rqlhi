-- ============================================================
-- Profil guru Qur'an + catatan evaluasi pada rapor KPI
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • kpi_monthly + apresiasi, pengembangan (text[])
--       Catatan evaluasi yang ditulis SDM saat mengisi KPI, tercetak di rapor.
--   • teachers + 12 kolom profil, sepadan dengan profil pengurus di users
--   • teachers.joined_at: DEFAULT now() dilepas
--
-- KENAPA CATATANNYA text[], BUKAN SATU KOLOM text PANJANG
--
-- Rapor mencetaknya sebagai daftar berbutir, satu kalimat per baris. Kalau
-- disimpan sebagai satu teks panjang, yang memisah butirnya adalah karakter
-- baris baru — dan itu berarti tampilan rapor bergantung pada spasi yang
-- kebetulan diketik orang. Array menyatakan "ini kumpulan butir" di tempat
-- datanya disimpan, dan form tinggal memecah per baris sekali saat menyimpan.
--
-- Keduanya boleh NULL/kosong. Kosong TIDAK berarti rapornya kosong: lembar
-- rapor jatuh kembali ke kalimat turunan yang dihitung dari nilai indikator
-- (lib/kpi/rapor-bulanan.ts). SDM menulis di sini hanya kalau ingin
-- menggantikan kalimat turunan itu dengan pengamatannya sendiri.
--
-- KENAPA PROFIL GURU MENUMPANG DI teachers, BUKAN TABEL BARU
--
-- Sudah ada full_name, nip, photo_url, photo_focus, unit, joined_at, dan
-- employment_type di sana. Memindahkan sebagian ke tabel lain berarti tiap
-- pembaca profil harus menyambung dua tabel dan memutuskan mana yang menang
-- kalau keduanya terisi. Kolom baru ini melanjutkan yang sudah ada, dengan
-- nama dan bentuk yang sama persis seperti di users supaya satu komponen form
-- bisa melayani pengurus maupun guru.
--
-- KENAPA DEFAULT joined_at DILEPAS
--
-- joined_at adalah TMT — terhitung mulai tanggal seorang guru bertugas, dan
-- angka itu tercetak di rapor KPI sebagai masa kerja. DEFAULT now() membuat
-- setiap guru yang baru didaftarkan langsung memiliki TMT berisi tanggal
-- pendaftarannya, yang tampak sah padahal tidak pernah dimasukkan siapa pun.
-- Ke-39 guru yang ada sekarang semuanya bernasib begitu. Tanpa default,
-- kolomnya kosong sampai benar-benar diisi — dan kosong jujur mengatakan
-- "belum diketahui", sementara tanggal palsu tidak.
--
-- Baris yang terlanjur terisi TIDAK diubah di sini: tebakan mana yang asli dan
-- mana yang bawaan hanya bisa dijawab SDM, dan sekarang ia punya formnya.
-- ============================================================

-- 1) Catatan evaluasi pada rapor KPI
ALTER TABLE "kpi_monthly" ADD COLUMN IF NOT EXISTS "apresiasi"    text[];
ALTER TABLE "kpi_monthly" ADD COLUMN IF NOT EXISTS "pengembangan" text[];

-- 2) Profil guru — bentuknya sama persis dengan kolom sejenis di users
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "sapaan"             text;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "nickname"           text;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "birth_place"        text;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "birth_date"         date;
-- SD | SMP | SMA | D3 | S1 | S2 | S3 — turunan education_history.
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "education_level"    text;
-- [{ level, institution, major, graduation_year }]
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "education_history"  jsonb;
-- [{ name, institution }] — lembaga kosong = belum tersertifikasi (lihat 0042).
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "quran_competencies" jsonb;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "other_competencies" jsonb;
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "ijazah_sanad"       text[];
-- [{ name, year, organizer }]
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "trainings"          jsonb;
-- [{ position, period }]
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "amanah_history"     jsonb;
-- [{ name, year }]
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "awards"             jsonb;

-- 3) TMT tidak lagi terisi sendiri
ALTER TABLE "teachers" ALTER COLUMN "joined_at" DROP DEFAULT;

-- Verifikasi (opsional):
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'teachers'
--    AND column_name IN ('joined_at','sapaan','education_history','ijazah_sanad')
--  ORDER BY column_name;
