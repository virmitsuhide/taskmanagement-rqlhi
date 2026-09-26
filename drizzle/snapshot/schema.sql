-- Snapshot skema database RQ LHI — DIBUAT OTOMATIS, jangan disunting tangan.
-- Perbarui dengan: npm run db:snapshot  (lihat scripts/snapshot-skema.ts)
-- Sumber: Postgres 17.6 (Supabase production), skema public + storage buatan aplikasi.
--
-- Membangun ulang: jalankan berkas ini pada database Postgres/Supabase KOSONG,
-- lalu isi data acuan dengan scripts/seed-*.ts. Jangan jalankan pada database
-- yang sudah berisi — CREATE di bawah akan gagal pada objek yang sudah ada.

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ─── Ekstensi ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ─── Enum ──────────────────────────────────────────────────────────────────

CREATE TYPE public.absensi_status AS ENUM ('hadir', 'izin', 'sakit', 'alfa');
CREATE TYPE public.academic_semester AS ENUM ('ganjil', 'genap');
CREATE TYPE public.agenda_tag AS ENUM ('keputusan', 'informasi', 'perlu_diskusi', 'tindak_lanjut', 'approval');
CREATE TYPE public.content_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.content_request_type AS ENUM ('flyer_ujian', 'flyer_lain', 'video', 'lain_lain');
CREATE TYPE public.content_status AS ENUM ('requested', 'on_process', 'finish');
CREATE TYPE public.finance_account_kind AS ENUM ('pemasukan', 'pengeluaran');
CREATE TYPE public.finance_payment_status AS ENUM ('lunas', 'piutang');
CREATE TYPE public.gender AS ENUM ('L', 'P');
CREATE TYPE public.gukar_kind AS ENUM ('guru', 'karyawan');
CREATE TYPE public.gukar_status_pegawai AS ENUM ('tetap', 'calon_tetap', 'kontrak');
CREATE TYPE public.jenjang AS ENUM ('paud', 'sd', 'smp', 'sma', 'sd_juara');
CREATE TYPE public.kategori_guru AS ENUM ('guru_rq', 'guru_quls_sd', 'musyrif_smp', 'guru_unit_lain');
CREATE TYPE public.kpi_banding_status AS ENUM ('diajukan', 'diterima', 'diterima_sebagian', 'ditolak', 'kedaluwarsa');
CREATE TYPE public.kpi_rapor_status AS ENUM ('draft', 'diajukan', 'dikembalikan', 'terbit', 'banding', 'selesai');
CREATE TYPE public.kpi_riwayat_aksi AS ENUM ('diajukan', 'dikembalikan', 'terbit', 'ttd_guru', 'banding_diajukan', 'banding_diputus', 'banding_eskalasi', 'direset', 'final_tenggat');
CREATE TYPE public.kpi_selesai_sebab AS ENUM ('ttd_guru', 'lewat_tenggat', 'putusan_final');
CREATE TYPE public.lingkup_penugasan AS ENUM ('unit', 'yayasan');
CREATE TYPE public.materi_hasil AS ENUM ('ulang', 'lanjut', 'lulus');
CREATE TYPE public.meeting_type AS ENUM ('manajemen', 'kumik', 'new_squad', 'koor_sd', 'koor_smp', 'koor_x_sd', 'koor_x_smp', 'koor_x_boarding', 'rq_x_quls', 'humas_yayasan', 'tahsin_rekomendasi', 'quls_sd');
CREATE TYPE public.post_icon AS ENUM ('info', 'pengumuman', 'pengingat', 'tugas');
CREATE TYPE public.post_priority AS ENUM ('penting', 'info', 'pengingat');
CREATE TYPE public.public_post_type AS ENUM ('pengumuman', 'tugas_guru');
CREATE TYPE public.public_target AS ENUM ('all', 'sd', 'smp');
CREATE TYPE public.routine_cadence AS ENUM ('pekanan', 'bulanan', 'semesteran', 'tahunan');
CREATE TYPE public.routine_outcome AS ENUM ('terlaksana', 'tidak_terlaksana');
CREATE TYPE public.subtask_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.tahfidz_kind AS ENUM ('hafalan_baru', 'murojaah', 'ziyadah', 'murojaah_baru', 'murojaah_lama', 'tasmi');
CREATE TYPE public.tahsin_status AS ENUM ('lulus', 'ulang');
CREATE TYPE public.task_history_action AS ENUM ('status', 'edited', 'deleted', 'restored', 'dependency_added', 'dependency_removed');
CREATE TYPE public.task_horizon AS ENUM ('pendek', 'panjang');
CREATE TYPE public.task_priority AS ENUM ('low', 'middle', 'high');
CREATE TYPE public.task_problem_type AS ENUM ('bottleneck', 'blocked', 'wip_limit', 'others');
CREATE TYPE public.task_source AS ENUM ('rapat', 'mandiri', 'home_publik', 'humas_request');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'problem', 'submitted', 'done', 'returned');
CREATE TYPE public.task_weight AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.teacher_employment AS ENUM ('tetap_yayasan', 'kontrak_yayasan', 'kontrak_rq');
CREATE TYPE public.user_role AS ENUM ('kepala_rq', 'kumik', 'sdm', 'bendahara', 'koor_ekstra', 'koor_sd', 'koor_smp', 'humas', 'div_training', 'new_squad', 'koor_qulssd', 'div_quran_bpa', 'div_quran_bpi', 'admin');

-- ─── Sequence ──────────────────────────────────────────────────────────────

CREATE SEQUENCE public.drizzle_migrations_id_seq START 1 INCREMENT 1;

-- ─── Fungsi ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.juz_dari_ayat(p_surat integer, p_ayat integer)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT juz FROM batas_juz
   WHERE (mulai_surat, mulai_ayat) <= (p_surat, p_ayat)
   ORDER BY juz DESC LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.kpi_banding_jaga_putusan()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.kpi_monthly_jaga_terbit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.ujian_catat_waktu_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_juz_progress_from_tahfidz()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.kind NOT IN ('ziyadah', 'hafalan_baru') OR NEW.ayat_dari IS NULL OR NEW.ayat_ke IS NULL THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT b.juz,
           GREATEST(NEW.ayat_dari, CASE WHEN b.mulai_surat = NEW.surat_id THEN b.mulai_ayat ELSE 1 END) AS dari,
           LEAST(NEW.ayat_ke, CASE WHEN b.selesai_surat = NEW.surat_id THEN b.selesai_ayat ELSE NEW.ayat_ke END) AS ke
      FROM batas_juz b
     WHERE (b.mulai_surat, b.mulai_ayat) <= (NEW.surat_id, NEW.ayat_ke)
       AND (b.selesai_surat, b.selesai_ayat) >= (NEW.surat_id, NEW.ayat_dari)
  LOOP
    IF r.ke >= r.dari THEN
      INSERT INTO juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
      VALUES (NEW.student_id, r.juz, r.ke - r.dari + 1, now(), now())
      ON CONFLICT (student_id, juz_number)
      DO UPDATE SET
        ayat_hafal      = juz_progress.ayat_hafal + EXCLUDED.ayat_hafal,
        last_setoran_at = EXCLUDED.last_setoran_at,
        updated_at      = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;


-- ─── Tabel ─────────────────────────────────────────────────────────────────

CREATE TABLE public.about_rq (
  id smallint DEFAULT 1 NOT NULL,
  vision text DEFAULT ''::text NOT NULL,
  mission text DEFAULT ''::text NOT NULL,
  history text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);

CREATE TABLE public.absensi_harian (
  student_id uuid NOT NULL,
  tanggal date NOT NULL,
  halaqoh_id uuid NOT NULL,
  status absensi_status NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  dicatat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.academic_terms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year_label text NOT NULL,
  semester academic_semester NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  kenaikan_at timestamp with time zone
);

CREATE TABLE public.agenda_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  meeting_id uuid,
  order_num integer NOT NULL,
  tag agenda_tag NOT NULL,
  discussion text NOT NULL,
  follow_up text,
  created_at timestamp with time zone DEFAULT now(),
  butuh_biaya boolean DEFAULT false NOT NULL,
  approval_status text,
  approval_by uuid,
  approval_at timestamp with time zone,
  biaya integer,
  biaya_catatan text,
  biaya_by uuid,
  biaya_at timestamp with time zone,
  selesai_by uuid,
  selesai_at timestamp with time zone,
  diarsipkan_by uuid,
  diarsipkan_at timestamp with time zone
);

CREATE TABLE public.batas_juz (
  juz smallint NOT NULL,
  mulai_surat smallint NOT NULL,
  mulai_ayat smallint NOT NULL,
  selesai_surat smallint NOT NULL,
  selesai_ayat smallint NOT NULL
);

CREATE TABLE public.content_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  request_type content_request_type NOT NULL,
  description text NOT NULL,
  requested_by uuid,
  requested_date date NOT NULL,
  priority content_priority,
  status content_status DEFAULT 'requested'::content_status,
  finished_by uuid,
  finished_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  task_id uuid
);

CREATE TABLE public.drizzle_migrations (
  id integer DEFAULT nextval('drizzle_migrations_id_seq'::regclass) NOT NULL,
  tag text NOT NULL,
  applied_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ekstra_booking (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slot_id uuid NOT NULL,
  slot_tawaran_id uuid,
  status text DEFAULT 'baru'::text NOT NULL,
  nama_anak text NOT NULL,
  asal text DEFAULT 'lhi'::text NOT NULL,
  student_id uuid,
  kelas text DEFAULT ''::text NOT NULL,
  posisi_bacaan text DEFAULT ''::text NOT NULL,
  nama_ortu text NOT NULL,
  wa_ortu text NOT NULL,
  catatan_ortu text DEFAULT ''::text NOT NULL,
  catatan_koor text DEFAULT ''::text NOT NULL,
  ditangani_oleh uuid,
  ditangani_at timestamp with time zone,
  mulai date,
  berhenti date,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ekstra_hadir (
  booking_id uuid NOT NULL,
  tanggal date NOT NULL,
  status absensi_status NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  dicatat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ekstra_jenis (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nama text NOT NULL,
  bidang text DEFAULT 'tahsin'::text NOT NULL,
  deskripsi text DEFAULT ''::text NOT NULL,
  biaya integer DEFAULT 0 NOT NULL,
  satuan_biaya text DEFAULT 'per bulan'::text NOT NULL,
  kuota smallint DEFAULT 1 NOT NULL,
  durasi_menit smallint DEFAULT 60 NOT NULL,
  keterangan_waktu text DEFAULT ''::text NOT NULL,
  aktif boolean DEFAULT true NOT NULL,
  urutan smallint DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ekstra_slot (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jenis_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  hari smallint NOT NULL,
  jam_mulai time without time zone NOT NULL,
  jam_selesai time without time zone NOT NULL,
  tempat text DEFAULT ''::text NOT NULL,
  kuota smallint,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  jabatan text,
  nip text,
  email text,
  phone text,
  photo_url text,
  photo_focus jsonb,
  is_active boolean DEFAULT true,
  can_change_password boolean DEFAULT true,
  employment_type teacher_employment,
  joined_at date,
  contract_start date,
  contract_end date,
  deleted_at timestamp with time zone,
  sapaan text,
  nickname text,
  birth_place text,
  birth_date date,
  education_level text,
  education_history jsonb,
  quran_competencies jsonb,
  other_competencies jsonb,
  ijazah_sanad text[],
  trainings jsonb,
  amanah_history jsonb,
  awards jsonb,
  linked_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kind finance_account_kind NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  hint text DEFAULT ''::text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_budgets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  period date NOT NULL,
  amount integer DEFAULT 0 NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_funding (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  source_slug text NOT NULL,
  amount integer NOT NULL
);

CREATE TABLE public.finance_program_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  period date NOT NULL,
  name text NOT NULL,
  funding_source text DEFAULT ''::text NOT NULL,
  amount integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_report_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  period date NOT NULL,
  section text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  period date NOT NULL,
  amount integer NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  status finance_payment_status DEFAULT 'lunas'::finance_payment_status NOT NULL,
  paid_at date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_trust_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  fund_id uuid NOT NULL,
  entry_date date NOT NULL,
  description text NOT NULL,
  amount integer NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_trust_funds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  opening_balance integer DEFAULT 0 NOT NULL,
  opening_date date DEFAULT '2026-01-01'::date NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gukar_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  term_id uuid NOT NULL,
  name text NOT NULL,
  pengampu_id uuid,
  unit text DEFAULT ''::text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gukar_monthly (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  participant_id uuid NOT NULL,
  period date NOT NULL,
  capaian_tahsin text DEFAULT ''::text NOT NULL,
  capaian_tahfidz text DEFAULT ''::text NOT NULL,
  hadir_1 boolean DEFAULT false NOT NULL,
  hadir_2 boolean DEFAULT false NOT NULL,
  hadir_3 boolean DEFAULT false NOT NULL,
  hadir_4 boolean DEFAULT false NOT NULL,
  hadir_5 boolean DEFAULT false NOT NULL,
  jumlah_halaman integer DEFAULT 0 NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tahap_tahsin text DEFAULT ''::text NOT NULL,
  juz_tuntas smallint,
  juz_berjalan smallint,
  nilai_tahfidz smallint,
  surat_pilihan smallint DEFAULT 0 NOT NULL,
  jilid_id uuid,
  halaman smallint,
  tahsin_surat smallint,
  tahsin_ayat smallint,
  tahfidz_surat smallint,
  tahfidz_ayat smallint,
  setoran_tahsin_halaman integer DEFAULT 0 NOT NULL,
  setoran_tahfidz_halaman integer DEFAULT 0 NOT NULL,
  awal_jilid_id uuid,
  awal_halaman smallint,
  awal_tahsin_surat smallint,
  awal_tahsin_ayat smallint,
  awal_tahfidz_surat smallint,
  awal_tahfidz_ayat smallint,
  awal_tanggal date,
  setoran_terakhir date,
  jumlah_setoran smallint DEFAULT 0 NOT NULL,
  dikunci_at timestamp with time zone,
  jumlah_hadir smallint,
  jumlah_siklus smallint
);

CREATE TABLE public.gukar_participants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  full_name text NOT NULL,
  unit text DEFAULT ''::text NOT NULL,
  kind gukar_kind,
  level_awal text DEFAULT ''::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status_pegawai gukar_status_pegawai,
  kategori_peran text DEFAULT ''::text NOT NULL,
  metode_id uuid
);

CREATE TABLE public.guru_kartu_tersembunyi (
  teacher_id uuid NOT NULL,
  ruang text NOT NULL,
  kunci text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.halaqoh (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  jenjang jenjang NOT NULL,
  wali_teacher_id uuid,
  schedule_note text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  term_id uuid,
  sesi smallint,
  tempat text DEFAULT ''::text NOT NULL,
  program text
);

CREATE TABLE public.halaqoh_members (
  halaqoh_id uuid NOT NULL,
  student_id uuid NOT NULL,
  joined_at date DEFAULT CURRENT_DATE NOT NULL,
  left_at date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.halaqoh_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  halaqoh_id uuid NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  note text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.halaqoh_teachers (
  halaqoh_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  role text DEFAULT 'pengampu'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.jilid_levels (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  method_id uuid NOT NULL,
  label text NOT NULL,
  order_num integer NOT NULL,
  total_pages integer,
  is_quran boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  is_terminal boolean DEFAULT false NOT NULL,
  baca_quran boolean DEFAULT false NOT NULL
);

CREATE TABLE public.jilid_promotions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  from_jilid_id uuid,
  to_jilid_id uuid NOT NULL,
  promoted_by uuid,
  promotion_date date DEFAULT CURRENT_DATE NOT NULL,
  exam_score numeric(5,2),
  catatan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  source_log_id uuid,
  source_ujian_id uuid
);

CREATE TABLE public.juz_progress (
  student_id uuid NOT NULL,
  juz_number integer NOT NULL,
  ayat_hafal integer DEFAULT 0 NOT NULL,
  last_setoran_at timestamp with time zone,
  mutqin boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.juz_promotions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  juz_number integer NOT NULL,
  promoted_by uuid,
  promotion_date date DEFAULT CURRENT_DATE NOT NULL,
  exam_score numeric(5,2),
  catatan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  source_log_id uuid
);

CREATE TABLE public.kaldik_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  date date NOT NULL,
  title text NOT NULL,
  description text,
  unit text DEFAULT 'NASIONAL'::text NOT NULL,
  type text DEFAULT 'agenda'::text NOT NULL,
  color text DEFAULT '#3B82F6'::text NOT NULL,
  year integer NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kalender_jadwal (
  term_id uuid NOT NULL,
  jenjang jenjang NOT NULL,
  program text DEFAULT ''::text NOT NULL,
  hari smallint[] DEFAULT '{1,2,3,4}'::smallint[] NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kalender_kosong (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  tanggal date NOT NULL,
  jenjang jenjang NOT NULL,
  tingkat smallint NOT NULL,
  kelas text,
  alasan text DEFAULT ''::text NOT NULL,
  ditandai_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kalender_pekan_efektif (
  tahun_ajaran text NOT NULL,
  bulan date NOT NULL,
  semester smallint NOT NULL,
  pekan_efektif numeric(3,1) DEFAULT 0 NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kelompok_klasikal (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  halaqoh_id uuid NOT NULL,
  nama text NOT NULL,
  urutan smallint DEFAULT 0 NOT NULL,
  dibuat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kelompok_klasikal_anggota (
  kelompok_id uuid NOT NULL,
  student_id uuid NOT NULL
);

CREATE TABLE public.kpi_banding (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kpi_monthly_id uuid,
  teacher_id uuid NOT NULL,
  versi_rapor integer DEFAULT 1 NOT NULL,
  tingkat smallint DEFAULT 1 NOT NULL,
  induk_id uuid,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  lampiran_url text[],
  status kpi_banding_status DEFAULT 'diajukan'::kpi_banding_status NOT NULL,
  diajukan_at timestamp with time zone DEFAULT now(),
  putusan_batas date,
  putusan_oleh uuid,
  putusan_at timestamp with time zone,
  putusan_alasan text,
  eskalasi_alasan text,
  created_at timestamp with time zone DEFAULT now(),
  year integer,
  month integer
);

CREATE TABLE public.kpi_monthly (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  late_minutes numeric DEFAULT 0 NOT NULL,
  db_late_days numeric DEFAULT 0 NOT NULL,
  hafalan_juz numeric DEFAULT 0 NOT NULL,
  hafalan_pages numeric DEFAULT 0 NOT NULL,
  tuhfatul_bait numeric DEFAULT 0 NOT NULL,
  bacaan_score numeric DEFAULT 0 NOT NULL,
  buku_pegangan_meetings numeric DEFAULT 0 NOT NULL,
  izin_wa_cases numeric DEFAULT 0 NOT NULL,
  pengganti_cases numeric DEFAULT 0 NOT NULL,
  pengganti_found numeric DEFAULT 0 NOT NULL,
  seragam_daily integer[],
  lapor_ortu_daily integer[],
  halaqoh_hadir integer[],
  halaqoh_akhiri integer[],
  seragam_total numeric,
  lapor_ortu_total numeric,
  halaqoh_total numeric,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  unit jenjang,
  apresiasi text[],
  pengembangan text[],
  status kpi_rapor_status DEFAULT 'draft'::kpi_rapor_status NOT NULL,
  selesai_sebab kpi_selesai_sebab,
  versi integer DEFAULT 1 NOT NULL,
  diajukan_at timestamp with time zone,
  diajukan_by uuid,
  dikembalikan_alasan text,
  terbit_at timestamp with time zone,
  terbit_by uuid,
  koor_ttd_path text,
  koor_ttd_focus jsonb,
  guru_dibuka_at timestamp with time zone,
  guru_ttd_at timestamp with time zone,
  guru_ttd_path text,
  guru_ttd_focus jsonb,
  banding_batas date,
  direset_at timestamp with time zone,
  direset_by uuid
);

CREATE TABLE public.kpi_rapor_riwayat (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kpi_monthly_id uuid,
  versi integer DEFAULT 1 NOT NULL,
  aksi kpi_riwayat_aksi NOT NULL,
  actor_user_id uuid,
  actor_teacher_id uuid,
  catatan text,
  created_at timestamp with time zone DEFAULT now(),
  teacher_id uuid,
  year integer,
  month integer
);

CREATE TABLE public.kurikulum_targets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  term_id uuid NOT NULL,
  jenjang jenjang NOT NULL,
  tingkat smallint NOT NULL,
  target_tahsin text DEFAULT ''::text NOT NULL,
  target_juz smallint,
  catatan text DEFAULT ''::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type meeting_type NOT NULL,
  subject text NOT NULL,
  date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  location text,
  mc text,
  notulis text,
  participants text[],
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by uuid,
  peserta_izin text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE TABLE public.news_articles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  excerpt text,
  thumbnail_url text,
  category text,
  type text DEFAULT 'berita'::text NOT NULL
);

CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL,
  history_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.private_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.program_details (
  slug text NOT NULL,
  long_description text DEFAULT ''::text NOT NULL,
  curriculum text DEFAULT ''::text NOT NULL,
  schedule text DEFAULT ''::text NOT NULL,
  target_audience text DEFAULT ''::text NOT NULL,
  contact_info text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);

CREATE TABLE public.programs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  photo_url text,
  icon text DEFAULT 'BookOpen'::text NOT NULL,
  accent text DEFAULT 'emerald'::text NOT NULL,
  long_description text DEFAULT ''::text NOT NULL,
  curriculum text DEFAULT ''::text NOT NULL,
  schedule text DEFAULT ''::text NOT NULL,
  target_audience text DEFAULT ''::text NOT NULL,
  contact_info text DEFAULT ''::text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.public_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type public_post_type NOT NULL,
  target public_target DEFAULT 'all'::public_target NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  due_date date,
  created_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  priority post_priority DEFAULT 'info'::post_priority NOT NULL,
  icon post_icon,
  image_url text
);

CREATE TABLE public.rapor_isian (
  student_id uuid NOT NULL,
  term_id uuid NOT NULL,
  template_id uuid,
  deskripsi text DEFAULT ''::text NOT NULL,
  timpaan jsonb DEFAULT '{}'::jsonb NOT NULL,
  diisi_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  jenis text DEFAULT 'semester'::text NOT NULL,
  isian jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.rapor_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nama text NOT NULL,
  jenjang jenjang NOT NULL,
  tingkat_min smallint DEFAULT 1 NOT NULL,
  tingkat_max smallint DEFAULT 12 NOT NULL,
  file_path text,
  file_nama text,
  blok jsonb DEFAULT '[]'::jsonb NOT NULL,
  pemetaan jsonb DEFAULT '{}'::jsonb NOT NULL,
  tempat_terbit text DEFAULT ''::text NOT NULL,
  nama_koordinator text DEFAULT ''::text NOT NULL,
  nip_koordinator text DEFAULT ''::text NOT NULL,
  aktif boolean DEFAULT true NOT NULL,
  dibuat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  ttd_koordinator_path text,
  jenis text DEFAULT 'semester'::text NOT NULL,
  awal_isian jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.riyadhoh_hadir (
  student_id uuid NOT NULL,
  tanggal date NOT NULL,
  status absensi_status NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  dicatat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.riyadhoh_jadwal (
  tanggal date NOT NULL,
  gender gender NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  dibuat_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.riyadhoh_pengampu (
  teacher_id uuid NOT NULL,
  gender gender NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.riyadhoh_peserta (
  student_id uuid NOT NULL,
  ikut boolean NOT NULL,
  diubah_oleh uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.routine_check_konfirmasi (
  task_id uuid NOT NULL,
  period text NOT NULL,
  user_id uuid NOT NULL,
  keputusan text NOT NULL,
  decided_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.routine_task_checks (
  task_id uuid NOT NULL,
  period text NOT NULL,
  checked_by uuid,
  checked_at timestamp with time zone DEFAULT now() NOT NULL,
  outcome routine_outcome DEFAULT 'terlaksana'::routine_outcome NOT NULL,
  reason text,
  konfirmasi text DEFAULT 'selesai'::text NOT NULL
);

CREATE TABLE public.routine_task_members (
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'menunggu'::text NOT NULL,
  invited_by uuid,
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.routine_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  description text NOT NULL,
  cadence routine_cadence NOT NULL,
  order_num integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.setoran_arsip (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jenis text NOT NULL,
  log_id uuid NOT NULL,
  student_id uuid NOT NULL,
  setoran_date date NOT NULL,
  kind text,
  data jsonb NOT NULL,
  materi jsonb,
  diganti_oleh uuid,
  diarsipkan_oleh uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.site_settings (
  id integer DEFAULT 1 NOT NULL,
  header_brand text DEFAULT ''::text,
  header_tagline text DEFAULT ''::text,
  footer_brand text DEFAULT ''::text,
  footer_brand_sub text DEFAULT ''::text,
  footer_tagline text DEFAULT ''::text,
  footer_units jsonb DEFAULT '[]'::jsonb,
  footer_links jsonb DEFAULT '[]'::jsonb,
  footer_email text DEFAULT ''::text,
  footer_phone text DEFAULT ''::text,
  footer_hours text DEFAULT ''::text,
  footer_copyright text DEFAULT ''::text,
  sections jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.sprint_goals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sprint_id uuid NOT NULL,
  jabatan user_role NOT NULL,
  goal text DEFAULT ''::text NOT NULL,
  disahkan_at timestamp with time zone,
  disahkan_by uuid,
  hasil text,
  catatan_review text DEFAULT ''::text NOT NULL,
  retro_baik text DEFAULT ''::text NOT NULL,
  retro_hambatan text DEFAULT ''::text NOT NULL,
  retro_ubah text DEFAULT ''::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sprint_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sprint_id uuid NOT NULL,
  task_id uuid NOT NULL,
  jabatan user_role NOT NULL,
  poin smallint NOT NULL,
  tengah_sprint boolean DEFAULT false NOT NULL,
  status_saat_tutup task_status,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sprints (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  periode date NOT NULL,
  ditutup_at timestamp with time zone,
  ditutup_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.student_monthly (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  period date NOT NULL,
  level text DEFAULT ''::text NOT NULL,
  halaman_awal_tahsin text DEFAULT ''::text NOT NULL,
  halaman_akhir_tahsin text DEFAULT ''::text NOT NULL,
  tahfidz_awal text DEFAULT ''::text NOT NULL,
  tahfidz_akhir text DEFAULT ''::text NOT NULL,
  capaian_halaman integer DEFAULT 0 NOT NULL,
  catatan text DEFAULT ''::text NOT NULL,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  ujian_tercatat text DEFAULT ''::text NOT NULL,
  total_hafalan text DEFAULT ''::text NOT NULL,
  dari_setoran boolean DEFAULT false NOT NULL
);

CREATE TABLE public.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nis text,
  full_name text NOT NULL,
  gender gender,
  birth_date date,
  photo_url text,
  jenjang jenjang NOT NULL,
  kelas text,
  halaqoh_id uuid,
  wali_name text,
  wali_phone text,
  wali_email text,
  current_method_id uuid,
  current_jilid_id uuid,
  current_jilid_page integer,
  is_active boolean DEFAULT true NOT NULL,
  enrolled_at date DEFAULT CURRENT_DATE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  program text,
  level_awal text DEFAULT ''::text NOT NULL,
  tahsin_drill_sejak date,
  current_quran_halaman integer,
  current_quran_surat_id integer,
  current_quran_ayat integer,
  asal_sd_lhi boolean DEFAULT false NOT NULL
);

CREATE TABLE public.surat_master (
  id integer NOT NULL,
  name_arabic text NOT NULL,
  name_latin text NOT NULL,
  name_id text NOT NULL,
  total_ayat integer NOT NULL,
  juz_start integer NOT NULL,
  juz_end integer NOT NULL,
  is_makkiyah boolean NOT NULL
);

CREATE TABLE public.tahfidz_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  halaqoh_id uuid,
  setoran_date date DEFAULT CURRENT_DATE NOT NULL,
  kind tahfidz_kind DEFAULT 'hafalan_baru'::tahfidz_kind NOT NULL,
  surat_id integer NOT NULL,
  ayat_dari integer NOT NULL,
  ayat_ke integer NOT NULL,
  nilai_fashohah numeric(2,1),
  nilai_tajwid numeric(2,1),
  nilai_kelancaran numeric(2,1),
  catatan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  nilai_tahfidz numeric(5,2),
  nilai_sikap numeric(5,2),
  surat_ke_id integer,
  riyadhoh boolean DEFAULT false NOT NULL,
  ekstra_slot_id uuid
);

CREATE TABLE public.tahsin_log_materi (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  log_id uuid NOT NULL,
  student_id uuid NOT NULL,
  materi_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  hasil materi_hasil DEFAULT 'lulus'::materi_hasil NOT NULL
);

CREATE TABLE public.tahsin_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  halaqoh_id uuid,
  setoran_date date DEFAULT CURRENT_DATE NOT NULL,
  method_id uuid,
  jilid_id uuid,
  halaman integer,
  baris_dari integer,
  baris_ke integer,
  nilai_fashohah numeric(2,1),
  nilai_tajwid numeric(2,1),
  nilai_kelancaran numeric(2,1),
  status tahsin_status DEFAULT 'lulus'::tahsin_status NOT NULL,
  catatan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  nilai_tahsin numeric(5,2),
  nilai_sikap numeric(5,2),
  drill boolean DEFAULT false NOT NULL,
  quran_halaman integer,
  quran_surat_id integer,
  quran_ayat_dari integer,
  quran_ayat_ke integer,
  riyadhoh boolean DEFAULT false NOT NULL,
  ekstra_slot_id uuid
);

CREATE TABLE public.tahsin_materi (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  jilid_id uuid NOT NULL,
  nomor smallint NOT NULL,
  halaman smallint NOT NULL,
  nama text NOT NULL,
  keterangan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tahsin_methods (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  author_id uuid,
  body text NOT NULL,
  mentions uuid[],
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_dependencies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  depends_on_id uuid NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid,
  changed_by uuid,
  old_status task_status,
  new_status task_status NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  action task_history_action DEFAULT 'status'::task_history_action NOT NULL
);

CREATE TABLE public.task_subtasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  title text NOT NULL,
  order_num integer DEFAULT 0 NOT NULL,
  start_date date,
  due_date date,
  status subtask_status DEFAULT 'todo'::subtask_status NOT NULL,
  created_by uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  source_type task_source NOT NULL,
  source_meeting_id uuid,
  source_agenda_id uuid,
  assigned_by uuid,
  assigned_to uuid,
  public_target public_target,
  priority task_priority DEFAULT 'middle'::task_priority,
  status task_status DEFAULT 'todo'::task_status,
  due_date date,
  return_notes text,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  weight task_weight DEFAULT 'medium'::task_weight,
  horizon task_horizon DEFAULT 'pendek'::task_horizon,
  problem_type task_problem_type,
  problem_notes text,
  deleted_at timestamp with time zone,
  start_date date
);

CREATE TABLE public.tasmi_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  halaqoh_id uuid,
  setoran_date date DEFAULT CURRENT_DATE NOT NULL,
  scope_juz smallint NOT NULL,
  juz_from integer NOT NULL,
  juz_to integer NOT NULL,
  nilai_fashohah numeric(2,1),
  nilai_tajwid numeric(2,1),
  nilai_kelancaran numeric(2,1),
  status tahsin_status DEFAULT 'lulus'::tahsin_status NOT NULL,
  catatan text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  nilai_tahfidz numeric(5,2),
  nilai_sikap numeric(5,2)
);

CREATE TABLE public.teacher_unit_moves (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  from_unit jenjang,
  to_unit jenjang NOT NULL,
  effective_date date NOT NULL,
  notes text,
  moved_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.teachers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  nip text,
  email text,
  phone text,
  photo_url text,
  is_active boolean DEFAULT true NOT NULL,
  can_change_password boolean DEFAULT true NOT NULL,
  joined_at date,
  linked_user_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  public_title text,
  public_bio text,
  is_public boolean DEFAULT false,
  display_order integer DEFAULT 0,
  deleted_at timestamp with time zone,
  employment_type teacher_employment,
  contract_start date,
  contract_end date,
  unit jenjang,
  photo_focus jsonb DEFAULT '{"x": 50, "y": 50, "zoom": 100}'::jsonb,
  sapaan text,
  nickname text,
  birth_place text,
  birth_date date,
  education_level text,
  education_history jsonb,
  quran_competencies jsonb,
  other_competencies jsonb,
  ijazah_sanad text[],
  trainings jsonb,
  amanah_history jsonb,
  awards jsonb,
  announcements_seen_at timestamp with time zone,
  signature_path text,
  signature_focus jsonb,
  lingkup_penugasan lingkup_penugasan DEFAULT 'unit'::lingkup_penugasan NOT NULL,
  kategori_guru kategori_guru,
  ujian_notif_seen_at timestamp with time zone,
  gender gender
);

CREATE TABLE public.ujian_pengujis (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nama text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  teacher_id uuid
);

CREATE TABLE public.ujian_tahfidz (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  unit text NOT NULL,
  tipe text NOT NULL,
  juz text NOT NULL,
  nama_siswa text NOT NULL,
  kelas text NOT NULL,
  is_quls boolean DEFAULT false NOT NULL,
  jadwal timestamp with time zone,
  penguji text,
  predikat text,
  catatan text,
  status text DEFAULT 'diajukan'::text NOT NULL,
  created_by_teacher uuid,
  created_by_user uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  student_id uuid,
  nama_flyer text,
  dijadwalkan_at timestamp with time zone,
  selesai_at timestamp with time zone
);

CREATE TABLE public.ujian_tahsin (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  unit text NOT NULL,
  nama_kelompok text NOT NULL,
  sesi text NOT NULL,
  level text NOT NULL,
  siswa jsonb DEFAULT '[]'::jsonb NOT NULL,
  jadwal timestamp with time zone,
  penguji text,
  catatan text,
  status text DEFAULT 'diajukan'::text NOT NULL,
  created_by_teacher uuid,
  created_by_user uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  dijadwalkan_at timestamp with time zone,
  selesai_at timestamp with time zone
);

CREATE TABLE public.users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  display_name text NOT NULL,
  email text,
  can_change_password boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  notifications_seen_at timestamp with time zone,
  sapaan text,
  nickname text,
  full_name text,
  nip text,
  birth_place text,
  birth_date date,
  current_amanah text,
  education_level text,
  photo_url text,
  trainings jsonb DEFAULT '[]'::jsonb,
  amanah_history jsonb DEFAULT '[]'::jsonb,
  awards jsonb DEFAULT '[]'::jsonb,
  ujian_seen_at timestamp with time zone,
  education_history jsonb DEFAULT '[]'::jsonb,
  photo_focus jsonb DEFAULT '{"x": 50, "y": 50, "zoom": 100}'::jsonb,
  quran_competencies jsonb,
  other_competencies jsonb,
  ijazah_sanad text[],
  signature_path text,
  signature_focus jsonb
);

CREATE TABLE public.verifikasi_riwayat_tahfidz (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  tipe text NOT NULL,
  juz text NOT NULL,
  hasil text NOT NULL,
  ujian_id uuid,
  catatan text,
  diverifikasi_by uuid,
  diverifikasi_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER SEQUENCE public.drizzle_migrations_id_seq OWNED BY public.drizzle_migrations.id;

-- ─── Constraint (PK, unik, check, lalu FK) ─────────────────────────────────

ALTER TABLE public.about_rq ADD CONSTRAINT about_rq_pkey PRIMARY KEY (id);
ALTER TABLE public.absensi_harian ADD CONSTRAINT absensi_harian_pkey PRIMARY KEY (student_id, tanggal);
ALTER TABLE public.academic_terms ADD CONSTRAINT academic_terms_pkey PRIMARY KEY (id);
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_pkey PRIMARY KEY (id);
ALTER TABLE public.batas_juz ADD CONSTRAINT batas_juz_pkey PRIMARY KEY (juz);
ALTER TABLE public.content_requests ADD CONSTRAINT content_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.drizzle_migrations ADD CONSTRAINT drizzle_migrations_pkey PRIMARY KEY (id);
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_pkey PRIMARY KEY (id);
ALTER TABLE public.ekstra_hadir ADD CONSTRAINT ekstra_hadir_pkey PRIMARY KEY (booking_id, tanggal);
ALTER TABLE public.ekstra_jenis ADD CONSTRAINT ekstra_jenis_pkey PRIMARY KEY (id);
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_pkey PRIMARY KEY (id);
ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_funding ADD CONSTRAINT finance_funding_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_program_plans ADD CONSTRAINT finance_program_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_report_notes ADD CONSTRAINT finance_report_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_trust_entries ADD CONSTRAINT finance_trust_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.finance_trust_funds ADD CONSTRAINT finance_trust_funds_pkey PRIMARY KEY (id);
ALTER TABLE public.gukar_groups ADD CONSTRAINT gukar_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_pkey PRIMARY KEY (id);
ALTER TABLE public.gukar_participants ADD CONSTRAINT gukar_participants_pkey PRIMARY KEY (id);
ALTER TABLE public.guru_kartu_tersembunyi ADD CONSTRAINT guru_kartu_tersembunyi_pkey PRIMARY KEY (teacher_id, ruang, kunci);
ALTER TABLE public.halaqoh ADD CONSTRAINT halaqoh_pkey PRIMARY KEY (id);
ALTER TABLE public.halaqoh_members ADD CONSTRAINT halaqoh_members_pkey PRIMARY KEY (halaqoh_id, student_id);
ALTER TABLE public.halaqoh_sessions ADD CONSTRAINT halaqoh_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.halaqoh_teachers ADD CONSTRAINT halaqoh_teachers_pkey PRIMARY KEY (halaqoh_id, teacher_id);
ALTER TABLE public.jilid_levels ADD CONSTRAINT jilid_levels_pkey PRIMARY KEY (id);
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_pkey PRIMARY KEY (id);
ALTER TABLE public.juz_progress ADD CONSTRAINT juz_progress_pkey PRIMARY KEY (student_id, juz_number);
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_pkey PRIMARY KEY (id);
ALTER TABLE public.kaldik_events ADD CONSTRAINT kaldik_events_pkey PRIMARY KEY (id);
ALTER TABLE public.kalender_jadwal ADD CONSTRAINT kalender_jadwal_pkey PRIMARY KEY (term_id, jenjang, program);
ALTER TABLE public.kalender_kosong ADD CONSTRAINT kalender_kosong_pkey PRIMARY KEY (id);
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_pkey PRIMARY KEY (tahun_ajaran, bulan);
ALTER TABLE public.kelompok_klasikal ADD CONSTRAINT kelompok_klasikal_pkey PRIMARY KEY (id);
ALTER TABLE public.kelompok_klasikal_anggota ADD CONSTRAINT kelompok_klasikal_anggota_pkey PRIMARY KEY (kelompok_id, student_id);
ALTER TABLE public.kpi_banding ADD CONSTRAINT kpi_banding_pkey PRIMARY KEY (id);
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_pkey PRIMARY KEY (id);
ALTER TABLE public.kpi_rapor_riwayat ADD CONSTRAINT kpi_rapor_riwayat_pkey PRIMARY KEY (id);
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_pkey PRIMARY KEY (id);
ALTER TABLE public.meetings ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_reads ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (user_id, history_id);
ALTER TABLE public.private_notes ADD CONSTRAINT private_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.program_details ADD CONSTRAINT program_details_pkey PRIMARY KEY (slug);
ALTER TABLE public.programs ADD CONSTRAINT programs_pkey PRIMARY KEY (id);
ALTER TABLE public.public_posts ADD CONSTRAINT public_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_pkey PRIMARY KEY (student_id, term_id, jenis);
ALTER TABLE public.rapor_templates ADD CONSTRAINT rapor_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.riyadhoh_hadir ADD CONSTRAINT riyadhoh_hadir_pkey PRIMARY KEY (student_id, tanggal);
ALTER TABLE public.riyadhoh_jadwal ADD CONSTRAINT riyadhoh_jadwal_pkey PRIMARY KEY (tanggal);
ALTER TABLE public.riyadhoh_pengampu ADD CONSTRAINT riyadhoh_pengampu_pkey PRIMARY KEY (teacher_id, gender);
ALTER TABLE public.riyadhoh_peserta ADD CONSTRAINT riyadhoh_peserta_pkey PRIMARY KEY (student_id);
ALTER TABLE public.routine_check_konfirmasi ADD CONSTRAINT routine_check_konfirmasi_pkey PRIMARY KEY (task_id, period, user_id);
ALTER TABLE public.routine_task_checks ADD CONSTRAINT routine_task_checks_pkey PRIMARY KEY (task_id, period);
ALTER TABLE public.routine_task_members ADD CONSTRAINT routine_task_members_pkey PRIMARY KEY (task_id, user_id);
ALTER TABLE public.routine_tasks ADD CONSTRAINT routine_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.setoran_arsip ADD CONSTRAINT setoran_arsip_pkey PRIMARY KEY (id);
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_pkey PRIMARY KEY (id);
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_pkey PRIMARY KEY (id);
ALTER TABLE public.sprints ADD CONSTRAINT sprints_pkey PRIMARY KEY (id);
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_pkey PRIMARY KEY (id);
ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE public.surat_master ADD CONSTRAINT surat_master_pkey PRIMARY KEY (id);
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.tahsin_log_materi ADD CONSTRAINT tahsin_log_materi_pkey PRIMARY KEY (id);
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.tahsin_materi ADD CONSTRAINT tahsin_materi_pkey PRIMARY KEY (id);
ALTER TABLE public.tahsin_methods ADD CONSTRAINT tahsin_methods_pkey PRIMARY KEY (id);
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);
ALTER TABLE public.task_history ADD CONSTRAINT task_history_pkey PRIMARY KEY (id);
ALTER TABLE public.task_subtasks ADD CONSTRAINT task_subtasks_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.teacher_unit_moves ADD CONSTRAINT teacher_unit_moves_pkey PRIMARY KEY (id);
ALTER TABLE public.teachers ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);
ALTER TABLE public.ujian_pengujis ADD CONSTRAINT ujian_pengujis_pkey PRIMARY KEY (id);
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_pkey PRIMARY KEY (id);
ALTER TABLE public.ujian_tahsin ADD CONSTRAINT ujian_tahsin_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_pkey PRIMARY KEY (id);
ALTER TABLE public.academic_terms ADD CONSTRAINT academic_terms_year_label_semester_key UNIQUE (year_label, semester);
ALTER TABLE public.drizzle_migrations ADD CONSTRAINT drizzle_migrations_tag_key UNIQUE (tag);
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_kind_slug_key UNIQUE (kind, slug);
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_account_id_period_key UNIQUE (account_id, period);
ALTER TABLE public.finance_funding ADD CONSTRAINT finance_funding_transaction_id_source_slug_key UNIQUE (transaction_id, source_slug);
ALTER TABLE public.finance_report_notes ADD CONSTRAINT finance_report_notes_period_section_key UNIQUE (period, section);
ALTER TABLE public.finance_trust_funds ADD CONSTRAINT finance_trust_funds_slug_key UNIQUE (slug);
ALTER TABLE public.gukar_groups ADD CONSTRAINT gukar_groups_term_id_name_key UNIQUE (term_id, name);
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_participant_id_period_key UNIQUE (participant_id, period);
ALTER TABLE public.gukar_participants ADD CONSTRAINT gukar_participants_group_id_full_name_key UNIQUE (group_id, full_name);
ALTER TABLE public.halaqoh_sessions ADD CONSTRAINT halaqoh_sessions_halaqoh_id_day_of_week_start_time_key UNIQUE (halaqoh_id, day_of_week, start_time);
ALTER TABLE public.jilid_levels ADD CONSTRAINT jilid_levels_method_id_order_num_key UNIQUE (method_id, order_num);
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_student_id_juz_number_key UNIQUE (student_id, juz_number);
ALTER TABLE public.kelompok_klasikal_anggota ADD CONSTRAINT kelompok_klasikal_anggota_satu_kelompok UNIQUE (student_id);
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_guru_periode_unik UNIQUE (teacher_id, year, month);
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_term_id_jenjang_tingkat_key UNIQUE (term_id, jenjang, tingkat);
ALTER TABLE public.programs ADD CONSTRAINT programs_slug_key UNIQUE (slug);
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_satu_per_jabatan UNIQUE (sprint_id, jabatan);
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_sekali_per_sprint UNIQUE (sprint_id, task_id);
ALTER TABLE public.sprints ADD CONSTRAINT sprints_periode_key UNIQUE (periode);
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_student_id_period_key UNIQUE (student_id, period);
ALTER TABLE public.students ADD CONSTRAINT students_nis_key UNIQUE (nis);
ALTER TABLE public.tahsin_log_materi ADD CONSTRAINT tahsin_log_materi_log_id_materi_id_key UNIQUE (log_id, materi_id);
ALTER TABLE public.tahsin_materi ADD CONSTRAINT tahsin_materi_jilid_id_nomor_key UNIQUE (jilid_id, nomor);
ALTER TABLE public.tahsin_methods ADD CONSTRAINT tahsin_methods_name_key UNIQUE (name);
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_unik UNIQUE (task_id, depends_on_id);
ALTER TABLE public.teachers ADD CONSTRAINT teachers_username_key UNIQUE (username);
ALTER TABLE public.ujian_pengujis ADD CONSTRAINT ujian_pengujis_nama_key UNIQUE (nama);
ALTER TABLE public.users ADD CONSTRAINT users_username_unique UNIQUE (username);
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_unik UNIQUE (student_id, tipe, juz);
ALTER TABLE public.about_rq ADD CONSTRAINT about_rq_id_check CHECK ((id = 1));
ALTER TABLE public.academic_terms ADD CONSTRAINT academic_terms_rentang_masuk_akal CHECK ((end_date > start_date));
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_approval_status_cek CHECK (((approval_status IS NULL) OR (approval_status = ANY (ARRAY['menunggu'::text, 'disetujui'::text, 'ditolak'::text]))));
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_biaya_cek CHECK (((biaya IS NULL) OR (biaya >= 0)));
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_asal_check CHECK ((asal = ANY (ARRAY['lhi'::text, 'luar'::text])));
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_status_check CHECK ((status = ANY (ARRAY['baru'::text, 'ditawarkan'::text, 'aktif'::text, 'ditolak'::text, 'berhenti'::text])));
ALTER TABLE public.ekstra_jenis ADD CONSTRAINT ekstra_jenis_biaya_check CHECK ((biaya >= 0));
ALTER TABLE public.ekstra_jenis ADD CONSTRAINT ekstra_jenis_bidang_check CHECK ((bidang = ANY (ARRAY['tahsin'::text, 'tahfidz'::text, 'campuran'::text])));
ALTER TABLE public.ekstra_jenis ADD CONSTRAINT ekstra_jenis_durasi_menit_check CHECK ((durasi_menit > 0));
ALTER TABLE public.ekstra_jenis ADD CONSTRAINT ekstra_jenis_kuota_check CHECK ((kuota > 0));
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_hari_check CHECK (((hari >= 1) AND (hari <= 7)));
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_jam CHECK ((jam_selesai > jam_mulai));
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_kuota_check CHECK (((kuota IS NULL) OR (kuota > 0)));
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_amount_wajar CHECK ((amount >= 0));
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.finance_funding ADD CONSTRAINT finance_funding_amount_positif CHECK ((amount > 0));
ALTER TABLE public.finance_program_plans ADD CONSTRAINT finance_program_plans_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.finance_report_notes ADD CONSTRAINT finance_report_notes_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_amount_positif CHECK ((amount > 0));
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_status_selaras CHECK ((((status = 'lunas'::finance_payment_status) AND (paid_at IS NOT NULL)) OR ((status = 'piutang'::finance_payment_status) AND (paid_at IS NULL))));
ALTER TABLE public.finance_trust_entries ADD CONSTRAINT finance_trust_entries_amount_bukan_nol CHECK ((amount <> 0));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_awal_ck CHECK ((((awal_tahsin_surat IS NULL) OR ((awal_tahsin_surat >= 1) AND (awal_tahsin_surat <= 114))) AND ((awal_tahfidz_surat IS NULL) OR ((awal_tahfidz_surat >= 1) AND (awal_tahfidz_surat <= 114))) AND ((awal_halaman IS NULL) OR (awal_halaman >= 1)) AND ((awal_tanggal IS NULL) OR (setoran_terakhir IS NULL) OR (awal_tanggal <= setoran_terakhir))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_halaman_wajar CHECK ((jumlah_halaman >= 0));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_juz_berjalan_wajar CHECK (((juz_berjalan IS NULL) OR ((juz_berjalan >= 1) AND (juz_berjalan <= 30))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_juz_tuntas_wajar CHECK (((juz_tuntas IS NULL) OR ((juz_tuntas >= 0) AND (juz_tuntas <= 30))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_kehadiran_ck CHECK ((((jumlah_siklus IS NULL) OR ((jumlah_siklus >= 1) AND (jumlah_siklus <= 6))) AND ((jumlah_hadir IS NULL) OR ((jumlah_hadir >= 0) AND (jumlah_siklus IS NOT NULL) AND (jumlah_hadir <= jumlah_siklus)))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_nilai_tahfidz_wajar CHECK (((nilai_tahfidz IS NULL) OR ((nilai_tahfidz >= 0) AND (nilai_tahfidz <= 100))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_surat_ck CHECK ((((tahsin_surat IS NULL) OR ((tahsin_surat >= 1) AND (tahsin_surat <= 114))) AND ((tahfidz_surat IS NULL) OR ((tahfidz_surat >= 1) AND (tahfidz_surat <= 114))) AND ((tahsin_ayat IS NULL) OR (tahsin_ayat >= 1)) AND ((tahfidz_ayat IS NULL) OR (tahfidz_ayat >= 1)) AND ((halaman IS NULL) OR (halaman >= 1))));
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_surat_pilihan_wajar CHECK (((surat_pilihan >= 0) AND (surat_pilihan <= 30)));
ALTER TABLE public.halaqoh ADD CONSTRAINT halaqoh_sesi_sah CHECK (((sesi IS NULL) OR ((sesi >= 1) AND (sesi <= 3))));
ALTER TABLE public.halaqoh_sessions ADD CONSTRAINT halaqoh_sessions_hari_sah CHECK (((day_of_week >= 1) AND (day_of_week <= 7)));
ALTER TABLE public.halaqoh_sessions ADD CONSTRAINT halaqoh_sessions_jam_sah CHECK ((end_time > start_time));
ALTER TABLE public.juz_progress ADD CONSTRAINT juz_progress_juz_number_check CHECK (((juz_number >= 1) AND (juz_number <= 30)));
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_juz_number_check CHECK (((juz_number >= 1) AND (juz_number <= 30)));
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_bulan_check CHECK ((EXTRACT(day FROM bulan) = (1)::numeric));
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_pekan_efektif_check CHECK (((pekan_efektif >= (0)::numeric) AND (pekan_efektif <= (6)::numeric)));
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_semester_check CHECK ((semester = ANY (ARRAY[1, 2])));
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_tahun_ajaran_check CHECK ((tahun_ajaran ~ '^\d{4}/\d{4}$'::text));
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_month_check CHECK (((month >= 1) AND (month <= 12)));
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_juz_sah CHECK (((target_juz IS NULL) OR ((target_juz >= 1) AND (target_juz <= 30))));
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_tingkat_sah CHECK (((tingkat >= 1) AND (tingkat <= 12)));
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_jenis_sah CHECK ((jenis = ANY (ARRAY['ats'::text, 'semester'::text])));
ALTER TABLE public.rapor_templates ADD CONSTRAINT rapor_templates_jenis_sah CHECK ((jenis = ANY (ARRAY['ats'::text, 'semester'::text])));
ALTER TABLE public.rapor_templates ADD CONSTRAINT rapor_templates_tingkat_masuk_akal CHECK ((tingkat_min <= tingkat_max));
ALTER TABLE public.riyadhoh_jadwal ADD CONSTRAINT riyadhoh_jadwal_sabtu CHECK ((EXTRACT(isodow FROM tanggal) = (6)::numeric));
ALTER TABLE public.routine_check_konfirmasi ADD CONSTRAINT routine_check_konfirmasi_keputusan_check CHECK ((keputusan = ANY (ARRAY['setuju'::text, 'tolak'::text])));
ALTER TABLE public.routine_task_checks ADD CONSTRAINT routine_task_checks_alasan_ck CHECK ((((outcome = 'tidak_terlaksana'::routine_outcome) AND (reason IS NOT NULL) AND (btrim(reason) <> ''::text)) OR ((outcome = 'terlaksana'::routine_outcome) AND (reason IS NULL))));
ALTER TABLE public.routine_task_checks ADD CONSTRAINT routine_task_checks_konfirmasi_ck CHECK (((konfirmasi = ANY (ARRAY['selesai'::text, 'menunggu'::text, 'ditolak'::text])) AND ((outcome = 'terlaksana'::routine_outcome) OR (konfirmasi = 'selesai'::text))));
ALTER TABLE public.routine_task_members ADD CONSTRAINT routine_task_members_status_check CHECK ((status = ANY (ARRAY['menunggu'::text, 'diterima'::text, 'ditolak'::text])));
ALTER TABLE public.setoran_arsip ADD CONSTRAINT setoran_arsip_jenis_check CHECK ((jenis = ANY (ARRAY['tahsin'::text, 'tahfidz'::text])));
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_singleton CHECK ((id = 1));
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_hasil_check CHECK ((hasil = ANY (ARRAY['tercapai'::text, 'sebagian'::text, 'tidak'::text])));
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_poin_check CHECK (((poin >= 1) AND (poin <= 3)));
ALTER TABLE public.sprints ADD CONSTRAINT sprints_periode_check CHECK ((EXTRACT(day FROM periode) = (1)::numeric));
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_halaman_wajar CHECK ((capaian_halaman >= 0));
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_period_awal_bulan CHECK ((EXTRACT(day FROM period) = (1)::numeric));
ALTER TABLE public.students ADD CONSTRAINT students_current_quran_ayat_check CHECK (((current_quran_ayat IS NULL) OR (current_quran_ayat >= 1)));
ALTER TABLE public.students ADD CONSTRAINT students_current_quran_halaman_check CHECK (((current_quran_halaman IS NULL) OR ((current_quran_halaman >= 1) AND (current_quran_halaman <= 604))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_nilai_fashohah_check CHECK (((nilai_fashohah >= 0.5) AND (nilai_fashohah <= (5)::numeric) AND ((nilai_fashohah * (2)::numeric) = floor((nilai_fashohah * (2)::numeric)))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_nilai_kelancaran_check CHECK (((nilai_kelancaran >= 0.5) AND (nilai_kelancaran <= (5)::numeric) AND ((nilai_kelancaran * (2)::numeric) = floor((nilai_kelancaran * (2)::numeric)))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_nilai_tajwid_check CHECK (((nilai_tajwid >= 0.5) AND (nilai_tajwid <= (5)::numeric) AND ((nilai_tajwid * (2)::numeric) = floor((nilai_tajwid * (2)::numeric)))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_nilai_wajar CHECK ((((nilai_tahfidz IS NULL) OR ((nilai_tahfidz >= (0)::numeric) AND (nilai_tahfidz <= (100)::numeric))) AND ((nilai_sikap IS NULL) OR ((nilai_sikap >= (0)::numeric) AND (nilai_sikap <= (100)::numeric)))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_rentang_check CHECK (((ayat_dari IS NULL) OR (ayat_ke IS NULL) OR ((surat_ke_id IS NULL) AND (ayat_ke >= ayat_dari)) OR ((surat_ke_id IS NOT NULL) AND (surat_ke_id <> surat_id))));
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_surat_ke_murojaah_check CHECK (((surat_ke_id IS NULL) OR ((kind)::text = ANY (ARRAY['murojaah_baru'::text, 'murojaah_lama'::text, 'murojaah'::text]))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_nilai_fashohah_check CHECK (((nilai_fashohah >= 0.5) AND (nilai_fashohah <= (5)::numeric) AND ((nilai_fashohah * (2)::numeric) = floor((nilai_fashohah * (2)::numeric)))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_nilai_kelancaran_check CHECK (((nilai_kelancaran >= 0.5) AND (nilai_kelancaran <= (5)::numeric) AND ((nilai_kelancaran * (2)::numeric) = floor((nilai_kelancaran * (2)::numeric)))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_nilai_tajwid_check CHECK (((nilai_tajwid >= 0.5) AND (nilai_tajwid <= (5)::numeric) AND ((nilai_tajwid * (2)::numeric) = floor((nilai_tajwid * (2)::numeric)))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_nilai_wajar CHECK ((((nilai_tahsin IS NULL) OR ((nilai_tahsin >= (0)::numeric) AND (nilai_tahsin <= (100)::numeric))) AND ((nilai_sikap IS NULL) OR ((nilai_sikap >= (0)::numeric) AND (nilai_sikap <= (100)::numeric)))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_quran_ayat_check CHECK ((((quran_ayat_dari IS NULL) OR (quran_ayat_dari >= 1)) AND ((quran_ayat_ke IS NULL) OR (quran_ayat_ke >= 1)) AND ((quran_ayat_ke IS NULL) OR (quran_ayat_dari IS NOT NULL)) AND ((quran_ayat_dari IS NULL) OR (quran_ayat_ke IS NULL) OR (quran_ayat_ke >= quran_ayat_dari))));
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_quran_halaman_check CHECK (((quran_halaman IS NULL) OR ((quran_halaman >= 1) AND (quran_halaman <= 604))));
ALTER TABLE public.tahsin_materi ADD CONSTRAINT tahsin_materi_halaman_check CHECK ((halaman >= 1));
ALTER TABLE public.tahsin_materi ADD CONSTRAINT tahsin_materi_nomor_check CHECK ((nomor >= 1));
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_bukan_diri_sendiri CHECK ((task_id <> depends_on_id));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_check CHECK ((juz_to >= juz_from));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_check1 CHECK ((((juz_to - juz_from) + 1) = scope_juz));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_juz_from_check CHECK (((juz_from >= 1) AND (juz_from <= 30)));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_juz_to_check CHECK (((juz_to >= 1) AND (juz_to <= 30)));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_nilai_fashohah_check CHECK (((nilai_fashohah >= 0.5) AND (nilai_fashohah <= (5)::numeric) AND ((nilai_fashohah * (2)::numeric) = floor((nilai_fashohah * (2)::numeric)))));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_nilai_kelancaran_check CHECK (((nilai_kelancaran >= 0.5) AND (nilai_kelancaran <= (5)::numeric) AND ((nilai_kelancaran * (2)::numeric) = floor((nilai_kelancaran * (2)::numeric)))));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_nilai_tajwid_check CHECK (((nilai_tajwid >= 0.5) AND (nilai_tajwid <= (5)::numeric) AND ((nilai_tajwid * (2)::numeric) = floor((nilai_tajwid * (2)::numeric)))));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_nilai_wajar CHECK ((((nilai_tahfidz IS NULL) OR ((nilai_tahfidz >= (0)::numeric) AND (nilai_tahfidz <= (100)::numeric))) AND ((nilai_sikap IS NULL) OR ((nilai_sikap >= (0)::numeric) AND (nilai_sikap <= (100)::numeric)))));
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_scope_juz_check CHECK ((scope_juz = ANY (ARRAY[3, 5])));
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_predikat_check CHECK ((predikat = ANY (ARRAY['mumtaz'::text, 'jayyid_jiddan'::text, 'jayyid'::text, 'maqbul'::text, 'mengulang'::text])));
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_status_check CHECK ((status = ANY (ARRAY['diajukan'::text, 'dijadwalkan'::text, 'selesai'::text])));
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_tipe_check CHECK ((tipe = ANY (ARRAY['1_juz'::text, '3_juz'::text, '5_juz'::text])));
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_unit_check CHECK ((unit = ANY (ARRAY['SD'::text, 'SMP'::text])));
ALTER TABLE public.ujian_tahsin ADD CONSTRAINT ujian_tahsin_status_check CHECK ((status = ANY (ARRAY['diajukan'::text, 'dijadwalkan'::text, 'selesai'::text])));
ALTER TABLE public.ujian_tahsin ADD CONSTRAINT ujian_tahsin_unit_check CHECK ((unit = ANY (ARRAY['SD'::text, 'SMP'::text])));
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_hasil_check CHECK ((hasil = ANY (ARRAY['sudah'::text, 'belum'::text])));
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_tipe_check CHECK ((tipe = ANY (ARRAY['1_juz'::text, '3_juz'::text, '5_juz'::text])));
ALTER TABLE public.about_rq ADD CONSTRAINT about_rq_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.absensi_harian ADD CONSTRAINT absensi_harian_dicatat_oleh_fkey FOREIGN KEY (dicatat_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.absensi_harian ADD CONSTRAINT absensi_harian_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE CASCADE;
ALTER TABLE public.absensi_harian ADD CONSTRAINT absensi_harian_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_approval_by_fkey FOREIGN KEY (approval_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_biaya_by_fkey FOREIGN KEY (biaya_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_diarsipkan_by_fkey FOREIGN KEY (diarsipkan_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_meeting_id_meetings_id_fk FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
ALTER TABLE public.agenda_items ADD CONSTRAINT agenda_items_selesai_by_fkey FOREIGN KEY (selesai_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.content_requests ADD CONSTRAINT content_requests_finished_by_users_id_fk FOREIGN KEY (finished_by) REFERENCES users(id);
ALTER TABLE public.content_requests ADD CONSTRAINT content_requests_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES users(id);
ALTER TABLE public.content_requests ADD CONSTRAINT content_requests_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_ditangani_oleh_fkey FOREIGN KEY (ditangani_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES ekstra_slot(id) ON DELETE RESTRICT;
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_slot_tawaran_id_fkey FOREIGN KEY (slot_tawaran_id) REFERENCES ekstra_slot(id) ON DELETE SET NULL;
ALTER TABLE public.ekstra_booking ADD CONSTRAINT ekstra_booking_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE public.ekstra_hadir ADD CONSTRAINT ekstra_hadir_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES ekstra_booking(id) ON DELETE CASCADE;
ALTER TABLE public.ekstra_hadir ADD CONSTRAINT ekstra_hadir_dicatat_oleh_fkey FOREIGN KEY (dicatat_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_jenis_id_fkey FOREIGN KEY (jenis_id) REFERENCES ekstra_jenis(id) ON DELETE RESTRICT;
ALTER TABLE public.ekstra_slot ADD CONSTRAINT ekstra_slot_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
ALTER TABLE public.employees ADD CONSTRAINT employees_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_account_id_fkey FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.finance_budgets ADD CONSTRAINT finance_budgets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_funding ADD CONSTRAINT finance_funding_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE CASCADE;
ALTER TABLE public.finance_program_plans ADD CONSTRAINT finance_program_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_report_notes ADD CONSTRAINT finance_report_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_trust_entries ADD CONSTRAINT finance_trust_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.finance_trust_entries ADD CONSTRAINT finance_trust_entries_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES finance_trust_funds(id) ON DELETE CASCADE;
ALTER TABLE public.gukar_groups ADD CONSTRAINT gukar_groups_pengampu_id_fkey FOREIGN KEY (pengampu_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.gukar_groups ADD CONSTRAINT gukar_groups_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE RESTRICT;
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_awal_jilid_id_fkey FOREIGN KEY (awal_jilid_id) REFERENCES jilid_levels(id) ON DELETE SET NULL;
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_jilid_id_fkey FOREIGN KEY (jilid_id) REFERENCES jilid_levels(id) ON DELETE SET NULL;
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES gukar_participants(id) ON DELETE CASCADE;
ALTER TABLE public.gukar_monthly ADD CONSTRAINT gukar_monthly_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.gukar_participants ADD CONSTRAINT gukar_participants_group_id_fkey FOREIGN KEY (group_id) REFERENCES gukar_groups(id) ON DELETE CASCADE;
ALTER TABLE public.gukar_participants ADD CONSTRAINT gukar_participants_metode_id_fkey FOREIGN KEY (metode_id) REFERENCES tahsin_methods(id) ON DELETE SET NULL;
ALTER TABLE public.guru_kartu_tersembunyi ADD CONSTRAINT guru_kartu_tersembunyi_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.halaqoh ADD CONSTRAINT halaqoh_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE RESTRICT;
ALTER TABLE public.halaqoh ADD CONSTRAINT halaqoh_wali_teacher_id_fkey FOREIGN KEY (wali_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.halaqoh_members ADD CONSTRAINT halaqoh_members_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE CASCADE;
ALTER TABLE public.halaqoh_members ADD CONSTRAINT halaqoh_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.halaqoh_sessions ADD CONSTRAINT halaqoh_sessions_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE CASCADE;
ALTER TABLE public.halaqoh_teachers ADD CONSTRAINT halaqoh_teachers_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE CASCADE;
ALTER TABLE public.halaqoh_teachers ADD CONSTRAINT halaqoh_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.jilid_levels ADD CONSTRAINT jilid_levels_method_id_fkey FOREIGN KEY (method_id) REFERENCES tahsin_methods(id) ON DELETE CASCADE;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_from_jilid_id_fkey FOREIGN KEY (from_jilid_id) REFERENCES jilid_levels(id) ON DELETE SET NULL;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_promoted_by_fkey FOREIGN KEY (promoted_by) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_source_log_id_fkey FOREIGN KEY (source_log_id) REFERENCES tahsin_logs(id) ON DELETE CASCADE;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_source_ujian_id_fkey FOREIGN KEY (source_ujian_id) REFERENCES ujian_tahsin(id) ON DELETE SET NULL;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.jilid_promotions ADD CONSTRAINT jilid_promotions_to_jilid_id_fkey FOREIGN KEY (to_jilid_id) REFERENCES jilid_levels(id) ON DELETE RESTRICT;
ALTER TABLE public.juz_progress ADD CONSTRAINT juz_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_promoted_by_fkey FOREIGN KEY (promoted_by) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_source_log_id_fkey FOREIGN KEY (source_log_id) REFERENCES tahfidz_logs(id) ON DELETE CASCADE;
ALTER TABLE public.juz_promotions ADD CONSTRAINT juz_promotions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.kaldik_events ADD CONSTRAINT kaldik_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kalender_jadwal ADD CONSTRAINT kalender_jadwal_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE CASCADE;
ALTER TABLE public.kalender_jadwal ADD CONSTRAINT kalender_jadwal_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kalender_kosong ADD CONSTRAINT kalender_kosong_ditandai_oleh_fkey FOREIGN KEY (ditandai_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kalender_pekan_efektif ADD CONSTRAINT kalender_pekan_efektif_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kelompok_klasikal ADD CONSTRAINT kelompok_klasikal_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.kelompok_klasikal ADD CONSTRAINT kelompok_klasikal_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE CASCADE;
ALTER TABLE public.kelompok_klasikal_anggota ADD CONSTRAINT kelompok_klasikal_anggota_kelompok_id_fkey FOREIGN KEY (kelompok_id) REFERENCES kelompok_klasikal(id) ON DELETE CASCADE;
ALTER TABLE public.kelompok_klasikal_anggota ADD CONSTRAINT kelompok_klasikal_anggota_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.kpi_banding ADD CONSTRAINT kpi_banding_induk_id_fkey FOREIGN KEY (induk_id) REFERENCES kpi_banding(id) ON DELETE CASCADE;
ALTER TABLE public.kpi_banding ADD CONSTRAINT kpi_banding_kpi_monthly_id_fkey FOREIGN KEY (kpi_monthly_id) REFERENCES kpi_monthly(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_banding ADD CONSTRAINT kpi_banding_putusan_oleh_fkey FOREIGN KEY (putusan_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_banding ADD CONSTRAINT kpi_banding_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_diajukan_by_fkey FOREIGN KEY (diajukan_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_direset_by_fkey FOREIGN KEY (direset_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_terbit_by_fkey FOREIGN KEY (terbit_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_monthly ADD CONSTRAINT kpi_monthly_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_rapor_riwayat ADD CONSTRAINT kpi_rapor_riwayat_actor_teacher_id_fkey FOREIGN KEY (actor_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_rapor_riwayat ADD CONSTRAINT kpi_rapor_riwayat_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_rapor_riwayat ADD CONSTRAINT kpi_rapor_riwayat_kpi_monthly_id_fkey FOREIGN KEY (kpi_monthly_id) REFERENCES kpi_monthly(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_rapor_riwayat ADD CONSTRAINT kpi_rapor_riwayat_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE CASCADE;
ALTER TABLE public.kurikulum_targets ADD CONSTRAINT kurikulum_targets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.meetings ADD CONSTRAINT meetings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE public.news_articles ADD CONSTRAINT news_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.notification_reads ADD CONSTRAINT notification_reads_history_id_fkey FOREIGN KEY (history_id) REFERENCES task_history(id) ON DELETE CASCADE;
ALTER TABLE public.notification_reads ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.private_notes ADD CONSTRAINT private_notes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE public.program_details ADD CONSTRAINT program_details_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.programs ADD CONSTRAINT programs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.public_posts ADD CONSTRAINT public_posts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_diisi_oleh_fkey FOREIGN KEY (diisi_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_template_id_fkey FOREIGN KEY (template_id) REFERENCES rapor_templates(id) ON DELETE SET NULL;
ALTER TABLE public.rapor_isian ADD CONSTRAINT rapor_isian_term_id_fkey FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE CASCADE;
ALTER TABLE public.rapor_templates ADD CONSTRAINT rapor_templates_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.riyadhoh_hadir ADD CONSTRAINT riyadhoh_hadir_dicatat_oleh_fkey FOREIGN KEY (dicatat_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.riyadhoh_hadir ADD CONSTRAINT riyadhoh_hadir_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.riyadhoh_jadwal ADD CONSTRAINT riyadhoh_jadwal_dibuat_oleh_fkey FOREIGN KEY (dibuat_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.riyadhoh_pengampu ADD CONSTRAINT riyadhoh_pengampu_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.riyadhoh_peserta ADD CONSTRAINT riyadhoh_peserta_diubah_oleh_fkey FOREIGN KEY (diubah_oleh) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.riyadhoh_peserta ADD CONSTRAINT riyadhoh_peserta_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.routine_check_konfirmasi ADD CONSTRAINT routine_check_konfirmasi_task_id_period_fkey FOREIGN KEY (task_id, period) REFERENCES routine_task_checks(task_id, period) ON DELETE CASCADE;
ALTER TABLE public.routine_check_konfirmasi ADD CONSTRAINT routine_check_konfirmasi_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.routine_task_checks ADD CONSTRAINT routine_task_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.routine_task_checks ADD CONSTRAINT routine_task_checks_task_id_fkey FOREIGN KEY (task_id) REFERENCES routine_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.routine_task_members ADD CONSTRAINT routine_task_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.routine_task_members ADD CONSTRAINT routine_task_members_task_id_fkey FOREIGN KEY (task_id) REFERENCES routine_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.routine_task_members ADD CONSTRAINT routine_task_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.routine_tasks ADD CONSTRAINT routine_tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.setoran_arsip ADD CONSTRAINT setoran_arsip_diarsipkan_oleh_fkey FOREIGN KEY (diarsipkan_oleh) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.setoran_arsip ADD CONSTRAINT setoran_arsip_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_disahkan_by_fkey FOREIGN KEY (disahkan_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE;
ALTER TABLE public.sprint_goals ADD CONSTRAINT sprint_goals_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE;
ALTER TABLE public.sprint_items ADD CONSTRAINT sprint_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.sprints ADD CONSTRAINT sprints_ditutup_by_fkey FOREIGN KEY (ditutup_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.student_monthly ADD CONSTRAINT student_monthly_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD CONSTRAINT students_current_jilid_id_fkey FOREIGN KEY (current_jilid_id) REFERENCES jilid_levels(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD CONSTRAINT students_current_method_id_fkey FOREIGN KEY (current_method_id) REFERENCES tahsin_methods(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD CONSTRAINT students_current_quran_surat_id_fkey FOREIGN KEY (current_quran_surat_id) REFERENCES surat_master(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD CONSTRAINT students_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE SET NULL;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_ekstra_slot_id_fkey FOREIGN KEY (ekstra_slot_id) REFERENCES ekstra_slot(id) ON DELETE SET NULL;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE SET NULL;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_surat_id_fkey FOREIGN KEY (surat_id) REFERENCES surat_master(id) ON DELETE RESTRICT;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_surat_ke_id_fkey FOREIGN KEY (surat_ke_id) REFERENCES surat_master(id) ON DELETE RESTRICT;
ALTER TABLE public.tahfidz_logs ADD CONSTRAINT tahfidz_logs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
ALTER TABLE public.tahsin_log_materi ADD CONSTRAINT tahsin_log_materi_log_id_fkey FOREIGN KEY (log_id) REFERENCES tahsin_logs(id) ON DELETE CASCADE;
ALTER TABLE public.tahsin_log_materi ADD CONSTRAINT tahsin_log_materi_materi_id_fkey FOREIGN KEY (materi_id) REFERENCES tahsin_materi(id) ON DELETE RESTRICT;
ALTER TABLE public.tahsin_log_materi ADD CONSTRAINT tahsin_log_materi_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_ekstra_slot_id_fkey FOREIGN KEY (ekstra_slot_id) REFERENCES ekstra_slot(id) ON DELETE SET NULL;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE SET NULL;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_jilid_id_fkey FOREIGN KEY (jilid_id) REFERENCES jilid_levels(id) ON DELETE SET NULL;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_method_id_fkey FOREIGN KEY (method_id) REFERENCES tahsin_methods(id) ON DELETE SET NULL;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_quran_surat_id_fkey FOREIGN KEY (quran_surat_id) REFERENCES surat_master(id) ON DELETE SET NULL;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.tahsin_logs ADD CONSTRAINT tahsin_logs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
ALTER TABLE public.tahsin_materi ADD CONSTRAINT tahsin_materi_jilid_id_fkey FOREIGN KEY (jilid_id) REFERENCES jilid_levels(id) ON DELETE CASCADE;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_history ADD CONSTRAINT task_history_changed_by_users_id_fk FOREIGN KEY (changed_by) REFERENCES users(id);
ALTER TABLE public.task_history ADD CONSTRAINT task_history_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_subtasks ADD CONSTRAINT task_subtasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.task_subtasks ADD CONSTRAINT task_subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES users(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES users(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_agenda_id_agenda_items_id_fk FOREIGN KEY (source_agenda_id) REFERENCES agenda_items(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_source_meeting_id_meetings_id_fk FOREIGN KEY (source_meeting_id) REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_verified_by_users_id_fk FOREIGN KEY (verified_by) REFERENCES users(id);
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_halaqoh_id_fkey FOREIGN KEY (halaqoh_id) REFERENCES halaqoh(id) ON DELETE SET NULL;
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.tasmi_logs ADD CONSTRAINT tasmi_logs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT;
ALTER TABLE public.teacher_unit_moves ADD CONSTRAINT teacher_unit_moves_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_unit_moves ADD CONSTRAINT teacher_unit_moves_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE public.teachers ADD CONSTRAINT teachers_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_pengujis ADD CONSTRAINT ujian_pengujis_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_created_by_teacher_fkey FOREIGN KEY (created_by_teacher) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_tahfidz ADD CONSTRAINT ujian_tahfidz_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_tahsin ADD CONSTRAINT ujian_tahsin_created_by_teacher_fkey FOREIGN KEY (created_by_teacher) REFERENCES teachers(id) ON DELETE SET NULL;
ALTER TABLE public.ujian_tahsin ADD CONSTRAINT ujian_tahsin_created_by_user_fkey FOREIGN KEY (created_by_user) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_diverifikasi_by_fkey FOREIGN KEY (diverifikasi_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.verifikasi_riwayat_tahfidz ADD CONSTRAINT verifikasi_riwayat_tahfidz_ujian_id_fkey FOREIGN KEY (ujian_id) REFERENCES ujian_tahfidz(id) ON DELETE SET NULL;

-- ─── Indeks ────────────────────────────────────────────────────────────────

CREATE INDEX absensi_harian_halaqoh_tanggal_idx ON public.absensi_harian USING btree (halaqoh_id, tanggal);
CREATE UNIQUE INDEX academic_terms_satu_yang_berjalan ON public.academic_terms USING btree (is_current) WHERE is_current;
CREATE INDEX agenda_items_papan_idx ON public.agenda_items USING btree (tag) WHERE (diarsipkan_at IS NULL);
CREATE INDEX ekstra_booking_slot_idx ON public.ekstra_booking USING btree (slot_id) WHERE (status = 'aktif'::text);
CREATE INDEX ekstra_booking_status_idx ON public.ekstra_booking USING btree (status, created_at);
CREATE INDEX ekstra_booking_wa_idx ON public.ekstra_booking USING btree (wa_ortu, created_at);
CREATE INDEX ekstra_slot_teacher_idx ON public.ekstra_slot USING btree (teacher_id) WHERE aktif;
CREATE UNIQUE INDEX employees_linked_user_id_unik ON public.employees USING btree (linked_user_id) WHERE ((linked_user_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX employees_username_unik ON public.employees USING btree (username) WHERE (deleted_at IS NULL);
CREATE INDEX finance_accounts_order_idx ON public.finance_accounts USING btree (kind, display_order);
CREATE INDEX finance_funding_trx_idx ON public.finance_funding USING btree (transaction_id);
CREATE INDEX finance_program_plans_period_idx ON public.finance_program_plans USING btree (period);
CREATE INDEX finance_transactions_paid_idx ON public.finance_transactions USING btree (paid_at);
CREATE INDEX finance_transactions_period_idx ON public.finance_transactions USING btree (period, account_id);
CREATE INDEX finance_transactions_piutang_idx ON public.finance_transactions USING btree (status, period) WHERE (status = 'piutang'::finance_payment_status);
CREATE INDEX finance_trust_entries_fund_idx ON public.finance_trust_entries USING btree (fund_id, entry_date);
CREATE INDEX gukar_groups_pengampu_idx ON public.gukar_groups USING btree (pengampu_id);
CREATE INDEX gukar_groups_term_idx ON public.gukar_groups USING btree (term_id, display_order);
CREATE INDEX gukar_monthly_period_idx ON public.gukar_monthly USING btree (period);
CREATE INDEX gukar_monthly_peserta_periode_idx ON public.gukar_monthly USING btree (participant_id, period DESC);
CREATE INDEX gukar_participants_group_idx ON public.gukar_participants USING btree (group_id, full_name);
CREATE INDEX gukar_participants_status_idx ON public.gukar_participants USING btree (status_pegawai) WHERE (status_pegawai IS NOT NULL);
CREATE INDEX halaqoh_jenjang_program_idx ON public.halaqoh USING btree (jenjang, program);
CREATE INDEX halaqoh_sesi_idx ON public.halaqoh USING btree (term_id, sesi);
CREATE INDEX halaqoh_term_idx ON public.halaqoh USING btree (term_id, jenjang);
CREATE INDEX idx_halaqoh_wali ON public.halaqoh USING btree (wali_teacher_id);
CREATE INDEX halaqoh_members_student_idx ON public.halaqoh_members USING btree (student_id);
CREATE INDEX halaqoh_sessions_halaqoh_idx ON public.halaqoh_sessions USING btree (halaqoh_id, day_of_week, start_time);
CREATE INDEX idx_jilid_levels_method ON public.jilid_levels USING btree (method_id);
CREATE INDEX idx_jilid_prom_student ON public.jilid_promotions USING btree (student_id, promotion_date DESC);
CREATE INDEX jilid_promotions_source_idx ON public.jilid_promotions USING btree (source_log_id);
CREATE INDEX jilid_promotions_ujian_idx ON public.jilid_promotions USING btree (source_ujian_id) WHERE (source_ujian_id IS NOT NULL);
CREATE UNIQUE INDEX jilid_promotions_ujian_unik ON public.jilid_promotions USING btree (student_id, source_ujian_id) WHERE (source_ujian_id IS NOT NULL);
CREATE INDEX idx_juz_prom_student ON public.juz_promotions USING btree (student_id);
CREATE INDEX juz_promotions_source_idx ON public.juz_promotions USING btree (source_log_id);
CREATE INDEX kaldik_events_date_idx ON public.kaldik_events USING btree (date);
CREATE UNIQUE INDEX kaldik_events_unik ON public.kaldik_events USING btree (date, title, unit);
CREATE INDEX kaldik_events_year_idx ON public.kaldik_events USING btree (year);
CREATE UNIQUE INDEX kalender_kosong_angkatan_uniq ON public.kalender_kosong USING btree (tanggal, jenjang, tingkat) WHERE (kelas IS NULL);
CREATE INDEX kalender_kosong_jenjang_tanggal_idx ON public.kalender_kosong USING btree (jenjang, tanggal);
CREATE UNIQUE INDEX kalender_kosong_kelas_uniq ON public.kalender_kosong USING btree (tanggal, jenjang, tingkat, kelas) WHERE (kelas IS NOT NULL);
CREATE INDEX kelompok_klasikal_halaqoh_idx ON public.kelompok_klasikal USING btree (halaqoh_id);
CREATE INDEX kpi_banding_guru_idx ON public.kpi_banding USING btree (teacher_id, diajukan_at DESC);
CREATE UNIQUE INDEX kpi_banding_sekali_per_versi ON public.kpi_banding USING btree (kpi_monthly_id, versi_rapor, tingkat);
CREATE INDEX kpi_banding_status_idx ON public.kpi_banding USING btree (status, putusan_batas);
CREATE INDEX kpi_monthly_guru_terbit_idx ON public.kpi_monthly USING btree (teacher_id, status);
CREATE INDEX kpi_monthly_periode_idx ON public.kpi_monthly USING btree (year, month);
CREATE INDEX kpi_monthly_status_idx ON public.kpi_monthly USING btree (unit, year, month, status);
CREATE INDEX kpi_rapor_riwayat_aksi_idx ON public.kpi_rapor_riwayat USING btree (aksi, created_at DESC);
CREATE INDEX kpi_rapor_riwayat_periode_idx ON public.kpi_rapor_riwayat USING btree (teacher_id, year, month, created_at DESC);
CREATE INDEX kpi_rapor_riwayat_rapor_idx ON public.kpi_rapor_riwayat USING btree (kpi_monthly_id, created_at DESC);
CREATE INDEX kurikulum_targets_term_idx ON public.kurikulum_targets USING btree (term_id, jenjang, tingkat);
CREATE INDEX meetings_deleted_idx ON public.meetings USING btree (deleted_at DESC) WHERE (deleted_at IS NOT NULL);
CREATE INDEX meetings_type_date_alive_idx ON public.meetings USING btree (type, date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX notification_reads_user_idx ON public.notification_reads USING btree (user_id);
CREATE INDEX programs_order_idx ON public.programs USING btree (display_order, created_at);
CREATE INDEX rapor_isian_term_idx ON public.rapor_isian USING btree (term_id);
CREATE INDEX rapor_templates_jenjang_jenis_idx ON public.rapor_templates USING btree (jenjang, jenis, aktif);
CREATE INDEX riyadhoh_hadir_tanggal_idx ON public.riyadhoh_hadir USING btree (tanggal);
CREATE INDEX routine_task_checks_period_idx ON public.routine_task_checks USING btree (period);
CREATE INDEX routine_task_checks_period_outcome_idx ON public.routine_task_checks USING btree (period, outcome);
CREATE INDEX routine_task_members_user_idx ON public.routine_task_members USING btree (user_id, status);
CREATE INDEX routine_tasks_owner_idx ON public.routine_tasks USING btree (owner_id, cadence, order_num);
CREATE INDEX setoran_arsip_student_idx ON public.setoran_arsip USING btree (student_id, setoran_date DESC);
CREATE INDEX sprint_items_task_idx ON public.sprint_items USING btree (task_id);
CREATE INDEX student_monthly_period_idx ON public.student_monthly USING btree (period);
CREATE INDEX student_monthly_student_idx ON public.student_monthly USING btree (student_id, period DESC);
CREATE INDEX idx_students_active ON public.students USING btree (is_active);
CREATE INDEX idx_students_halaqoh ON public.students USING btree (halaqoh_id);
CREATE INDEX idx_students_jenjang ON public.students USING btree (jenjang);
CREATE INDEX students_tahsin_drill_idx ON public.students USING btree (tahsin_drill_sejak) WHERE (tahsin_drill_sejak IS NOT NULL);
CREATE INDEX idx_tahfidz_logs_student ON public.tahfidz_logs USING btree (student_id, setoran_date DESC);
CREATE INDEX idx_tahfidz_logs_surat ON public.tahfidz_logs USING btree (surat_id);
CREATE INDEX idx_tahfidz_logs_teacher_date ON public.tahfidz_logs USING btree (teacher_id, setoran_date DESC);
CREATE INDEX tahfidz_logs_ekstra_idx ON public.tahfidz_logs USING btree (ekstra_slot_id, setoran_date) WHERE (ekstra_slot_id IS NOT NULL);
CREATE INDEX tahfidz_logs_riyadhoh_idx ON public.tahfidz_logs USING btree (student_id, setoran_date) WHERE riyadhoh;
CREATE INDEX tahfidz_logs_siswa_tanggal_idx ON public.tahfidz_logs USING btree (student_id, setoran_date);
CREATE INDEX tahsin_log_materi_log_idx ON public.tahsin_log_materi USING btree (log_id);
CREATE INDEX tahsin_log_materi_lulus_idx ON public.tahsin_log_materi USING btree (student_id, materi_id) WHERE (hasil = 'lulus'::materi_hasil);
CREATE INDEX tahsin_log_materi_terakhir_idx ON public.tahsin_log_materi USING btree (student_id, materi_id, created_at DESC);
CREATE INDEX idx_tahsin_logs_date ON public.tahsin_logs USING btree (setoran_date DESC);
CREATE INDEX idx_tahsin_logs_student ON public.tahsin_logs USING btree (student_id, setoran_date DESC);
CREATE INDEX idx_tahsin_logs_teacher_date ON public.tahsin_logs USING btree (teacher_id, setoran_date DESC);
CREATE INDEX tahsin_logs_ekstra_idx ON public.tahsin_logs USING btree (ekstra_slot_id, setoran_date) WHERE (ekstra_slot_id IS NOT NULL);
CREATE INDEX tahsin_logs_quran_idx ON public.tahsin_logs USING btree (student_id, setoran_date DESC) WHERE (quran_halaman IS NOT NULL);
CREATE INDEX tahsin_logs_riyadhoh_idx ON public.tahsin_logs USING btree (student_id, setoran_date) WHERE riyadhoh;
CREATE INDEX tahsin_logs_siswa_tanggal_idx ON public.tahsin_logs USING btree (student_id, setoran_date);
CREATE INDEX tahsin_materi_urut_idx ON public.tahsin_materi USING btree (jilid_id, nomor);
CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id, created_at);
CREATE INDEX task_dependencies_depends_on_idx ON public.task_dependencies USING btree (depends_on_id);
CREATE INDEX task_subtasks_due_date_idx ON public.task_subtasks USING btree (due_date) WHERE (due_date IS NOT NULL);
CREATE INDEX task_subtasks_task_order_idx ON public.task_subtasks USING btree (task_id, order_num);
CREATE INDEX tasks_assigned_by_active_idx ON public.tasks USING btree (assigned_by) WHERE (deleted_at IS NULL);
CREATE INDEX tasks_assigned_to_active_idx ON public.tasks USING btree (assigned_to) WHERE (deleted_at IS NULL);
CREATE INDEX tasks_gantt_range_idx ON public.tasks USING btree (assigned_to, start_date, due_date) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tasmi_logs_student ON public.tasmi_logs USING btree (student_id, setoran_date DESC);
CREATE INDEX idx_tasmi_logs_teacher_date ON public.tasmi_logs USING btree (teacher_id, setoran_date DESC);
CREATE INDEX teacher_unit_moves_guru_idx ON public.teacher_unit_moves USING btree (teacher_id, effective_date DESC);
CREATE INDEX idx_teachers_linked_user ON public.teachers USING btree (linked_user_id);
CREATE INDEX idx_teachers_username ON public.teachers USING btree (username);
CREATE INDEX teachers_active_alive_idx ON public.teachers USING btree (is_active, full_name) WHERE (deleted_at IS NULL);
CREATE INDEX teachers_contract_end_idx ON public.teachers USING btree (contract_end) WHERE ((contract_end IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX teachers_deleted_idx ON public.teachers USING btree (deleted_at DESC) WHERE (deleted_at IS NOT NULL);
CREATE INDEX teachers_kategori_idx ON public.teachers USING btree (kategori_guru) WHERE (deleted_at IS NULL);
CREATE INDEX teachers_lingkup_idx ON public.teachers USING btree (lingkup_penugasan) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX teachers_linked_user_id_unik ON public.teachers USING btree (linked_user_id) WHERE ((linked_user_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX teachers_public_idx ON public.teachers USING btree (is_public, is_active, display_order);
CREATE INDEX teachers_unit_idx ON public.teachers USING btree (unit) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX ujian_pengujis_teacher_unik ON public.ujian_pengujis USING btree (teacher_id) WHERE (teacher_id IS NOT NULL);
CREATE INDEX ujian_tahfidz_belum_terpetakan_idx ON public.ujian_tahfidz USING btree (created_at DESC) WHERE (student_id IS NULL);
CREATE INDEX ujian_tahfidz_jadwal_idx ON public.ujian_tahfidz USING btree (jadwal);
CREATE INDEX ujian_tahfidz_pengaju_guru_idx ON public.ujian_tahfidz USING btree (created_by_teacher);
CREATE INDEX ujian_tahfidz_student_idx ON public.ujian_tahfidz USING btree (student_id, created_at DESC) WHERE (student_id IS NOT NULL);
CREATE INDEX ujian_tahfidz_unit_status_idx ON public.ujian_tahfidz USING btree (unit, status);
CREATE INDEX ujian_tahsin_jadwal_idx ON public.ujian_tahsin USING btree (jadwal);
CREATE INDEX ujian_tahsin_pengaju_guru_idx ON public.ujian_tahsin USING btree (created_by_teacher);
CREATE INDEX ujian_tahsin_unit_status_idx ON public.ujian_tahsin USING btree (unit, status);
CREATE INDEX verifikasi_riwayat_tahfidz_siswa_idx ON public.verifikasi_riwayat_tahfidz USING btree (student_id);

-- ─── Trigger ───────────────────────────────────────────────────────────────

CREATE TRIGGER about_rq_updated_at BEFORE UPDATE ON public.about_rq FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER halaqoh_updated_at BEFORE UPDATE ON public.halaqoh FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER juz_progress_updated_at BEFORE UPDATE ON public.juz_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER kpi_banding_jaga_putusan_trg BEFORE INSERT OR UPDATE ON public.kpi_banding FOR EACH ROW EXECUTE FUNCTION kpi_banding_jaga_putusan();
CREATE TRIGGER kpi_monthly_jaga_terbit_trg BEFORE UPDATE ON public.kpi_monthly FOR EACH ROW EXECUTE FUNCTION kpi_monthly_jaga_terbit();
CREATE TRIGGER news_articles_updated_at BEFORE UPDATE ON public.news_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER program_details_updated_at BEFORE UPDATE ON public.program_details FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tahfidz_logs_aggregate AFTER INSERT ON public.tahfidz_logs FOR EACH ROW EXECUTE FUNCTION upsert_juz_progress_from_tahfidz();
CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ujian_tahfidz_updated_at BEFORE UPDATE ON public.ujian_tahfidz FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ujian_tahfidz_waktu_status BEFORE INSERT OR UPDATE ON public.ujian_tahfidz FOR EACH ROW EXECUTE FUNCTION ujian_catat_waktu_status();
CREATE TRIGGER ujian_tahsin_updated_at BEFORE UPDATE ON public.ujian_tahsin FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ujian_tahsin_waktu_status BEFORE INSERT OR UPDATE ON public.ujian_tahsin FOR EACH ROW EXECUTE FUNCTION ujian_catat_waktu_status();

-- ─── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.about_rq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi_harian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batas_juz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drizzle_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekstra_booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekstra_hadir ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekstra_jenis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ekstra_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_program_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_report_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_trust_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_trust_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gukar_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gukar_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gukar_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_kartu_tersembunyi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halaqoh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halaqoh_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halaqoh_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halaqoh_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jilid_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jilid_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juz_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kaldik_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_kosong ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kalender_pekan_efektif ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_klasikal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelompok_klasikal_anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_banding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_rapor_riwayat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kurikulum_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_isian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riyadhoh_hadir ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riyadhoh_jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riyadhoh_pengampu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riyadhoh_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_check_konfirmasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_task_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_task_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setoran_arsip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surat_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahsin_log_materi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahsin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahsin_materi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahsin_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasmi_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_unit_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_pengujis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_tahfidz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian_tahsin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifikasi_riwayat_tahfidz ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_settings_service_role ON public.site_settings AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Komentar ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.academic_terms.kenaikan_at IS 'Kapan kenaikan kelas dijalankan menuju tahun ajaran ini. NULL = belum. Terisi = kenaikan ditolak, supaya tidak berjalan dua kali.';
COMMENT ON COLUMN public.finance_funding.source_slug IS 'Slug pos pemasukan (finance_accounts.slug, kind=pemasukan) yang membiayai. Disimpan sebagai slug, bukan FK id, supaya kolom matriks laporan lama tidak ikut berubah kalau pos pemasukan dinonaktifkan.';
COMMENT ON COLUMN public.halaqoh.sesi IS 'Sesi belajar 1-3, ditentukan tingkat kelas anggotanya. Jam tiap sesi ada di lib/rq/sesi.ts, bukan di baris ini.';
COMMENT ON COLUMN public.halaqoh.program IS 'Program pemilik kelompok, mis. ''quls'' / ''quls_takhassus''. NULL = reguler.';
COMMENT ON COLUMN public.jilid_levels.baca_quran IS 'Tahap ini ikut mencatat bacaan mushaf (halaman + surat + ayat). True untuk
   semua tahap is_quran, dan untuk Gharib & Tajwid UMMI yang bukunya dihafal
   sambil anak tetap membaca Al-Qur''an.';
COMMENT ON COLUMN public.jilid_promotions.source_log_id IS 'Setoran yang menyebabkan kenaikan ini. Dihapusnya setoran ikut menghapus kenaikan lewat CASCADE. NULL untuk kenaikan yang dicatat manual.';
COMMENT ON COLUMN public.meetings.peserta_izin IS 'Nama peserta yang izin/tidak hadir. participants = yang hadir.';
COMMENT ON COLUMN public.public_posts.image_url IS 'Url publik gambar/flyer post (bucket news-images, folder pengumuman/). NULL = tanpa gambar.';
COMMENT ON COLUMN public.rapor_templates.ttd_koordinator_path IS 'Path objek di bucket signatures (tertutup). NULL = ruang tanda tangan
   dibiarkan kosong untuk ditandatangani basah.';
COMMENT ON TABLE public.riyadhoh_jadwal IS 'Sabtu Riyadhoh dan kelompok yang masuk (L = putra, P = putri). Sabtu tanpa baris = libur.';
COMMENT ON TABLE public.riyadhoh_pengampu IS 'Guru pengampu Riyadhoh per kelompok. Pengampu boleh mencatat kehadiran & setoran peserta kelompoknya, hanya pada Sabtu kelompok itu.';
COMMENT ON TABLE public.riyadhoh_peserta IS 'Pengecualian peserta Riyadhoh. Aturan bawaan: SMP kelas 9, atau kelas 7–8 program QuLS. ikut=false mengeluarkan anak yang memenuhi aturan; ikut=true memasukkan anak di luar aturan.';
COMMENT ON COLUMN public.student_monthly.ujian_tercatat IS 'Ujian yang terjadi pada bulan ini, mis. "Tahfidz 1 juz — Mumtaz". Kosong = tidak ada ujian.';
COMMENT ON COLUMN public.student_monthly.total_hafalan IS 'Capaian hafalan kumulatif seperti yang tercetak di rapor, mis. "Juz 30 · Al-Buruj".';
COMMENT ON COLUMN public.student_monthly.dari_setoran IS 'true = dihitung dari tahsin_logs/tahfidz_logs; false = diketik guru. Menentukan apakah angkanya bisa ditelusuri ke setoran harian.';
COMMENT ON TABLE public.tahsin_log_materi IS 'Materi yang disetor pada satu setoran tahsin, dengan status hafal per materi.
   student_id sengaja didenormalisasi: progres seorang anak dibaca jauh lebih
   sering daripada isi satu setoran, dan tanpa kolom ini setiap pembacaan harus
   melewati tahsin_logs lebih dulu.';
COMMENT ON COLUMN public.tahsin_logs.nilai_tahsin IS 'Skala 0-100 mengikuti cara guru SD menilai. Menggantikan nilai_fashohah/tajwid/kelancaran yang berskala 0-9,9 dan tidak lagi diisi formulir.';
COMMENT ON TABLE public.tahsin_materi IS 'Daftar materi hafalan sebuah buku tahsin (Gharib & Tajwid UMMI). Satu baris =
   satu materi yang disetor anak. nomor = urutan materi di buku, halaman =
   halaman tempat materi itu berada (beberapa materi bisa sehalaman).';
COMMENT ON COLUMN public.teachers.contract_end IS 'Hari terakhir kontrak berlaku (inklusif). Lewat tanggal ini akses login dicabut otomatis oleh getTeacherSession() — guru tetap yayasan dibiarkan NULL agar tidak pernah kedaluwarsa.';
COMMENT ON COLUMN public.teachers.unit IS 'Unit penempatan: sd = SDIT LHI, smp = SMPIT LHI, sd_juara = SD LHI Juara. Kosong untuk pengurus yang tidak terikat satu unit.';
COMMENT ON COLUMN public.ujian_tahfidz.student_id IS 'Siswa yang diuji. NULL = catatan lama yang belum dipetakan (lihat /ujian/pemetaan).';
COMMENT ON COLUMN public.ujian_tahfidz.nama_flyer IS 'Nama singkat untuk flyer & broadcast. NULL = pakai nama_siswa.';

-- ─── Storage: bucket & policy aplikasi ─────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('news-images', 'news-images', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('profile-photos', 'profile-photos', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('program-images', 'program-images', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('rapor-templates', 'rapor-templates', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('signatures', 'signatures', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "program images public read" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'program-images'::text));
