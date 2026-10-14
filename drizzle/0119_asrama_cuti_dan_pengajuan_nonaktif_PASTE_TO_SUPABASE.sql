-- ============================================================
-- Halaqoh Asrama — cuti/sakit & pengajuan nonaktif ke Koor SMP
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- 1. Cuti / sakit sementara (langsung, tanpa persetujuan)
--    Div Qur'an BPA/BPI menandai anak yang sakit berkepanjangan atau cuti
--    keluarga. Anak TETAP di kelompoknya; hanya diberi tanda. Kolom baru di
--    asrama_anggota:
--      cuti_jenis   'sakit' | 'cuti'   (kosong = tidak sedang cuti)
--      cuti_sejak, cuti_kembali (perkiraan, boleh kosong), cuti_catatan
--
-- 2. Pengajuan nonaktif dari asrama → diverifikasi Koor SMP
--    Alasan: pindah ke fullday, pindah sekolah, atau lainnya. Selama
--    menunggu, anak tetap di kelompok dan tetap bisa disetorkan. Koor SMP
--    mengonfirmasi ke kesiswaan SMP lalu menyetujui/menolak (tolak wajib
--    bercatatan). Bila disetujui, pada tanggal efektif:
--      fullday         → program siswa diganti (dan huruf rombel A/B → C/D),
--                        keluar dari kelompok asrama;
--      pindah_sekolah  → siswa dinonaktifkan (students.is_active = false);
--      lainnya         → hanya keluar dari kelompok asrama.
--    `diterapkan_at` terisi saat perubahan itu benar-benar dijalankan.
--
-- Aplikasi tetap berjalan sebelum file ini dijalankan: tombol cuti dan
-- pengajuan memberi pesan bahwa migrasi belum dipasang.
-- ============================================================

BEGIN;

ALTER TABLE "asrama_anggota" ADD COLUMN IF NOT EXISTS "cuti_jenis"   text;
ALTER TABLE "asrama_anggota" ADD COLUMN IF NOT EXISTS "cuti_sejak"   date;
ALTER TABLE "asrama_anggota" ADD COLUMN IF NOT EXISTS "cuti_kembali" date;
ALTER TABLE "asrama_anggota" ADD COLUMN IF NOT EXISTS "cuti_catatan" text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asrama_anggota_cuti_jenis_check') THEN
    ALTER TABLE "asrama_anggota" ADD CONSTRAINT "asrama_anggota_cuti_jenis_check"
      CHECK ("cuti_jenis" IS NULL OR "cuti_jenis" IN ('sakit', 'cuti'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "asrama_pengajuan_nonaktif" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id"         uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  -- Kelompok saat diajukan; nama & gender disalin supaya riwayat tetap
  -- terbaca setelah anak keluar atau kelompoknya dihapus.
  "kelompok_id"        uuid REFERENCES "asrama_kelompok"("id") ON DELETE SET NULL,
  "kelompok_nama"      text,
  "gender"             text NOT NULL CHECK ("gender" IN ('L', 'P')),
  "alasan"             text NOT NULL CHECK ("alasan" IN ('fullday', 'pindah_sekolah', 'lainnya')),
  "tanggal_efektif"    date NOT NULL,
  "catatan"            text,
  "status"             text NOT NULL DEFAULT 'menunggu'
                       CHECK ("status" IN ('menunggu', 'disetujui', 'ditolak', 'dibatalkan')),
  "diajukan_oleh"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "diajukan_at"        timestamptz NOT NULL DEFAULT now(),
  "diputuskan_oleh"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "diputuskan_at"      timestamptz,
  "catatan_verifikasi" text,
  -- Khusus pindah ke fullday: program & kelas tujuan yang dipilih Koor SMP.
  "program_baru"       text,
  "kelas_baru"         text,
  "diterapkan_at"      timestamptz
);

-- Satu pengajuan yang masih menunggu per anak.
CREATE UNIQUE INDEX IF NOT EXISTS "asrama_pengajuan_menunggu_unik"
  ON "asrama_pengajuan_nonaktif" ("student_id") WHERE "status" = 'menunggu';
CREATE INDEX IF NOT EXISTS "asrama_pengajuan_status_idx"
  ON "asrama_pengajuan_nonaktif" ("status", "diajukan_at" DESC);

ALTER TABLE "asrama_pengajuan_nonaktif" ENABLE ROW LEVEL SECURITY;

COMMIT;

NOTIFY pgrst, 'reload schema';
