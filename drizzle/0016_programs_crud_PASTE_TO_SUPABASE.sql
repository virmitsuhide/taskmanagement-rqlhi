-- ============================================================
-- Program RQ jadi data (CRUD), bukan daftar hardcode
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • tabel baru  : programs
--   • bucket baru : program-images (publik, untuk foto program)
--   • migrasi isi : 7 program yang sebelumnya hardcode di app/program/_data.ts
--     dipindah ke tabel, lengkap dengan konten lama dari program_details.
--
-- Kenapa icon & accent disimpan sebagai KUNCI (mis. 'BookOpen', 'emerald'),
-- bukan nama kelas Tailwind: Tailwind memangkas kelas yang tidak muncul
-- literal di kode. Kelas lengkapnya dipetakan di lib/programs/theme.ts.
--
-- Tabel program_details LAMA sengaja tidak di-drop supaya bisa dibandingkan
-- dulu. Setelah yakin datanya pindah, jalankan manual:
--   DROP TABLE IF EXISTS program_details;
-- ============================================================

CREATE TABLE IF NOT EXISTS programs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text UNIQUE NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  photo_url        text,
  icon             text NOT NULL DEFAULT 'BookOpen',
  accent           text NOT NULL DEFAULT 'emerald',
  long_description text NOT NULL DEFAULT '',
  curriculum       text NOT NULL DEFAULT '',
  schedule         text NOT NULL DEFAULT '',
  target_audience  text NOT NULL DEFAULT '',
  contact_info     text NOT NULL DEFAULT '',
  display_order    integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  updated_by       uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS programs_order_idx ON programs (display_order, created_at);

-- ── Pindahkan 7 program lama ────────────────────────────────
-- ON CONFLICT DO NOTHING supaya menjalankan ulang tidak menimpa
-- perubahan yang sudah dibuat Humas lewat panel kelola.
INSERT INTO programs (slug, title, description, icon, accent, display_order)
VALUES
  ('tahsin-ummi',      'Tahsin Metode UMMI',           'Program tahsin Al-Qur''an menggunakan metode UMMI yang terstruktur dan terarah untuk semua usia', 'BookOpen',      'emerald', 1),
  ('tahsin-syajaroh',  'Tahsin Metode Syajaroh',       'Program tahsin Al-Qur''an dengan pendekatan metode Syajaroh yang holistik dan komprehensif',      'Layers',        'teal',    2),
  ('labschool',        'Qur''anic Labschool',          'Program unggulan berbasis Al-Qur''an untuk jenjang SD dan SMP dengan kurikulum terintegrasi',     'GraduationCap', 'blue',    3),
  ('ekstra-rq',        'Ekstra RQ',                    'Kegiatan ekstrakurikuler berbasis Rumah Qur''an untuk pengembangan potensi dan bakat diri',       'Zap',           'violet',  4),
  ('pembinaan-guru',   'Pembinaan Guru SIT LHI',       'Program pembinaan dan pengembangan kompetensi tenaga pengajar SIT LHI',                           'Users',         'amber',   5),
  ('karyawan',         'Pembinaan Karyawan SIT LHI',   'Program pengembangan dan pemberdayaan karyawan SIT LHI',                                          'Briefcase',     'sky',     6),
  ('guru-quran',       'Pembinaan Guru Qur''an',       'Program khusus peningkatan kualitas dan kapasitas Guru Qur''an Rumah Qur''an LHI',                'Star',          'rose',    7)
ON CONFLICT (slug) DO NOTHING;

-- ── Tarik konten lama dari program_details ──────────────────
-- Hanya mengisi kolom yang masih kosong, jadi aman diulang.
UPDATE programs p
SET
  long_description = COALESCE(NULLIF(d.long_description, ''), p.long_description),
  curriculum       = COALESCE(NULLIF(d.curriculum, ''),       p.curriculum),
  schedule         = COALESCE(NULLIF(d.schedule, ''),         p.schedule),
  target_audience  = COALESCE(NULLIF(d.target_audience, ''),  p.target_audience),
  contact_info     = COALESCE(NULLIF(d.contact_info, ''),     p.contact_info)
FROM program_details d
WHERE d.slug = p.slug
  AND p.long_description = ''
  AND p.curriculum = ''
  AND p.schedule = ''
  AND p.target_audience = ''
  AND p.contact_info = '';

-- ── Bucket foto program ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('program-images', 'program-images', true)
ON CONFLICT (id) DO NOTHING;

-- Baca publik untuk bucket ini (upload tetap lewat service role dari server).
DROP POLICY IF EXISTS "program images public read" ON storage.objects;
CREATE POLICY "program images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'program-images');

-- Verifikasi (opsional):
-- SELECT slug, title, display_order, is_active FROM programs ORDER BY display_order;
