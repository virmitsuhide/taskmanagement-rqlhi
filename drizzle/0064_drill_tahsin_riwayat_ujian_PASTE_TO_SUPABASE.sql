-- ============================================================
-- Drill tahsin + riwayat ujian lama
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • students     : + tahsin_drill_sejak
--   • tahsin_logs  : + drill
--   • trigger ujian_catat_waktu_status (0063): cap waktu yang dikirim saat
--     INSERT tidak lagi ditimpa now()
--
-- ── DRILL ───────────────────────────────────────────────────
--
-- Anak yang lulus halaman TERAKHIR jilidnya belum naik jilid. Ia masuk masa
-- drill: mengulang-ulang jilid itu sampai lulus ujian tahsin. Kenaikan jilid
-- kini hanya lewat ujian (lihat terapkanKelulusanTahsin) — centang "naik
-- jilid" di setoran harian dihapus.
--
-- tahsin_drill_sejak diisi tanggal setoran yang membuatnya masuk drill, dan
-- dikosongkan saat ujian tahsinnya lulus. Disimpan sebagai tanggal, bukan
-- boolean, supaya manajemen bisa melihat anak mana yang terlalu lama
-- tertahan menunggu ujian.
--
-- Tidak ada pengisian data lama: 32 anak SD yang posisinya tepat di halaman
-- terakhir belum tentu sudah LULUS halaman itu, dan menandainya drill akan
-- mengunci jilid mereka atas tebakan.
--
-- tahsin_logs.drill menandai setoran yang dicatat selama masa drill — supaya
-- rekap bisa membedakan latihan drill dari kemajuan halaman.
--
-- ── RIWAYAT UJIAN LAMA ──────────────────────────────────────
--
-- Koordinator kini bisa mencatat tasmi'/juz'iyyah yang terjadi sebelum
-- sistem dipakai, langsung berstatus 'selesai'. Cap waktunya harus tanggal
-- ujian yang sebenarnya; kalau trigger menimpanya dengan now(), guru akan
-- menerima notifikasi "ujian selesai" untuk ujian berbulan-bulan lalu.
-- ============================================================

-- 1) Drill
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "tahsin_drill_sejak" date;

ALTER TABLE "tahsin_logs"
  ADD COLUMN IF NOT EXISTS "drill" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS students_tahsin_drill_idx
  ON students (tahsin_drill_sejak) WHERE tahsin_drill_sejak IS NOT NULL;

-- 2) Trigger: hormati cap waktu yang dikirim saat INSERT
CREATE OR REPLACE FUNCTION ujian_catat_waktu_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'diajukan' THEN
    NEW.dijadwalkan_at := NULL;
    NEW.selesai_at     := NULL;
  ELSIF NEW.status = 'dijadwalkan' THEN
    NEW.selesai_at := NULL;
    IF TG_OP = 'INSERT' THEN
      NEW.dijadwalkan_at := COALESCE(NEW.dijadwalkan_at, now());
    ELSIF OLD.status IS DISTINCT FROM 'dijadwalkan'
       OR NEW.jadwal IS DISTINCT FROM OLD.jadwal THEN
      NEW.dijadwalkan_at := now();
    END IF;
  ELSIF NEW.status = 'selesai' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.selesai_at := COALESCE(NEW.selesai_at, now());
    ELSIF OLD.status IS DISTINCT FROM 'selesai' THEN
      NEW.selesai_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verifikasi (opsional):
-- SELECT column_name FROM information_schema.columns
--  WHERE (table_name='students' AND column_name='tahsin_drill_sejak')
--     OR (table_name='tahsin_logs' AND column_name='drill');
