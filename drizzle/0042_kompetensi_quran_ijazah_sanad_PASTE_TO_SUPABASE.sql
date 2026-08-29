-- ============================================================
-- Kompetensi Al-Qur'an & lainnya (bersertifikat) + Ijazah/Sanad
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah pada users:
--   • + quran_competencies jsonb  → [{ name, institution }]
--   • + other_competencies jsonb  → [{ name, institution }]
--   • + ijazah_sanad text[]       → daftar nama ijazah/sanad, tanpa tahun
--   • − competencies text[]       → isinya dipindah ke quran_competencies
--
-- KENAPA BENTUKNYA BERUBAH DARI text[] JADI jsonb
--
-- Kompetensi sekarang membawa dua hal: namanya, dan lembaga yang menjaminnya.
-- Kolom text[] hanya bisa menyimpan satu di antaranya. Menitipkan keduanya
-- dalam satu string dengan pemisah ("Tahsin UMMI — UMMI Foundation") akan
-- rusak begitu ada nama kompetensi yang memuat pemisah itu, dan memaksa
-- setiap pembaca mengurai ulang. Bentuk objek menyatakan strukturnya sekali,
-- di tempat datanya disimpan.
--
-- KENAPA "institution" KOSONG PUNYA ARTI
--
-- Kosong = kompetensinya diakui tapi belum tersertifikasi lembaga mana pun.
-- Itu keadaan yang wajar dan tidak perlu ditandai bendera terpisah: pertanyaan
-- "tersertifikasi oleh siapa" dan "apakah tersertifikasi" dijawab kolom yang
-- sama, sehingga keduanya mustahil bertentangan.
--
-- KENAPA IJAZAH/SANAD TETAP text[]
--
-- Yang dicatat memang hanya namanya — tanpa tahun, tanpa lembaga. Sanad adalah
-- rantai periwayatan yang namanya sudah memuat sumbernya, jadi kolom tambahan
-- akan selalu kosong.
--
-- CATATAN PEMINDAHAN DATA
--
-- Seluruh isi competencies lama masuk ke quran_competencies dengan lembaga
-- kosong. Tidak ada penebakan: sebagian baris lama sebenarnya kompetensi
-- non-Qur'an ("Kurikulum PHI", "Training dan Coaching Pembelajaran Guru"),
-- dan menebak mana yang mana lewat kata kunci pasti salah untuk sebagian
-- orang. Pemiliknya tinggal memindahkannya ke "Kompetensi Lain" lewat form
-- profil — satu kali, dan ia sendiri yang tahu jawabannya.
-- ============================================================

-- 1) Kolom baru
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "quran_competencies" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "other_competencies" jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ijazah_sanad" text[];

-- 2) Pindahkan isi kolom lama, lalu lepaskan kolomnya.
--
-- Dibungkus DO + EXECUTE supaya seluruh blok bisa dijalankan ulang: setelah
-- competencies terhapus, penjaganya bernilai false dan isinya dilewati. Tanpa
-- EXECUTE, plpgsql tetap harus mengurai pernyataan yang menyebut kolom yang
-- sudah tidak ada dan skripnya gagal pada jalan kedua.
DO $$
DECLARE
  kolom_lama_ada boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'competencies'
  ) INTO kolom_lama_ada;

  IF kolom_lama_ada THEN
    EXECUTE $sql$
      UPDATE users u
         SET quran_competencies = COALESCE((
               SELECT jsonb_agg(jsonb_build_object('name', btrim(c), 'institution', ''))
                 FROM unnest(u.competencies) AS c
                WHERE btrim(c) <> ''
             ), '[]'::jsonb)
       WHERE u.quran_competencies IS NULL
         AND u.competencies IS NOT NULL
    $sql$;

    EXECUTE 'ALTER TABLE users DROP COLUMN competencies';
  END IF;
END $$;

-- Verifikasi (opsional) — kolom lama hilang, isinya pindah:
-- SELECT display_name, quran_competencies, other_competencies, ijazah_sanad
--   FROM users
--  WHERE quran_competencies IS NOT NULL AND quran_competencies <> '[]'::jsonb;
