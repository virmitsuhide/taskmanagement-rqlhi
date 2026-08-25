-- ============================================================
-- Rapat boleh dihapus tanpa ikut menyeret tugas turunannya
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tasks.source_meeting_id : ON DELETE no action → ON DELETE SET NULL
--
-- Kenapa: sejak 0000 kolom ini memakai "no action", jadi Postgres menolak
-- menghapus rapat yang pernah melahirkan tugas. Yang paling membingungkan,
-- tugas yang sudah dihapus lewat UI pun tetap menahan — penghapusan tugas
-- bersifat lunak (deleted_at), barisnya masih ada. Akibatnya daftar tugas
-- terlihat bersih tapi rapatnya tetap menolak dihapus, dengan pesan galat yang
-- tidak menyebutkan apa pun.
--
-- Kenapa SET NULL, bukan CASCADE: tugas adalah pekerjaan yang benar-benar
-- terjadi dan sudah punya riwayat sendiri. Menghapus catatan rapat adalah
-- tindakan kerapian arsip, dan itu tidak boleh sampai memusnahkan bukti bahwa
-- pekerjaannya pernah dikerjakan dan selesai.
--
-- Aman untuk data yang ada: source_meeting_id tidak pernah dibaca untuk
-- ditampilkan di mana pun — hanya ditulis saat tugas dibuat dari notulen.
-- Jadi tautan yang dilepas tidak mengubah apa pun yang dilihat pengurus.
-- ============================================================

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_source_meeting_id_meetings_id_fk;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_source_meeting_id_meetings_id_fk
  FOREIGN KEY (source_meeting_id) REFERENCES public.meetings(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Verifikasi (opsional) — harus mengembalikan 'SET NULL':
-- SELECT rc.delete_rule
--   FROM information_schema.referential_constraints rc
--  WHERE rc.constraint_name = 'tasks_source_meeting_id_meetings_id_fk';
