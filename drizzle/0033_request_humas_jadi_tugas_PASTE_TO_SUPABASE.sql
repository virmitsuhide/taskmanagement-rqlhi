-- ============================================================
-- Request ke Humas ikut hidup sebagai tugas di papan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum task_source  + nilai 'humas_request'
--   • content_requests  + kolom task_id → tasks(id) ON DELETE SET NULL
--
-- Kenapa: request yang masuk ke Humas tidak punya tempat untuk menunjukkan
-- kemajuannya. Statusnya hanya requested → on_process → finish, tanpa cara
-- menyatakan "tertahan karena X". Akibatnya request yang macet diam saja tanpa
-- terlihat siapa pun. Papan tugas sudah punya kolom Problem, riwayat perubahan,
-- dan langkah Review; request tinggal dititipkan ke sana.
--
-- Tugas menjadi satu-satunya pemegang status. `content_requests.status` tidak
-- lagi ditulis untuk request yang punya task_id — nilainya diturunkan dari
-- status tugas saat dibaca. Dua kolom status yang ditulis terpisah cepat atau
-- lambat akan berbeda isi, dan tidak ada cara menentukan mana yang benar.
--
-- ON DELETE SET NULL, bukan CASCADE: menghapus tugas tidak boleh ikut
-- memusnahkan catatan bahwa permintaannya pernah diajukan. Pelajaran dari
-- 0031/0032 — kalau ragu, lepaskan tautannya, jangan hapus barisnya.
-- ============================================================

ALTER TYPE "task_source" ADD VALUE IF NOT EXISTS 'humas_request';

ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Verifikasi (opsional):
-- SELECT unnest(enum_range(NULL::task_source));
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'content_requests' AND column_name = 'task_id';
