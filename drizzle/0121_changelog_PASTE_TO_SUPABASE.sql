-- ============================================================
-- Pembaruan Sistem (changelog) — kabar perubahan fitur dari Kepala RQ
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru : changelog
--
-- ── SIAPA MENULIS, SIAPA MEMBACA ────────────────────────────
--
--   Menulis  : Kepala RQ saja.
--   Membaca  : tiap entri memilih pembacanya sendiri — boleh lebih dari satu:
--                untuk_pengurus  → dashboard pengurus (/pembaruan)
--                untuk_guru      → portal guru (/guru/pembaruan)
--                untuk_karyawan  → portal karyawan (/karyawan/profil)
--              Sedikitnya satu harus dicentang.
--
-- `terbit_at` boleh diisi tanggal yang sudah lewat (mencatat perubahan
-- lama) — urutan & penanda "baru" mengikuti tanggal ini, bukan created_at.
-- Penanda "sudah dibaca" disimpan di peramban masing-masing pengguna, jadi
-- tidak ada kolom tambahan di users/teachers/employees.
-- ============================================================

CREATE TABLE IF NOT EXISTS changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  isi text NOT NULL DEFAULT '',
  jenis text NOT NULL DEFAULT 'baru',
  untuk_pengurus boolean NOT NULL DEFAULT false,
  untuk_guru boolean NOT NULL DEFAULT false,
  untuk_karyawan boolean NOT NULL DEFAULT false,
  terbit_at timestamptz NOT NULL DEFAULT now(),
  ditulis_oleh uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT changelog_jenis_sah CHECK (jenis IN ('baru', 'perubahan', 'perbaikan')),
  CONSTRAINT changelog_ada_pembaca CHECK (untuk_pengurus OR untuk_guru OR untuk_karyawan)
);

CREATE INDEX IF NOT EXISTS changelog_terbit_idx ON changelog (terbit_at DESC);

ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT count(*) FROM changelog;
