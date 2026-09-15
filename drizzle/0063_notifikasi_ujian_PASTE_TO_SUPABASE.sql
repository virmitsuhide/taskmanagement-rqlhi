-- ============================================================
-- Notifikasi ujian — guru ↔ koordinator unit
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • ujian_tahfidz, ujian_tahsin : + dijadwalkan_at, + selesai_at
--                                   + trigger pengisi keduanya
--   • teachers                    : + ujian_notif_seen_at
--
-- ── KENAPA DITURUNKAN DARI BARIS UJIAN, BUKAN TABEL NOTIFIKASI ─
--
-- Lonceng pengurus sudah membaca task_history alih-alih tabel notifikasi
-- sendiri, dan alasannya berlaku sama di sini: tabel notifikasi harus diisi
-- oleh setiap jalur yang mengubah status, dan jalur yang lupa mengisinya
-- membuat notifikasinya diam-diam tidak pernah sampai.
--
-- Pengajuan baru sudah punya created_at. Yang belum ada hanyalah KAPAN ujian
-- dijadwalkan dan KAPAN selesai — updated_at tidak bisa dipakai, sebab ralat
-- catatan atau predikat juga menggesernya dan guru akan diberi tahu ulang
-- untuk ujian yang sama. Keduanya diisi trigger, jadi server action mana pun
-- yang mengubah status tidak perlu ingat melakukannya.
--
-- ── ATURAN TRIGGER ──────────────────────────────────────────
--
--   • status → 'dijadwalkan', atau jadwalnya diubah selama masih dijadwalkan
--     → dijadwalkan_at = now()   (penjadwalan ulang memang perlu diberitahukan)
--   • status → 'selesai'         → selesai_at = now()
--   • status mundur              → cap waktu tahap di depannya dikosongkan
-- ============================================================

-- 1) Kolom cap waktu
ALTER TABLE "ujian_tahfidz"
  ADD COLUMN IF NOT EXISTS "dijadwalkan_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "selesai_at"     timestamptz;

ALTER TABLE "ujian_tahsin"
  ADD COLUMN IF NOT EXISTS "dijadwalkan_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "selesai_at"     timestamptz;

-- 2) Trigger pengisi
CREATE OR REPLACE FUNCTION ujian_catat_waktu_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'diajukan' THEN
    NEW.dijadwalkan_at := NULL;
    NEW.selesai_at     := NULL;
  ELSIF NEW.status = 'dijadwalkan' THEN
    NEW.selesai_at := NULL;
    IF TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'dijadwalkan'
       OR NEW.jadwal IS DISTINCT FROM OLD.jadwal THEN
      NEW.dijadwalkan_at := now();
    END IF;
  ELSIF NEW.status = 'selesai' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'selesai' THEN
      NEW.selesai_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ujian_tahfidz_waktu_status ON ujian_tahfidz;
CREATE TRIGGER ujian_tahfidz_waktu_status
  BEFORE INSERT OR UPDATE ON ujian_tahfidz
  FOR EACH ROW EXECUTE FUNCTION ujian_catat_waktu_status();

DROP TRIGGER IF EXISTS ujian_tahsin_waktu_status ON ujian_tahsin;
CREATE TRIGGER ujian_tahsin_waktu_status
  BEFORE INSERT OR UPDATE ON ujian_tahsin
  FOR EACH ROW EXECUTE FUNCTION ujian_catat_waktu_status();

-- 3) Isi data lama. updated_at adalah tebakan terbaik yang tersedia; tidak
--    menimbulkan notifikasi karena penanda guru di langkah 4 diset ke now().
--    Kolom trigger dimatikan sementara supaya pengisian ini tidak ditimpa.
ALTER TABLE ujian_tahfidz DISABLE TRIGGER ujian_tahfidz_waktu_status;
ALTER TABLE ujian_tahsin  DISABLE TRIGGER ujian_tahsin_waktu_status;
ALTER TABLE ujian_tahfidz DISABLE TRIGGER ujian_tahfidz_updated_at;
ALTER TABLE ujian_tahsin  DISABLE TRIGGER ujian_tahsin_updated_at;

UPDATE ujian_tahfidz SET dijadwalkan_at = updated_at
 WHERE status IN ('dijadwalkan', 'selesai') AND dijadwalkan_at IS NULL;
UPDATE ujian_tahfidz SET selesai_at = updated_at
 WHERE status = 'selesai' AND selesai_at IS NULL;
UPDATE ujian_tahsin SET dijadwalkan_at = updated_at
 WHERE status IN ('dijadwalkan', 'selesai') AND dijadwalkan_at IS NULL;
UPDATE ujian_tahsin SET selesai_at = updated_at
 WHERE status = 'selesai' AND selesai_at IS NULL;

ALTER TABLE ujian_tahfidz ENABLE TRIGGER ujian_tahfidz_waktu_status;
ALTER TABLE ujian_tahsin  ENABLE TRIGGER ujian_tahsin_waktu_status;
ALTER TABLE ujian_tahfidz ENABLE TRIGGER ujian_tahfidz_updated_at;
ALTER TABLE ujian_tahsin  ENABLE TRIGGER ujian_tahsin_updated_at;

-- 4) Penanda "sudah dilihat" untuk guru. Diset ke saat migrasi supaya
--    riwayat lama tidak muncul sebagai puluhan notifikasi baru.
ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "ujian_notif_seen_at" timestamptz;
UPDATE "teachers" SET "ujian_notif_seen_at" = now() WHERE "ujian_notif_seen_at" IS NULL;

-- 5) Pola baca: pengajuan milik seorang guru
CREATE INDEX IF NOT EXISTS ujian_tahfidz_pengaju_guru_idx ON ujian_tahfidz (created_by_teacher);
CREATE INDEX IF NOT EXISTS ujian_tahsin_pengaju_guru_idx  ON ujian_tahsin  (created_by_teacher);

-- Verifikasi (opsional):
-- SELECT status, count(*), count(dijadwalkan_at), count(selesai_at) FROM ujian_tahfidz GROUP BY 1;
