-- ============================================================
-- Lingkup penugasan guru: unit sekolah atau lintas yayasan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru : lingkup_penugasan
--   • teachers  : kolom lingkup_penugasan (default 'unit')
--
-- ── PERSOALAN YANG DITUTUP ──────────────────────────────────
--
-- teachers.unit memikul dua pertanyaan sekaligus, dan keduanya dijawab
-- dengan NULL yang sama:
--
--   1. "SDM belum sempat mengisinya"        → kelalaian, harus ditagih
--   2. "Ia memang bertugas lintas yayasan"  → keputusan, sudah selesai
--
-- Delapan guru hari ini ber-unit NULL. Tidak ada seorang pun yang bisa
-- membedakan mana yang mana, jadi tidak ada yang bisa menagih yang pertama
-- tanpa ikut menagih yang kedua — dan daftar tagihan yang separuhnya salah
-- adalah daftar yang berhenti dibaca.
--
-- Akibat yang lebih tajam: /ustadz/profil menyaring guru dengan
-- `.eq('unit', unit)` untuk lima tab unit. Guru ber-unit NULL tidak muncul di
-- tab mana pun, sehingga TMT-nya tidak bisa disunting — padahal satu-satunya
-- medan yang akan membuatnya terlihat justru unit itu sendiri. Kebuntuan
-- berputar: yang harus diperbaiki hanya bisa diperbaiki dari halaman yang
-- tidak bisa mencapainya.
--
-- ── KENAPA KOLOM BARU, BUKAN NILAI ENUM BARU ────────────────
--
-- Pilihan yang ditolak: menambahkan 'yayasan' ke enum jenjang. Satu baris,
-- tapi enum itu dipakai juga oleh halaqoh.jenjang, meetings, classes, dan
-- teacher_unit_transfers. Menambah nilainya di sana membuat "halaqoh
-- berjenjang yayasan" menjadi keadaan yang SAH di tingkat database padahal
-- tidak bermakna apa pun — dan keadaan tak bermakna yang bisa disimpan cepat
-- atau lambat akan tersimpan.
--
-- Dengan kolom terpisah, unit tetap menjawab satu hal saja: satuan pendidikan
-- mana yang rubrik KPI-nya berlaku. Lingkup penugasan menjawab hal lain:
-- kepada siapa guru ini bertanggung jawab. Keduanya memang pertanyaan yang
-- berbeda, dan guru lintas yayasan membuktikannya — ia bisa mengajar di SD
-- sambil tidak berada di bawah Koor SD.
--
-- ── AKIBATNYA PADA PENGESAHAN KPI ───────────────────────────
--
-- koorPengesah() mengembalikan 'kepala_rq' untuk lingkup 'yayasan'. Guru yang
-- tidak berada di bawah koordinator unit mana pun tidak punya koordinator
-- yang menyaksikan kinerjanya, dan tanda tangan koor unit atas orang yang
-- bukan bawahannya menyatakan kesaksian yang tidak pernah terjadi.

-- ── ENUM ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE lingkup_penugasan AS ENUM (
    -- Bertugas di satu satuan pendidikan; unit-nya yang menentukan segalanya.
    'unit',
    -- Lintas unit / tingkat yayasan. unit boleh terisi (menentukan rubrik KPI)
    -- maupun kosong, tapi pengesah rapornya tetap Kepala RQ.
    'yayasan'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Kolom ────────────────────────────────────────────────────
--
-- DEFAULT 'unit' dan NOT NULL. Sengaja tidak dibuat nullable: kolom ini
-- justru ada untuk MENGHAPUS satu NULL yang bermakna ganda, dan kolom baru
-- yang boleh NULL hanya akan memindahkan kegandaan itu ke tempat baru.
-- Seluruh baris lama menjadi 'unit', yang memang benar: lingkup yayasan
-- adalah pengecualian yang ditetapkan seseorang, bukan keadaan bawaan.

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "lingkup_penugasan" lingkup_penugasan NOT NULL DEFAULT 'unit';

-- Dipakai tab "Lain-lain" di /ustadz/profil, yang mengumpulkan guru lintas
-- yayasan bersama guru yang unitnya memang belum ditentukan.
CREATE INDEX IF NOT EXISTS "teachers_lingkup_idx"
  ON "teachers" ("lingkup_penugasan")
  WHERE "deleted_at" IS NULL;

-- ── Data lama ────────────────────────────────────────────────
--
-- TIDAK ada penebakan otomatis. employment_type 'tetap_yayasan' /
-- 'kontrak_yayasan' menggoda untuk dijadikan penanda, tapi itu jenis
-- KEPEGAWAIAN — dari mana gajinya, bukan kepada siapa ia bertanggung jawab.
-- Sebagian besar guru SD pun berstatus kontrak yayasan. Menebak dari kolom
-- itu akan memindahkan puluhan guru unit ke bawah Kepala RQ tanpa ada yang
-- meminta, dan kekeliruannya baru terlihat sebulan kemudian di meja
-- pengesahan rapor. SDM menetapkannya satu per satu lewat Profil Guru.
