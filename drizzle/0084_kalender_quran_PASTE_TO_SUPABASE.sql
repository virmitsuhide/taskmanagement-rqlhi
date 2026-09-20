-- ============================================================
-- Kalender aktif pembelajaran Al-Qur'an & Tatap Muka (TM)
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0081 (absensi_harian).
--
-- Yang berubah:
--   • kalender_jadwal → BARU, hari aktif per (semester, unit, program)
--   • kalender_kosong → BARU, tanggal yang sesinya ditiadakan
--
-- ── MASALAH YANG DISELESAIKAN ───────────────────────────────
--
-- Rapor membandingkan kehadiran anak dengan "jumlah pertemuan". Sampai
-- sekarang jumlah itu dihitung dari banyaknya tanggal yang pernah diabsen —
-- yang berarti pertemuan yang terjadi tapi lupa diabsen menghilang dari
-- penyebutnya, dan kehadiran anak jadi terlihat lebih baik daripada
-- kenyataannya. Sejak sekarang penyebutnya adalah TATAP MUKA menurut
-- kalender: berapa kali sesi Qur'an memang dijadwalkan dan tidak ditiadakan.
--
-- ── DUA LAPIS: JADWAL DASAR, LALU PENGECUALIAN ──────────────
--
-- Lapis pertama, jadwal dasar, melekat pada PROGRAM. Anak reguler mengaji
-- Senin–Kamis; QULS dan QULS Takhassus punya sesi tahfidz Jum'at, jadi TM
-- mereka lebih banyak dan kehadirannya dibandingkan dengan TM programnya
-- sendiri — bukan TM reguler.
--
-- Lapis kedua, pengecualian, melekat pada ANGKATAN. Agenda satu angkatan
-- (class meeting, outing, pekan ujian) meniadakan sesi Qur'an angkatan itu
-- hari tersebut. Kolom `kelas` boleh diisi bila yang berhalangan hanya satu
-- rombel: NULL berarti seluruh angkatan.
--
-- Pengecualian TIDAK disaring per program. Agenda kelas 2 meniadakan sesi
-- seluruh anak kelas 2, reguler maupun QULS — mereka duduk di rombel yang
-- sama dan pergi ke acara yang sama.
--
-- ── KENAPA JADWAL DASAR BOLEH KOSONG ────────────────────────
--
-- Baris kalender_jadwal yang belum ada tidak berarti "tidak ada sesi",
-- melainkan "belum diatur" — kodenya jatuh ke bawaan Senin–Kamis, plus
-- Jum'at untuk program QULS (lihat lib/rq/kalender-quran.ts). Dengan begitu
-- TM sudah benar sejak hari pertama, dan koordinator hanya perlu menyentuh
-- unit yang jadwalnya memang berbeda.
-- ============================================================

CREATE TABLE IF NOT EXISTS "kalender_jadwal" (
  "term_id"  uuid NOT NULL REFERENCES "academic_terms"("id") ON DELETE CASCADE,
  "jenjang"  jenjang NOT NULL,
  /* Kode program (lib/rq/programs.ts). '' = anak tanpa program / reguler. */
  "program"  text NOT NULL DEFAULT '',
  /* Hari aktif menurut ISO-8601: 1 = Senin … 7 = Ahad. */
  "hari"     smallint[] NOT NULL DEFAULT '{1,2,3,4}',
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("term_id", "jenjang", "program")
);

CREATE TABLE IF NOT EXISTS "kalender_kosong" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tanggal"   date NOT NULL,
  "jenjang"   jenjang NOT NULL,
  /* Angkatan = tingkat kelas, mis. 2 untuk seluruh kelas 2. */
  "tingkat"   smallint NOT NULL,
  /* NULL = seluruh angkatan; terisi = satu rombel saja, mis. '2B'. */
  "kelas"     text,
  "alasan"    text NOT NULL DEFAULT '',
  "ditandai_oleh" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Satu tanggal hanya boleh ditandai sekali untuk sasaran yang sama. Dua
-- indeks parsial karena NULL tidak pernah sama dengan NULL di UNIQUE biasa:
-- tanpa yang pertama, "seluruh angkatan" bisa ditandai berkali-kali dan TM
-- ikut berkurang sebanyak itu.
CREATE UNIQUE INDEX IF NOT EXISTS "kalender_kosong_angkatan_uniq"
  ON "kalender_kosong" ("tanggal", "jenjang", "tingkat")
  WHERE "kelas" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "kalender_kosong_kelas_uniq"
  ON "kalender_kosong" ("tanggal", "jenjang", "tingkat", "kelas")
  WHERE "kelas" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "kalender_kosong_jenjang_tanggal_idx"
  ON "kalender_kosong" ("jenjang", "tanggal");

ALTER TABLE "kalender_jadwal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kalender_kosong" ENABLE ROW LEVEL SECURITY;
