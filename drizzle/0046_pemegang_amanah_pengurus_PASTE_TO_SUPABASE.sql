-- ============================================================
-- Pemegang amanah pengurus — satu jabatan, satu orang
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • teachers.linked_user_id : + indeks unik parsial + indeks pencarian
--
-- TIDAK ADA KOLOM BARU. Penghubung antara jabatan dan orangnya sudah ada sejak
-- awal di teachers.linked_user_id — selama ini hanya dipakai diam-diam sebagai
-- cadangan foto di lib/data/site.ts. Migrasi ini mengangkatnya jadi penopang
-- fitur Pengurus: kepala RQ memilih siapa yang menduduki tiap jabatan, lalu
-- profil yang tampil di akun jabatan itu dibaca dari rekam guru yang terpilih.
--
-- Kenapa arahnya guru → akun, bukan akun → guru: kolomnya sudah ada dan sudah
-- terisi benar untuk 8 dari 11 jabatan. Menambah users.holder_teacher_id akan
-- membuat dua penghubung yang sama-sama boleh diisi — dan cepat atau lambat
-- keduanya akan menunjuk orang yang berbeda tanpa ada yang menyadarinya.
--
-- Indeks uniknya PARSIAL (WHERE linked_user_id IS NOT NULL): guru yang tidak
-- memegang jabatan apa pun jumlahnya jauh lebih banyak, dan NULL memang boleh
-- berulang. Tanpa WHERE, Postgres tetap mengizinkannya, tapi indeksnya jadi
-- menyimpan 25 baris NULL yang tidak pernah dicari siapa pun.
--
-- Guru yang sudah dihapus lunak ikut dikecualikan: baris deleted_at tetap
-- tinggal di tabel, dan kalau ia masih memegang kursi, kursi itu terkunci untuk
-- orang yang masih aktif.

-- Bersihkan dulu kalau ada guru terhapus yang masih memegang kursi.
UPDATE teachers SET linked_user_id = NULL
WHERE deleted_at IS NOT NULL AND linked_user_id IS NOT NULL;

-- Satu akun jabatan hanya boleh diduduki satu guru.
CREATE UNIQUE INDEX IF NOT EXISTS teachers_linked_user_id_unik
  ON teachers (linked_user_id)
  WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL;
