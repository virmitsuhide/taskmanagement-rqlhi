-- ============================================================
-- Riwayat Pendidikan Formal — satu jenjang jadi banyak baris
-- ============================================================
-- CARA PAKAI: Supabase SQL Editor -> paste seluruh file -> Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   * users : + kolom education_history (jsonb, default '[]')
--
-- Bentuk barisnya:
--   [{ "level": "S1", "institution": "UIN Sunan Kalijaga",
--      "major": "Pendidikan Agama Islam", "graduation_year": "2018" }]
--
-- -- KENAPA JSONB, BUKAN TABEL SENDIRI ------------------------
--
-- Riwayat pendidikan selalu dibaca utuh bersama profil pemiliknya dan tidak
-- pernah dicari lintas-orang ("siapa saja alumni kampus X" bukan kebutuhan
-- sistem ini). Pola yang sama sudah dipakai migrasi 0014 untuk trainings,
-- amanah_history, dan awards -- menambah tabel join hanya untuk kolom ini
-- akan membuat satu daftar profil berperilaku beda dari empat daftar lain
-- di form yang sama.
--
-- -- KENAPA education_level TIDAK DIBUANG ---------------------
--
-- Kolom lama tetap ada dan tetap diisi aplikasi, tapi maknanya menyempit:
-- sekarang ia turunan, yaitu jenjang TERTINGGI dari education_history.
-- Alasannya penyaringan kepegawaian ("minimal S1") cukup membaca satu kolom
-- text dan tidak perlu membongkar jsonb. Aplikasi menulisnya otomatis di
-- app/actions/profile.ts; jangan diisi manual, isinya akan tertimpa saat
-- pengurus menyimpan profil.
--
-- Baris users lama: education_level yang sudah terisi diangkat jadi satu
-- baris riwayat supaya data yang sudah dimasukkan pengurus tidak hilang.
-- Lembaga/jurusan/tahunnya dikosongkan karena memang belum pernah ditanyakan.
-- ============================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "education_history" jsonb DEFAULT '[]'::jsonb;

UPDATE "users" SET "education_history" = '[]'::jsonb WHERE "education_history" IS NULL;

-- Angkat education_level lama menjadi baris pertama riwayat. Dijaga agar
-- hanya berjalan pada baris yang riwayatnya masih kosong, supaya menjalankan
-- ulang file ini tidak menggandakan entri.
UPDATE "users"
SET "education_history" = jsonb_build_array(
      jsonb_build_object(
        'level',           "education_level",
        'institution',     '',
        'major',           '',
        'graduation_year', ''
      )
    )
WHERE "education_level" IS NOT NULL
  AND "education_level" <> ''
  AND "education_history" = '[]'::jsonb;

-- Verifikasi (opsional):
-- SELECT username, education_level, education_history FROM users;
