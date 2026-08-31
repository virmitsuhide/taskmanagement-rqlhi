-- ============================================================
-- Rapor KPI: pengesahan koordinator, penyerahan ke guru, banding
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru  : kpi_rapor_status, kpi_selesai_sebab, kpi_banding_status,
--                  kpi_riwayat_aksi
--   • kpi_monthly: kolom siklus hidup + jejak tanda tangan
--   • users      : signature_path, signature_focus
--   • teachers   : signature_path, signature_focus
--   • tabel baru : kpi_rapor_riwayat, kpi_banding
--
-- ── KENAPA RAPOR PERLU STATUS ───────────────────────────────
--
-- Sampai hari ini kpi_monthly hanya menyimpan angka, jadi tidak ada cara
-- membedakan "SDM masih mengetik" dari "sudah diserahkan kepada guru dan
-- ditandatangani". Seluruh alur pengesahan bergantung pada perbedaan itu.
--
--   draft ──ajukan(SDM)──> diajukan ──terbitkan(koor)──> terbit
--     ^                       │                            │
--     └──kembalikan(koor)─────┘                ┌───────────┴───────────┐
--                                        ttd guru                  banding
--                                             │                        │
--                                          selesai <──putusan ditolak───┤
--                                             ^                        │
--                                             └──diterima → draft (versi+1)
--
-- ── KENAPA BARIS TERBIT DIKUNCI ─────────────────────────────
--
-- Modul ini sengaja menyimpan bahan mentah dan menghitung ulang ke-11
-- indikatornya saat dibaca (lihat drizzle/0034). Bagus untuk pemantauan, tapi
-- mematikan bagi dokumen bertanda tangan: membetulkan late_minutes bulan
-- Agustus di bulan Oktober akan mengubah isi rapor yang SUDAH ditandatangani
-- guru, tanpa jejak apa pun. Tanda tangan di atas angka yang bisa bergerak
-- tidak membuktikan apa-apa.
--
-- Karena itu status >= 'terbit' mengunci barisnya lewat trigger di bawah.
-- Yang bisa membukanya kembali hanya Kepala RQ, lewat reset — dan reset
-- mengosongkan nilainya, membatalkan kedua tanda tangan, serta menaikkan
-- nomor versi, sehingga perubahan atas rapor terbit selalu kasat mata.
--
-- ── KENAPA RESET, BUKAN DELETE ──────────────────────────────
--
-- Kepala RQ "menghapus nilai lalu memasukkan yang baru" dijalankan sebagai
-- pengosongan baris, bukan DELETE. kpi_rapor_riwayat menunjuk ke baris ini
-- dengan ON DELETE CASCADE: menghapus barisnya akan menghapus pula catatan
-- "rapor direset" pada saat catatan itu dibuat — persoalan yang sama yang
-- membuat penghapusan tugas di modul lain dibuat lunak (lihat berkas
-- lib/data/notifications.ts). Dengan reset, id barisnya lestari dan seluruh
-- riwayat versi sebelumnya tetap bisa dibuktikan.

-- ── ENUMS ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE kpi_rapor_status AS ENUM (
    'draft',
    'diajukan',
    'dikembalikan',
    'terbit',
    'banding',
    'selesai'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kenapa rapor menjadi final. Dibedakan karena "guru menandatangani" dan "masa
-- banding habis tanpa guru menanggapi" bukan hal yang sama, dan laporan yang
-- menyebut keduanya "disetujui" mengklaim persetujuan yang tidak pernah
-- diberikan siapa pun.
DO $$ BEGIN
  CREATE TYPE kpi_selesai_sebab AS ENUM (
    'ttd_guru',
    'lewat_tenggat',
    'putusan_final'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kpi_banding_status AS ENUM (
    'diajukan',
    'diterima',
    'diterima_sebagian',
    'ditolak',
    'kedaluwarsa'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kpi_riwayat_aksi AS ENUM (
    'diajukan', 'dikembalikan', 'terbit', 'ttd_guru',
    'banding_diajukan', 'banding_diputus', 'banding_eskalasi',
    'direset', 'final_tenggat'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── kpi_monthly: siklus hidup & tanda tangan ─────────────────

ALTER TABLE "kpi_monthly"
  ADD COLUMN IF NOT EXISTS "status"        kpi_rapor_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "selesai_sebab" kpi_selesai_sebab,
  -- Naik tiap kali rapor terbit ditarik & diterbitkan ulang. Dicetak di lembar
  -- rapor sebagai "Revisi ke-N" supaya guru tahu ia memegang dokumen yang mana.
  ADD COLUMN IF NOT EXISTS "versi"         integer NOT NULL DEFAULT 1,

  ADD COLUMN IF NOT EXISTS "diajukan_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "diajukan_by"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "dikembalikan_alasan" text,

  ADD COLUMN IF NOT EXISTS "terbit_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "terbit_by"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  -- SALINAN gambar TTD koordinator pada saat menandatangani, bukan acuan ke
  -- profilnya. Kalau koordinator mengganti gambar tanda tangannya tahun depan,
  -- acuan akan diam-diam mengubah tanda tangan di SELURUH rapor lama.
  ADD COLUMN IF NOT EXISTS "koor_ttd_path"  text,
  ADD COLUMN IF NOT EXISTS "koor_ttd_focus" jsonb,

  ADD COLUMN IF NOT EXISTS "guru_dibuka_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "guru_ttd_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "guru_ttd_path"  text,
  ADD COLUMN IF NOT EXISTS "guru_ttd_focus" jsonb,

  -- Tenggat guru mengajukan banding; dihitung saat terbit (7 hari kerja).
  -- Lewat tanggal ini rapor menjadi final dengan sendirinya — tanpa tenggat,
  -- nilai satu semester tidak pernah bisa dinyatakan selesai, sebab rapor
  -- bulanan menyusun rapor semester.
  ADD COLUMN IF NOT EXISTS "banding_batas" date,
  ADD COLUMN IF NOT EXISTS "direset_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "direset_by"    uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Daftar publikasi koordinator selalu menyaring unit + periode + status.
CREATE INDEX IF NOT EXISTS "kpi_monthly_status_idx"
  ON "kpi_monthly" ("unit", "year", "month", "status");

-- Portal guru bertanya "rapor saya yang mana yang sudah terbit", tanpa unit.
CREATE INDEX IF NOT EXISTS "kpi_monthly_guru_terbit_idx"
  ON "kpi_monthly" ("teacher_id", "status");

-- ── Gambar tanda tangan di profil ────────────────────────────
--
-- Diunggah SEKALI di halaman profil, bukan tiap bulan. signature_focus
-- menyimpan { x, y, zoom } — bentuk yang sama dengan photo_focus
-- (lib/profil/foto.ts), jadi koordinator menata letak & skala tanda tangannya
-- satu kali dan seluruh rapor berikutnya memakai penataan itu.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "signature_path"   text,
  ADD COLUMN IF NOT EXISTS "signature_focus" jsonb;

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "signature_path"   text,
  ADD COLUMN IF NOT EXISTS "signature_focus" jsonb;

-- ── Riwayat rapor ────────────────────────────────────────────
--
-- Sekaligus sumber notifikasi, mengikuti prinsip lib/data/notifications.ts:
-- pemberitahuan diturunkan dari riwayat, bukan dari tabel notifikasi
-- tersendiri. Konsekuensinya, alur baru yang mencatat riwayat otomatis muncul
-- di lonceng — tidak ada pemicu terpisah yang bisa lupa dipasang.
--
-- actor_user_id & actor_teacher_id keduanya boleh kosong: pelakunya bisa
-- pengurus (SDM, koordinator, Kepala RQ) atau guru, dan keduanya hidup di
-- tabel yang berbeda. Baris 'final_tenggat' tidak punya pelaku sama sekali —
-- yang melakukannya adalah lewatnya waktu.

CREATE TABLE IF NOT EXISTS "kpi_rapor_riwayat" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kpi_monthly_id"   uuid NOT NULL REFERENCES "kpi_monthly"("id") ON DELETE CASCADE,
  "versi"            integer NOT NULL DEFAULT 1,
  "aksi"             kpi_riwayat_aksi NOT NULL,
  "actor_user_id"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "actor_teacher_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
  "catatan"          text,
  "created_at"       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "kpi_rapor_riwayat_rapor_idx"
  ON "kpi_rapor_riwayat" ("kpi_monthly_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "kpi_rapor_riwayat_aksi_idx"
  ON "kpi_rapor_riwayat" ("aksi", "created_at" DESC);

-- ── Banding ──────────────────────────────────────────────────
--
-- items adalah [{ indikator, nilaiTercatat, nilaiDiklaim, alasan }] — banding
-- WAJIB menunjuk indikator tertentu, bukan keberatan atas rapor secara utuh.
-- "Saya keberatan dengan KPI saya" tidak bisa diperiksa siapa pun dan hanya
-- melahirkan perasaan tidak enak di kedua pihak; "tercatat 3 kali izin WA,
-- seharusnya 1, tanggal 12 & 19 saya izin lisan" bisa dicek terhadap sumbernya
-- dalam lima menit. Efek sampingnya berharga: setelah beberapa bulan terlihat
-- indikator mana yang paling sering disanggah — dan indikator yang disanggah 8
-- dari 30 guru menandakan alat ukurnya yang rusak, bukan 8 guru yang membangkang.
--
-- Dua tingkat, dan tingkat kedua bukan pengulangan tingkat pertama:
--   tingkat 1 — sengketa FAKTA, diputus SDM selaku pemegang datanya
--   tingkat 2 — sengketa PENILAIAN, diputus Kepala RQ, final
-- Koordinator sengaja bukan pemutus: dialah yang menandatangani rapor itu,
-- jadi menjadikannya hakim atas sanggahan terhadap tanda tangannya sendiri
-- tidak adil bagi kedua belah pihak.

CREATE TABLE IF NOT EXISTS "kpi_banding" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kpi_monthly_id"  uuid NOT NULL REFERENCES "kpi_monthly"("id") ON DELETE CASCADE,
  "teacher_id"      uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  -- Versi rapor yang disanggah. Rapor yang direvisi lalu terbit ulang adalah
  -- dokumen lain, dan boleh disanggah lagi.
  "versi_rapor"     integer NOT NULL DEFAULT 1,
  "tingkat"         smallint NOT NULL DEFAULT 1,
  -- Banding tingkat 2 adalah ESKALASI banding yang sama, bukan banding baru.
  "induk_id"        uuid REFERENCES "kpi_banding"("id") ON DELETE CASCADE,

  "items"           jsonb NOT NULL DEFAULT '[]'::jsonb,
  "lampiran_url"    text[],
  "status"          kpi_banding_status NOT NULL DEFAULT 'diajukan',
  "diajukan_at"     timestamptz DEFAULT now(),
  -- Tenggat pemutus (5 hari kerja). Tenggat yang hanya mengikat pihak yang
  -- lemah bukan tenggat melainkan alat tekan — jadi yang memutus pun terikat,
  -- dan yang lewat muncul sebagai peringatan di dashboard Kepala RQ.
  "putusan_batas"   date,
  "putusan_oleh"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "putusan_at"      timestamptz,
  -- Wajib terisi saat memutus — ditegakkan trigger di bawah. Putusan tanpa
  -- alasan tertulis adalah penolakan yang tidak bisa dipelajari siapa pun.
  "putusan_alasan"  text,
  -- Diisi guru saat menaikkan perkaranya ke Kepala RQ.
  "eskalasi_alasan" text,
  "created_at"      timestamptz DEFAULT now()
);

-- Satu banding per (rapor, versi, tingkat). Tanpa ini seorang guru bisa
-- mengajukan banding kesembilan atas rapor yang sama, dan tidak ada seorang
-- pun yang punya dasar untuk menghentikannya.
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_banding_sekali_per_versi"
  ON "kpi_banding" ("kpi_monthly_id", "versi_rapor", "tingkat");

CREATE INDEX IF NOT EXISTS "kpi_banding_status_idx"
  ON "kpi_banding" ("status", "putusan_batas");
CREATE INDEX IF NOT EXISTS "kpi_banding_guru_idx"
  ON "kpi_banding" ("teacher_id", "diajukan_at" DESC);

-- ── Penjagaan di tingkat database ────────────────────────────
--
-- Aturan yang sama sudah ditegakkan di server action, dan ini lapis kedua.
-- Alasannya bukan ketidakpercayaan pada action-nya, melainkan bahwa modul KPI
-- disentuh juga oleh skrip (scripts/uji-kpi.ts, seed) dan oleh SQL Editor
-- Supabase — jalur yang tidak melewati satu pun action.

CREATE OR REPLACE FUNCTION kpi_monthly_jaga_terbit() RETURNS trigger AS $fn$
BEGIN
  -- Nilai rapor yang sudah terbit tidak boleh berubah diam-diam. Yang masih
  -- boleh bergerak hanyalah kolom alurnya (status, tanda tangan, tenggat);
  -- perubahan angkanya harus lewat reset oleh Kepala RQ, yang mengembalikan
  -- statusnya ke 'draft' lebih dulu.
  IF OLD.status IN ('terbit', 'banding', 'selesai')
     AND NEW.status = OLD.status
     AND (
       NEW.late_minutes IS DISTINCT FROM OLD.late_minutes OR
       NEW.db_late_days IS DISTINCT FROM OLD.db_late_days OR
       NEW.hafalan_juz IS DISTINCT FROM OLD.hafalan_juz OR
       NEW.hafalan_pages IS DISTINCT FROM OLD.hafalan_pages OR
       NEW.tuhfatul_bait IS DISTINCT FROM OLD.tuhfatul_bait OR
       NEW.bacaan_score IS DISTINCT FROM OLD.bacaan_score OR
       NEW.buku_pegangan_meetings IS DISTINCT FROM OLD.buku_pegangan_meetings OR
       NEW.izin_wa_cases IS DISTINCT FROM OLD.izin_wa_cases OR
       NEW.pengganti_cases IS DISTINCT FROM OLD.pengganti_cases OR
       NEW.pengganti_found IS DISTINCT FROM OLD.pengganti_found OR
       NEW.seragam_daily IS DISTINCT FROM OLD.seragam_daily OR
       NEW.lapor_ortu_daily IS DISTINCT FROM OLD.lapor_ortu_daily OR
       NEW.halaqoh_hadir IS DISTINCT FROM OLD.halaqoh_hadir OR
       NEW.halaqoh_akhiri IS DISTINCT FROM OLD.halaqoh_akhiri OR
       NEW.seragam_total IS DISTINCT FROM OLD.seragam_total OR
       NEW.lapor_ortu_total IS DISTINCT FROM OLD.lapor_ortu_total OR
       NEW.halaqoh_total IS DISTINCT FROM OLD.halaqoh_total OR
       NEW.apresiasi IS DISTINCT FROM OLD.apresiasi OR
       NEW.pengembangan IS DISTINCT FROM OLD.pengembangan OR
       NEW.unit IS DISTINCT FROM OLD.unit
     )
  THEN
    RAISE EXCEPTION 'Rapor KPI berstatus % terkunci. Kepala RQ harus mereset rapor ini lebih dulu.', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "kpi_monthly_jaga_terbit_trg" ON "kpi_monthly";
CREATE TRIGGER "kpi_monthly_jaga_terbit_trg"
  BEFORE UPDATE ON "kpi_monthly"
  FOR EACH ROW EXECUTE FUNCTION kpi_monthly_jaga_terbit();

CREATE OR REPLACE FUNCTION kpi_banding_jaga_putusan() RETURNS trigger AS $fn$
BEGIN
  IF NEW.status IN ('diterima', 'diterima_sebagian', 'ditolak')
     AND (NEW.putusan_alasan IS NULL OR btrim(NEW.putusan_alasan) = '')
  THEN
    RAISE EXCEPTION 'Putusan banding wajib disertai alasan tertulis.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.tingkat NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Banding hanya mengenal dua tingkat.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "kpi_banding_jaga_putusan_trg" ON "kpi_banding";
CREATE TRIGGER "kpi_banding_jaga_putusan_trg"
  BEFORE INSERT OR UPDATE ON "kpi_banding"
  FOR EACH ROW EXECUTE FUNCTION kpi_banding_jaga_putusan();

-- ── Data lama ────────────────────────────────────────────────
--
-- Seluruh baris yang sudah ada tetap berstatus 'draft'. Sengaja: rapor
-- bulan-bulan lalu memang belum pernah melewati pengesahan koordinator, dan
-- menandainya 'selesai' akan mengarang persetujuan guru yang tidak pernah ada.
