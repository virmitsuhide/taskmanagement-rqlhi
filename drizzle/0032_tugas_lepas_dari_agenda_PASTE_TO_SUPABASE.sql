-- ============================================================
-- Lanjutan 0031: lepaskan juga tautan tugas → poin agenda
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tasks.source_agenda_id : ON DELETE no action → ON DELETE SET NULL
--
-- Kenapa masih ada lanjutan: 0031 melepas tautan tugas → rapat, tapi tugas
-- menyimpan DUA tautan ke notulen yang sama, dan yang kedua terlewat.
--
--   meetings ──cascade──> agenda_items <──no action── tasks.source_agenda_id
--
-- Menghapus rapat ikut menghapus poin agendanya (cascade, sejak 0000), lalu
-- Postgres berhenti di langkah itu karena masih ada tugas yang menunjuk poin
-- agenda tersebut. Jadi rapatnya tetap ditolak walau 0031 sudah jalan — dengan
-- kode galat yang sama persis (23503), sehingga terlihat seolah 0031 gagal.
--
-- Alasannya sama seperti 0031: tugas adalah pekerjaan yang benar-benar terjadi.
-- Merapikan arsip rapat tidak boleh memusnahkan buktinya.
-- ============================================================

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_source_agenda_id_agenda_items_id_fk;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_source_agenda_id_agenda_items_id_fk
  FOREIGN KEY (source_agenda_id) REFERENCES public.agenda_items(id)
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Verifikasi (opsional) — keduanya harus 'SET NULL':
-- SELECT constraint_name, delete_rule
--   FROM information_schema.referential_constraints
--  WHERE constraint_name IN ('tasks_source_meeting_id_meetings_id_fk',
--                            'tasks_source_agenda_id_agenda_items_id_fk');
