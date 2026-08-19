-- ============================================================
-- Hapus akun guru yang bisa dipulihkan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • teachers + kolom deleted_at → "hapus" menyembunyikan, bukan membuang
--
-- KENAPA SOFT DELETE, BUKAN DELETE BIASA
--
-- Setoran guru terhubung lewat FK ON DELETE RESTRICT:
--   tahsin_logs.teacher_id  → teachers(id) ON DELETE RESTRICT
--   tahfidz_logs.teacher_id → teachers(id) ON DELETE RESTRICT
--
-- Artinya DELETE fisik akan DITOLAK database untuk guru mana pun yang pernah
-- menyimak setoran — yaitu hampir semua guru yang benar-benar mengajar. Kalau
-- constraint itu dilonggarkan jadi CASCADE, seluruh riwayat hafalan dan tahsin
-- santri ikut terhapus; rapor santri kehilangan datanya padahal yang ingin
-- dihapus cuma akun gurunya.
--
-- Sementara itu penugasan halaqoh justru ON DELETE CASCADE, jadi delete fisik
-- akan diam-diam melepas guru dari semua halaqohnya tanpa bisa dikembalikan.
--
-- Menyembunyikan alih-alih membuang menyelesaikan ketiganya sekaligus: riwayat
-- setoran utuh, penugasan halaqoh tetap tercatat, dan akun yang terlanjur
-- terhapus masih bisa dipulihkan. Pola yang sama sudah dipakai untuk tugas
-- (lihat 0018_task_soft_delete).
--
-- BEDANYA DENGAN is_active
--
-- is_active = guru nonaktif: tidak bisa login, tapi masih terdaftar dan masih
-- muncul di tab "Nonaktif" — misalnya guru yang sedang cuti panjang.
-- deleted_at = akun dibuang dari daftar: salah input, akun ganda, atau guru
-- yang sudah tidak berhubungan lagi dengan RQ.
-- ============================================================

ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;

-- Index parsial untuk pola query yang paling sering: daftar guru per status,
-- yang selalu disertai deleted_at IS NULL.
--
-- Yang di-index adalah kolom yang benar-benar dicari (is_active, full_name),
-- dengan deleted_at sebagai syarat parsial. Meng-index deleted_at itu sendiri
-- percuma: di dalam index parsial ini nilainya selalu NULL, jadi ia hanya
-- menyimpan konstanta dan tidak mempersempit pencarian apa pun.
CREATE INDEX IF NOT EXISTS "teachers_active_alive_idx"
  ON "teachers" ("is_active", "full_name")
  WHERE "deleted_at" IS NULL;

-- Daftar guru terhapus dibuka jauh lebih jarang, tapi tetap perlu urut waktu
-- hapus supaya yang baru saja terhapus muncul paling atas saat dicari.
CREATE INDEX IF NOT EXISTS "teachers_deleted_idx"
  ON "teachers" ("deleted_at" DESC)
  WHERE "deleted_at" IS NOT NULL;

-- Verifikasi (opsional):
-- SELECT full_name, is_active, deleted_at FROM teachers ORDER BY deleted_at DESC NULLS LAST LIMIT 10;
