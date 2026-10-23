-- ============================================================
-- Template pesan WhatsApp laporan orang tua — milik tiap guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru : template_wa_ortu
--
-- Selain template dasar (disusun aplikasi), tiap guru boleh menyimpan
-- sampai 3 template sendiri. Isinya teks bebas dengan penanda yang diisi
-- aplikasi saat pesan dibuat: {sesi} {periode} {ringkasan} {rincian}
-- {tautan} {guru} {jumlah_anak} {anak_setor} — lihat lib/rq/laporan-ortu.ts.
--
-- ── KENAPA NOMOR SLOT 1–3, BUKAN id ACAK ────────────────────
--
-- Batas "3 template" dijaga oleh datanya sendiri: kunci utamanya
-- (teacher_id, slot) dengan slot 1–3, jadi template keempat tidak mungkin
-- tersimpan, sekalipun dua tab menyimpan bersamaan. Menghitung jumlah baris
-- di aplikasi sebelum insert tidak menjamin itu.
--
-- Aplikasi aman dijalankan sebelum file ini: pemilih template hanya
-- menampilkan template dasar dan pesan bahwa fitur belum aktif.
-- ============================================================

CREATE TABLE IF NOT EXISTS "template_wa_ortu" (
  "teacher_id"  uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "slot"        smallint NOT NULL CHECK ("slot" BETWEEN 1 AND 3),
  "nama"        text NOT NULL CHECK (length(btrim("nama")) BETWEEN 1 AND 40),
  "isi"         text NOT NULL CHECK (length(btrim("isi")) BETWEEN 1 AND 4000),
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("teacher_id", "slot")
);

ALTER TABLE "template_wa_ortu" ENABLE ROW LEVEL SECURITY;

-- Verifikasi (opsional):
-- SELECT teacher_id, slot, nama FROM template_wa_ortu ORDER BY 1, 2;
