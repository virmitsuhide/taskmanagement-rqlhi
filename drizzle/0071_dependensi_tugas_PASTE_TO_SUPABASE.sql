-- ============================================================
-- Dependensi antar tugas — "tugas ini menunggu tugas itu"
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • task_dependencies          → BARU, satu baris = satu relasi menunggu
--   • enum task_history_action   → + dependency_added, dependency_removed
--
-- ── SATU JENIS RELASI SAJA ──────────────────────────────────
--
-- Teori Gantt mengenal empat jenis (finish-to-start, start-to-start, …) plus
-- lag & lead. Alat yang dipakai tim sungguhan — Linear, Jira — menyusutkannya
-- menjadi "blocked by / blocking", dan untuk pengurus RQ itu pun sudah
-- cukup: yang ingin diketahui adalah "saya baru bisa mulai setelah tugas itu
-- selesai". Itulah finish-to-start, dan hanya itu yang disimpan di sini.
--
-- task_id       = tugas yang MENUNGGU
-- depends_on_id = tugas yang DITUNGGU (penghambat)
--
-- Keduanya boleh milik orang yang sama maupun berbeda — bentuk datanya sama,
-- yang berbeda hanya siapa yang diberi tahu.
--
-- ── BENTROK JADWAL TIDAK DISIMPAN ───────────────────────────
--
-- Apakah sebuah relasi "bentrok" (tugas menunggu dijadwalkan mulai sebelum
-- penghambatnya selesai) dihitung saat dibaca dari tanggal & status kedua
-- tugas — lib/tasks/dependensi.ts. Menyimpannya berarti harus diperbarui
-- setiap kali salah satu dari empat kolom itu berubah, dari alur mana pun.
--
-- ── KENAPA ON DELETE CASCADE ────────────────────────────────
--
-- Tugas di aplikasi ini dihapus lunak (deleted_at), jadi cascade hanya
-- berlaku bila barisnya benar-benar dibuang dari basis data. Relasi ke tugas
-- yang dihapus lunak tetap tersimpan — tugasnya bisa dipulihkan — dan
-- disaring saat dibaca.
--
-- ── RIWAYAT & NOTIFIKASI ────────────────────────────────────
--
-- Notifikasi aplikasi ini diturunkan dari task_history (lihat
-- lib/data/notifications.ts). Menambah relasi menulis baris 'dependency_added'
-- di riwayat tugas yang DITUNGGU, sehingga pemegangnya tahu ada yang menunggu
-- pekerjaannya. Notifikasi "sudah bisa dilanjutkan" tidak butuh baris baru:
-- ia diturunkan dari riwayat penghambat yang berpindah ke 'done'.
-- ============================================================

CREATE TABLE IF NOT EXISTS "task_dependencies" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id"       uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "depends_on_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "created_by"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "task_dependencies_bukan_diri_sendiri" CHECK ("task_id" <> "depends_on_id"),
  CONSTRAINT "task_dependencies_unik" UNIQUE ("task_id", "depends_on_id")
);

-- UNIQUE di atas sudah mengindeks task_id sebagai kolom depan; arah
-- sebaliknya ("siapa saja yang menunggu tugas ini") butuh indeks sendiri.
CREATE INDEX IF NOT EXISTS "task_dependencies_depends_on_idx"
  ON "task_dependencies" ("depends_on_id");

ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;

-- ADD VALUE tidak bisa dipakai di transaksi yang sama dengan penambahannya;
-- berkas ini tidak memakainya, jadi aman dijalankan sekali jalan.
ALTER TYPE task_history_action ADD VALUE IF NOT EXISTS 'dependency_added';
ALTER TYPE task_history_action ADD VALUE IF NOT EXISTS 'dependency_removed';
