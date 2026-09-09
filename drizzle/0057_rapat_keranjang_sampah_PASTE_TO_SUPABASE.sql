-- ============================================================
-- Keranjang sampah rapat
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • meetings + kolom deleted_at → "hapus" menyembunyikan, bukan membuang
--   • meetings + kolom deleted_by → siapa yang membuangnya
--
-- KENAPA SOFT DELETE, BUKAN DELETE BIASA
--
-- Sampai migrasi ini, tombol hapus di /rapat menjalankan DELETE fisik. Karena
--   agenda_items.meeting_id → meetings(id) ON DELETE CASCADE
-- seluruh butir agenda dan notulennya ikut terbuang di detik yang sama, dan
-- tidak ada satu pun jejak yang tertinggal di database: bukan barisnya, bukan
-- agendanya, bukan catatan siapa yang menghapus. Sebuah notulen rapat yang
-- hilang karena salah klik tidak bisa dibuktikan pernah ada, apalagi dipulihkan.
--
-- Rapat adalah catatan kelembagaan — notulen, peserta, dan keputusan yang
-- dirujuk berbulan-bulan kemudian. Ia berhak diperlakukan seperti tugas dan
-- akun guru, yang sudah lebih dulu memakai pola ini (0018 dan 0020).
--
-- Setelah migrasi ini: koordinator "membuang" rapat ke keranjang sampah, dan
-- hanya Kepala RQ yang bisa mengosongkannya secara permanen. Penghapusan yang
-- benar-benar tidak bisa dibatalkan jadi terjadi di satu tempat, oleh satu
-- peran, dengan seluruh isinya masih terlihat sebelum diputuskan.
--
-- CATATAN TENTANG TUGAS TURUNAN
--
-- tasks.source_meeting_id → meetings(id) TANPA cascade, jadi PostgreSQL menolak
-- DELETE fisik atas rapat yang pernah melahirkan tugas (error 23503). Pengecekan
-- itu tetap dipertahankan di app/actions/meetings.ts, tapi kini hanya relevan
-- saat Kepala RQ mengosongkan keranjang sampah — bukan lagi saat koordinator
-- menekan tombol hapus.
-- ============================================================

ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");

-- Daftar /rapat selalu menyaring per jenis lalu mengurutkan tanggal menurun,
-- dan sejak migrasi ini selalu disertai deleted_at IS NULL. Yang di-index adalah
-- kolom yang benar-benar dicari (type, date); deleted_at cukup jadi syarat
-- parsial — di dalam index ini nilainya selalu NULL, jadi meng-index kolomnya
-- sendiri hanya menyimpan konstanta tanpa mempersempit apa pun.
CREATE INDEX IF NOT EXISTS "meetings_type_date_alive_idx"
  ON "meetings" ("type", "date" DESC)
  WHERE "deleted_at" IS NULL;

-- Keranjang sampah jarang dibuka, tapi saat dibuka selalu urut waktu pembuangan
-- supaya yang baru saja terbuang muncul paling atas.
CREATE INDEX IF NOT EXISTS "meetings_deleted_idx"
  ON "meetings" ("deleted_at" DESC)
  WHERE "deleted_at" IS NOT NULL;

-- Verifikasi (opsional):
-- SELECT count(*) FILTER (WHERE deleted_at IS NULL)     AS aktif,
--        count(*) FILTER (WHERE deleted_at IS NOT NULL) AS di_keranjang
-- FROM meetings;
