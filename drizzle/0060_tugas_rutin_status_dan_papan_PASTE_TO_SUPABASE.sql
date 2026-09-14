-- ============================================================
-- Tugas Rutin — irama semesteran & tahunan, plus status "tidak terlaksana"
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum routine_cadence     : + semesteran, tahunan
--   • enum routine_outcome     : baru — terlaksana / tidak_terlaksana
--   • routine_task_checks      : + outcome, + reason (alasan tidak terlaksana)
--
-- ── KENAPA BARISNYA TETAP SATU, BUKAN DUA TABEL ─────────────
--
-- Godaannya adalah membuat tabel kedua untuk laporan "tidak terlaksana",
-- karena isinya beda (ada alasan). Tapi keduanya menjawab pertanyaan yang
-- sama — "apa kabar tugas ini pada periode X?" — dan memisahkannya berarti
-- setiap pembacaan harus menggabung dua tabel lalu memastikan sebuah tugas
-- tidak muncul di keduanya sekaligus. Kunci primer (task_id, period) yang
-- sudah ada justru menjamin hal itu secara gratis: satu tugas hanya punya
-- satu laporan per periode, apa pun hasilnya.
--
-- Efeknya arti barisnya bergeser sedikit, dan ini yang perlu diingat saat
-- membaca kode lama: ADANYA baris kini berarti "sudah dilaporkan", bukan lagi
-- "sudah selesai". Yang menjawab selesai/tidak adalah kolom outcome.
--
-- ── KENAPA DEFAULT-NYA 'terlaksana' ─────────────────────────
--
-- Semua baris yang sudah ada dibuat sebelum kolom ini ada, dan satu-satunya
-- cara membuatnya dulu adalah mencentang. Jadi 'terlaksana' bukan tebakan
-- yang aman-aman saja — itu memang persis arti baris-baris lama tersebut.
--
-- ── KENAPA ALASANNYA DIPAKSA DATABASE, BUKAN CUKUP DI FORM ──
--
-- Laporan "tidak terlaksana" tanpa alasan tidak ada gunanya bagi kepala RQ:
-- yang dia perlukan justru sebabnya, bukan angkanya. Validasi di server
-- action memang sudah ada, tapi ia hanya menjaga satu pintu; skrip seed,
-- perbaikan manual lewat SQL editor, dan endpoint yang ditulis kemudian
-- lewat begitu saja. CHECK ini membuat baris tanpa alasan mustahil ada,
-- dari pintu mana pun ia datang.
--
-- Arah sebaliknya ikut dijaga: 'terlaksana' harus beralasan NULL. Tanpa itu,
-- alasan bisa tertinggal sebagai sampah saat pengurus meralat laporannya
-- dari "tidak terlaksana" menjadi "terlaksana", dan papan kepala RQ akan
-- menampilkan sebab untuk tugas yang sebenarnya beres.
--
-- ── IRAMA BARU ──────────────────────────────────────────────
--
-- Kunci periodenya (lihat lib/rutin/periode.ts) mengikuti tahun ajaran, bukan
-- tahun kalender: '2026-S1' untuk semester ganjil (Juli–Desember 2026),
-- '2026-S2' untuk genap (Januari–Juni 2027), dan '2026-TA' untuk satu tahun
-- ajaran penuh. Bentuknya sengaja berbeda dari '2026-W36' dan '2026-08'
-- supaya keempat irama tidak pernah bertabrakan di kolom period yang sama.
--
-- ⚠️ Jalankan SQL ini SEBELUM men-deploy kodenya. Tanpa nilai enum-nya,
--    menyimpan tugas semesteran/tahunan ditolak dengan
--    'invalid input value for enum routine_cadence'.
-- ============================================================

-- 1) Dua irama baru.
--    Postgres melarang memakai nilai enum baru di transaksi yang sama dengan
--    ALTER TYPE-nya, dan SQL editor membungkus satu Run sebagai satu
--    transaksi — karena itu tidak ada satu pun pernyataan di bawah yang
--    menyebut 'semesteran' atau 'tahunan'.
ALTER TYPE "routine_cadence" ADD VALUE IF NOT EXISTS 'semesteran';
ALTER TYPE "routine_cadence" ADD VALUE IF NOT EXISTS 'tahunan';

-- 2) Hasil pelaksanaan
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routine_outcome') THEN
    CREATE TYPE routine_outcome AS ENUM ('terlaksana', 'tidak_terlaksana');
  END IF;
END $$;

-- 3) Kolom baru pada laporan per periode
ALTER TABLE "routine_task_checks"
  ADD COLUMN IF NOT EXISTS "outcome" routine_outcome NOT NULL DEFAULT 'terlaksana';

ALTER TABLE "routine_task_checks"
  ADD COLUMN IF NOT EXISTS "reason" text;

-- 4) Alasan wajib ada saat tidak terlaksana, dan wajib kosong saat terlaksana
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'routine_task_checks_alasan_ck'
  ) THEN
    ALTER TABLE "routine_task_checks"
      ADD CONSTRAINT "routine_task_checks_alasan_ck" CHECK (
        ("outcome" = 'tidak_terlaksana' AND "reason" IS NOT NULL AND btrim("reason") <> '')
        OR
        ("outcome" = 'terlaksana' AND "reason" IS NULL)
      );
  END IF;
END $$;

-- 5) Papan kepala RQ membaca laporan seluruh pengurus untuk periode berjalan,
--    lalu memisahkan yang tidak terlaksana. Indeks period yang sudah ada (0043)
--    menyempitkan ke periodenya; kolom outcome ikut disertakan supaya
--    penyaringan "mana yang gagal" tidak perlu menyentuh heap-nya.
CREATE INDEX IF NOT EXISTS "routine_task_checks_period_outcome_idx"
  ON "routine_task_checks" ("period", "outcome");

-- Verifikasi (opsional):
-- SELECT unnest(enum_range(NULL::routine_cadence));   -- harus 4 baris
-- SELECT t.description, t.cadence, c.period, c.outcome, c.reason
--   FROM routine_tasks t
--   LEFT JOIN routine_task_checks c ON c.task_id = t.id
--  ORDER BY t.cadence, t.order_num;
