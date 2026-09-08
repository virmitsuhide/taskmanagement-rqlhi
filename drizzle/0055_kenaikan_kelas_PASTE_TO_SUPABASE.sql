-- ============================================================
-- Penanda kenaikan kelas per tahun ajaran
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • academic_terms : kolom kenaikan_at (boleh NULL — belum dinaikkan)
--
-- ── PERSOALAN YANG DITUTUP ──────────────────────────────────
--
-- Kenaikan kelas menulis ke SELURUH baris students sekaligus: 1A jadi 2A, 2A
-- jadi 3A, dan kelas ujung jenjang ditandai lulus. Dijalankan dua kali, anak
-- kelas 1 mendarat di kelas 3 dan seangkatan kelas 6 lenyap dari daftar aktif —
-- tanpa satu pun galat, sebab tiap langkahnya sah bila dilihat sendiri-sendiri.
--
-- Tidak ada cara memulihkannya dari data yang tersisa. Kelas lama tidak disimpan
-- di mana pun, jadi "2A" tidak bisa dibedakan antara yang memang naik sekali dan
-- yang naik dua kali. Pemulihannya berarti membaca ulang berkas Excel angkatan
-- itu — kalau masih ada.
--
-- Karena itu penjaganya diletakkan di DATABASE, bukan di tombolnya. Konfirmasi
-- di layar hanya menahan orang yang ragu; ia tidak menahan tab kedua yang lupa
-- ditutup, tombol yang diklik dua kali karena lambat, atau percobaan ulang
-- sesudah jaringan putus di tengah jalan.
--
-- ── KENAPA PADA TERM, BUKAN PADA STUDENTS ───────────────────
--
-- Kenaikan adalah peristiwa satu tahun ajaran, bukan sifat seorang anak.
-- Menyimpannya per siswa (mis. 'naik_terakhir') menuntut 694 baris diperiksa
-- untuk menjawab "sudah dinaikkan belum tahun ini", dan jawabannya bisa
-- berbeda-beda antar baris kalau prosesnya pernah terhenti di tengah.
--
-- Satu penanda pada tahun ajaran tujuan menjawabnya sekali, dan jawabannya
-- tidak bisa setengah: baik seluruh angkatan sudah dinaikkan ke tahun ini,
-- atau belum.

ALTER TABLE "academic_terms"
  ADD COLUMN IF NOT EXISTS "kenaikan_at" timestamptz;

COMMENT ON COLUMN "academic_terms"."kenaikan_at" IS
  'Kapan kenaikan kelas dijalankan menuju tahun ajaran ini. NULL = belum. Terisi = kenaikan ditolak, supaya tidak berjalan dua kali.';
