-- ============================================================
-- Kartu beranda guru yang sudah ditutup (✕) — disimpan di server
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • guru_kartu_tersembunyi → BARU, satu baris per kartu yang ditutup guru
--
-- ── KENAPA PINDAH DARI localStorage ─────────────────────────
--
-- Sebelumnya tombol ✕ hanya mencatat di peramban. Guru yang login di HP lain,
-- di laptop sekolah, di mode penyamaran, atau yang peramban-nya dibersihkan
-- melihat lagi semua pengumuman yang sudah ia tutup. Dicatat per guru di
-- server, kartu itu tetap tertutup di perangkat mana pun ia masuk.
--
-- `ruang` memisahkan jenis kartu ('pengumuman', 'progres-ujian') supaya id
-- dari tabel berbeda tidak saling menutup. `kunci` sengaja text tanpa FK:
-- isinya id dari tabel yang berbeda-beda menurut ruangnya.
-- ============================================================

CREATE TABLE IF NOT EXISTS "guru_kartu_tersembunyi" (
  "teacher_id"  uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "ruang"       text NOT NULL,
  "kunci"       text NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("teacher_id", "ruang", "kunci")
);

ALTER TABLE "guru_kartu_tersembunyi" ENABLE ROW LEVEL SECURITY;
