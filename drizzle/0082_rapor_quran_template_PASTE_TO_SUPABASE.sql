-- ============================================================
-- Rapor Qur'an — template unggahan koordinator & isian guru
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Prasyarat: 0081 (absensi_harian) — rapor membaca Hadir/Izin/Alfa dari sana.
--
-- Yang berubah:
--   • rapor_templates → BARU, template .docx yang diunggah koordinator
--   • rapor_isian     → BARU, deskripsi & timpaan guru per anak per semester
--
-- ── KENAPA TEMPLATE DISIMPAN SEBAGAI BLOK, BUKAN BERKAS ─────
--
-- Koordinator mengunggah berkas Word yang sudah dipakai sekolah. Berkasnya
-- ikut disimpan di Storage untuk arsip, tapi yang DIPAKAI mencetak adalah
-- hasil terjemahannya: daftar blok (paragraf, tabel, kotak teks) di kolom
-- `blok`. Rapor dicetak sebagai lembar A4 HTML lewat cetak peramban — pola
-- yang sama dengan rapor KPI dan Laporan Orang Tua — sebab tidak ada
-- LibreOffice di Vercel yang bisa mengubah .docx terisi menjadi PDF.
--
-- `pemetaan` menghubungkan tempat-tempat isian di template dengan sumber
-- datanya: {"p5.2": "nilai_tahsin", "k9": "deskripsi"}. Kuncinya posisi blok,
-- nilainya kode medan (lihat lib/rapor/medan.ts). Sistem menebaknya saat
-- unggah, koordinator membetulkan lewat layar pemetaan — tebakan yang salah
-- jadi kelihatan sebelum satu rapor pun dicetak.
--
-- ── KENAPA TEMPLATE TERIKAT TINGKAT KELAS ───────────────────
--
-- SDIT memakai satu format untuk kelas 1-5 dan SMPIT format lain; kelas 6
-- kelak bisa punya formatnya sendiri. Karena itu jangkauannya disimpan
-- sebagai rentang tingkat, bukan daftar kelas: rombel berganti tiap tahun
-- ('2A' hari ini, '2C' tahun depan), tingkatnya tidak.
-- ============================================================

CREATE TABLE IF NOT EXISTS "rapor_templates" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nama"         text NOT NULL,
  "jenjang"      jenjang NOT NULL,
  /* Rentang tingkat kelas yang memakai template ini, inklusif. */
  "tingkat_min"  smallint NOT NULL DEFAULT 1,
  "tingkat_max"  smallint NOT NULL DEFAULT 12,
  /* Berkas .docx asli — arsip, bukan yang dipakai mencetak. */
  "file_path"    text,
  "file_nama"    text,
  /* Hasil terjemahan .docx: lihat lib/rapor/docx.ts. */
  "blok"         jsonb NOT NULL DEFAULT '[]'::jsonb,
  /* slot → kode medan: lihat lib/rapor/medan.ts. */
  "pemetaan"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  /* Teks pengesahan yang sama untuk seluruh rapor unit ini. */
  "tempat_terbit"    text NOT NULL DEFAULT '',
  "nama_koordinator" text NOT NULL DEFAULT '',
  "nip_koordinator"  text NOT NULL DEFAULT '',
  "aktif"        boolean NOT NULL DEFAULT true,
  "dibuat_oleh"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "rapor_templates_tingkat_masuk_akal" CHECK ("tingkat_min" <= "tingkat_max")
);

CREATE INDEX IF NOT EXISTS "rapor_templates_jenjang_idx"
  ON "rapor_templates" ("jenjang", "aktif");

-- ── Isian guru ──────────────────────────────────────────────
--
-- Satu baris per anak per semester. Yang disimpan hanya yang DITULIS GURU:
-- deskripsi naratif, dan timpaan angka bila guru punya pertimbangan lain.
-- Rata-rata nilai, capaian, dan kehadiran TIDAK disimpan di sini — semuanya
-- dihitung ulang dari setoran dan absensi setiap kali rapor dibuka. Menyalin
-- angka ke sini berarti rapor yang dicetak ulang bulan depan memberi angka
-- lama meski setorannya sudah dibetulkan.
--
-- template_id disimpan supaya rapor yang sudah dicetak tahu template mana
-- yang dipakai; mengganti template unit tidak mengubah rapor lama.

CREATE TABLE IF NOT EXISTS "rapor_isian" (
  "student_id"  uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "term_id"     uuid NOT NULL REFERENCES "academic_terms"("id") ON DELETE CASCADE,
  "template_id" uuid REFERENCES "rapor_templates"("id") ON DELETE SET NULL,
  "deskripsi"   text NOT NULL DEFAULT '',
  /* Timpaan per kode medan, mis. {"nilai_tahsin": "90"}. Kosong = pakai hitungan sistem. */
  "timpaan"     jsonb NOT NULL DEFAULT '{}'::jsonb,
  "diisi_oleh"  uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("student_id", "term_id")
);

CREATE INDEX IF NOT EXISTS "rapor_isian_term_idx" ON "rapor_isian" ("term_id");

ALTER TABLE "rapor_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rapor_isian" ENABLE ROW LEVEL SECURITY;
