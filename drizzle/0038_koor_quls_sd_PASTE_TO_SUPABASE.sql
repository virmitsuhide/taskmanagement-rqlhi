-- ============================================================
-- Koor QULS SD — role pengurus baru & program pada halaqoh
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum user_role : + koor_qulssd
--   • halaqoh        : + kolom program (text, boleh NULL)
--
-- ── KENAPA PROGRAM, BUKAN JENJANG BARU ──────────────────────
--
-- QULS SD bukan unit tersendiri: anaknya tetap siswa SDIT LHI, tetap kelas
-- 1–6, tetap masuk sesi 1–3 yang sama. Yang membedakan cuma programnya —
-- dan kolom students.program sudah menampung itu sejak awal ('quls',
-- 'quls_takhassus'). Menambah nilai jenjang baru akan memecah satu unit
-- menjadi dua di setiap rekap, analitik, dan laporan yang menghitung "SD".
--
-- Konsekuensinya, wewenang pengurus tidak lagi cukup dibatasi per jenjang
-- saja. Lapisan penyempitan berbasis program ada di lib/auth/permissions.ts
-- (getViewableProgramScope / canManageStudents), bukan di database — sama
-- seperti seluruh RBAC aplikasi ini.
--
-- ── KENAPA HALAQOH IKUT PUNYA KOLOM PROGRAM ─────────────────
--
-- Kelompok QULS belajar terpisah dari kelompok reguler walau sejenjang dan
-- sesejenis sesi. Tanpa penanda di barisnya, satu-satunya pembeda adalah
-- kebiasaan menulis '(QULS)' di dalam nama — persis kekeliruan yang sudah
-- pernah dibetulkan pada 'tempat' di migrasi 0026: keterangan yang dititipkan
-- di dalam nama akan berbohong begitu namanya diubah.
--
-- NULL berarti "reguler / belum ditandai", jadi 72 halaqoh yang sudah ada
-- tetap sah tanpa backfill dan tetap menjadi wewenang koor unitnya.
--
-- ⚠️ Jalankan SQL ini SEBELUM men-deploy kodenya. Tanpa nilai enum-nya,
--    pembuatan akun koor_qulssd ditolak dengan
--    'invalid input value for enum user_role'.
--
-- ⚠️ Nilai enum tidak bisa dihapus di Postgres. Kalau perlu rollback,
--    harus membuat type baru.
--
-- ⚠️ Akun koor_qulssd TIDAK dibuat di sini. Password harus di-hash bcrypt,
--    dan itu tidak bisa dilakukan SQL editor tanpa pgcrypto. Setelah SQL ini
--    dijalankan:  npm run seed:koor-qulssd
--    (memisahkannya juga menghindari jebakan Postgres "unsafe use of new
--    value of enum type" — nilai enum baru tidak boleh dipakai di transaksi
--    yang sama dengan ALTER TYPE-nya, dan SQL editor membungkus satu Run
--    sebagai satu transaksi.)
-- ============================================================

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'koor_qulssd';

ALTER TABLE halaqoh ADD COLUMN IF NOT EXISTS program text;

COMMENT ON COLUMN halaqoh.program IS
  'Program pemilik kelompok, mis. ''quls'' / ''quls_takhassus''. NULL = reguler.';

-- Daftar halaqoh disaring per (jenjang, program) di layar Koor QULS SD.
CREATE INDEX IF NOT EXISTS halaqoh_jenjang_program_idx ON halaqoh (jenjang, program);

-- Verifikasi (opsional):
-- SELECT unnest(enum_range(NULL::user_role));           -- harus 11 baris
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'halaqoh' AND column_name = 'program';
