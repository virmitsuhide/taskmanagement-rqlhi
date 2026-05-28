-- ============================================================
-- RQ LHI Management System — Database Schema
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- EXTENSIONS
create extension if not exists "pgcrypto";

-- ENUMS
create type user_role as enum (
  'kepala_rq','kumik','sdm','bendahara',
  'koor_ekstra','koor_sd','koor_smp',
  'humas','div_training','new_squad'
);
create type meeting_type as enum (
  'manajemen','kumik','new_squad','koor_sd','koor_smp'
);
create type agenda_tag as enum (
  'keputusan','informasi','hasil_diskusi','tindak_lanjut'
);
create type task_priority as enum ('normal','mendesak','jangka_panjang');
create type task_status as enum ('todo','in_progress','submitted','done','returned');
create type task_source as enum ('rapat','mandiri','home_publik');
create type content_request_type as enum ('flyer_ujian','flyer_lain','video','lain_lain');
create type content_priority as enum ('low','medium','high');
create type content_status as enum ('requested','on_process','finish');
create type public_post_type as enum ('pengumuman','tugas_guru');
create type public_target as enum ('all','sd','smp');

-- USERS
create table users (
  id                uuid primary key default gen_random_uuid(),
  username          text unique not null,
  password_hash     text not null,
  role              user_role not null,
  display_name      text not null,
  email             text,
  can_change_password boolean default true,
  created_at        timestamptz default now()
);

-- MEETINGS
create table meetings (
  id           uuid primary key default gen_random_uuid(),
  type         meeting_type not null,
  subject      text not null,
  date         date not null,
  start_time   time,
  end_time     time,
  location     text,
  mc           text,
  notulis      text,
  participants text[],
  created_by   uuid references users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- AGENDA ITEMS
create table agenda_items (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references meetings(id) on delete cascade,
  order_num    int not null,
  tag          agenda_tag not null,
  discussion   text not null,
  follow_up    text,
  created_at   timestamptz default now()
);

-- TASKS
create table tasks (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  description          text,
  source_type          task_source not null,
  source_meeting_id    uuid references meetings(id),
  source_agenda_id     uuid references agenda_items(id),
  assigned_by          uuid references users(id),
  assigned_to          uuid references users(id),
  public_target        public_target,
  priority             task_priority default 'normal',
  status               task_status default 'todo',
  due_date             date,
  return_notes         text,
  verified_by          uuid references users(id),
  verified_at          timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- TASK HISTORY
create table task_history (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid references tasks(id) on delete cascade,
  changed_by   uuid references users(id),
  old_status   task_status,
  new_status   task_status,
  notes        text,
  created_at   timestamptz default now()
);

-- PUBLIC POSTS
create table public_posts (
  id           uuid primary key default gen_random_uuid(),
  type         public_post_type not null,
  target       public_target not null default 'all',
  title        text not null,
  content      text not null,
  due_date     date,
  created_by   uuid references users(id),
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- CONTENT REQUESTS
create table content_requests (
  id             uuid primary key default gen_random_uuid(),
  request_type   content_request_type not null,
  description    text not null,
  requested_by   uuid references users(id),
  requested_date date not null,
  priority       content_priority,
  status         content_status default 'requested',
  finished_by    uuid references users(id),
  finished_at    timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- PRIVATE NOTES
create table private_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references users(id),
  title        text not null,
  content      text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- NEWS ARTICLES
create table news_articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  excerpt       text,
  thumbnail_url text,
  category      text,
  type          text default 'berita' not null,
  author_id     uuid references users(id) on delete set null,
  is_active     boolean default true not null,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

-- ABOUT RQ
-- Single-row table (id=1) untuk konten halaman "Tentang RQ".
create table about_rq (
  id          smallint primary key default 1 check (id = 1),
  vision      text default '' not null,
  mission     text default '' not null,
  history     text default '' not null,
  updated_at  timestamptz default now() not null,
  updated_by  uuid references users(id) on delete set null
);
insert into about_rq (id) values (1) on conflict (id) do nothing;

-- PROGRAM DETAILS
-- Konten editorial untuk setiap program. Slug cocok dengan PROGRAMS di app/program/_data.ts.
create table program_details (
  slug              text primary key,
  long_description  text default '' not null,
  curriculum        text default '' not null,
  schedule          text default '' not null,
  target_audience   text default '' not null,
  contact_info      text default '' not null,
  updated_at        timestamptz default now() not null,
  updated_by        uuid references users(id) on delete set null
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Catatan: aplikasi menggunakan service role key yang bypass RLS.
-- RLS ini sebagai lapisan keamanan tambahan jika key anon digunakan.
-- ============================================================
alter table users enable row level security;
alter table meetings enable row level security;
alter table agenda_items enable row level security;
alter table tasks enable row level security;
alter table task_history enable row level security;
alter table public_posts enable row level security;
alter table content_requests enable row level security;
alter table private_notes enable row level security;
alter table news_articles enable row level security;
alter table program_details enable row level security;
alter table about_rq enable row level security;

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger meetings_updated_at before update on meetings
  for each row execute function update_updated_at();

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();

create trigger public_posts_updated_at before update on public_posts
  for each row execute function update_updated_at();

create trigger content_requests_updated_at before update on content_requests
  for each row execute function update_updated_at();

create trigger private_notes_updated_at before update on private_notes
  for each row execute function update_updated_at();

create trigger news_articles_updated_at before update on news_articles
  for each row execute function update_updated_at();

create trigger program_details_updated_at before update on program_details
  for each row execute function update_updated_at();

create trigger about_rq_updated_at before update on about_rq
  for each row execute function update_updated_at();

-- ============================================================
-- PHASE 0 — Tahsin & Tahfidz Monitoring
-- ============================================================

-- ENUMS
create type gender as enum ('L','P');
create type jenjang as enum ('paud','sd','smp','sma');
create type tahsin_status as enum ('lulus','ulang');
create type tahfidz_kind as enum ('hafalan_baru','murojaah');

-- TAHSIN METHODS
create table tahsin_methods (
  id           uuid primary key default gen_random_uuid(),
  name         text unique not null,
  description  text,
  is_active    boolean default true not null,
  created_at   timestamptz default now() not null
);

-- JILID LEVELS
create table jilid_levels (
  id           uuid primary key default gen_random_uuid(),
  method_id    uuid not null references tahsin_methods(id) on delete cascade,
  label        text not null,
  order_num    int  not null,
  total_pages  int,
  is_quran     boolean default false not null,
  created_at   timestamptz default now() not null,
  unique (method_id, order_num)
);
create index idx_jilid_levels_method on jilid_levels(method_id);

-- SURAT MASTER (114 surat Al-Qur'an)
create table surat_master (
  id           int primary key,
  name_arabic  text not null,
  name_latin   text not null,
  name_id      text not null,
  total_ayat   int  not null,
  juz_start    int  not null,
  juz_end      int  not null,
  is_makkiyah  boolean not null
);

-- TEACHERS (entity terpisah dari users)
create table teachers (
  id                  uuid primary key default gen_random_uuid(),
  username            text unique not null,
  password_hash       text not null,
  full_name           text not null,
  nip                 text,
  email               text,
  phone               text,
  photo_url           text,
  is_active           boolean default true not null,
  can_change_password boolean default true not null,
  joined_at           date default current_date not null,
  linked_user_id      uuid references users(id) on delete set null,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);
create index idx_teachers_username on teachers(username);
create index idx_teachers_linked_user on teachers(linked_user_id);

-- HALAQOH
create table halaqoh (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  jenjang         jenjang not null,
  wali_teacher_id uuid references teachers(id) on delete set null,
  schedule_note   text,
  is_active       boolean default true not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);
create index idx_halaqoh_wali on halaqoh(wali_teacher_id);

-- HALAQOH ↔ TEACHERS (many-to-many)
create table halaqoh_teachers (
  halaqoh_id  uuid not null references halaqoh(id) on delete cascade,
  teacher_id  uuid not null references teachers(id) on delete cascade,
  role        text default 'pengampu' not null,
  created_at  timestamptz default now() not null,
  primary key (halaqoh_id, teacher_id)
);

-- STUDENTS
create table students (
  id                  uuid primary key default gen_random_uuid(),
  nis                 text unique,
  full_name           text not null,
  gender              gender,
  birth_date          date,
  photo_url           text,
  jenjang             jenjang not null,
  kelas               text,
  halaqoh_id          uuid references halaqoh(id) on delete set null,
  wali_name           text,
  wali_phone          text,
  wali_email          text,
  current_method_id   uuid references tahsin_methods(id) on delete set null,
  current_jilid_id    uuid references jilid_levels(id) on delete set null,
  current_jilid_page  int,
  is_active           boolean default true not null,
  enrolled_at         date default current_date not null,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);
create index idx_students_halaqoh on students(halaqoh_id);
create index idx_students_jenjang on students(jenjang);
create index idx_students_active on students(is_active);

-- TAHSIN LOGS
create table tahsin_logs (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  teacher_id        uuid not null references teachers(id) on delete restrict,
  halaqoh_id        uuid references halaqoh(id) on delete set null,
  setoran_date      date default current_date not null,
  method_id         uuid references tahsin_methods(id) on delete set null,
  jilid_id          uuid references jilid_levels(id) on delete set null,
  halaman           int,
  baris_dari        int,
  baris_ke          int,
  nilai_makhraj     smallint check (nilai_makhraj between 1 and 5),
  nilai_tajwid      smallint check (nilai_tajwid  between 1 and 5),
  nilai_kelancaran  smallint check (nilai_kelancaran between 1 and 5),
  status            tahsin_status default 'lulus' not null,
  catatan           text,
  created_at        timestamptz default now() not null
);
create index idx_tahsin_logs_student      on tahsin_logs(student_id, setoran_date desc);
create index idx_tahsin_logs_teacher_date on tahsin_logs(teacher_id, setoran_date desc);
create index idx_tahsin_logs_date         on tahsin_logs(setoran_date desc);

-- JILID PROMOTIONS
create table jilid_promotions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  from_jilid_id   uuid references jilid_levels(id) on delete set null,
  to_jilid_id     uuid not null references jilid_levels(id) on delete restrict,
  promoted_by     uuid references teachers(id) on delete set null,
  promotion_date  date default current_date not null,
  exam_score      numeric(5,2),
  catatan         text,
  created_at      timestamptz default now() not null
);
create index idx_jilid_prom_student on jilid_promotions(student_id, promotion_date desc);

-- TAHFIDZ LOGS
create table tahfidz_logs (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students(id) on delete cascade,
  teacher_id        uuid not null references teachers(id) on delete restrict,
  halaqoh_id        uuid references halaqoh(id) on delete set null,
  setoran_date      date default current_date not null,
  kind              tahfidz_kind default 'hafalan_baru' not null,
  surat_id          int  not null references surat_master(id) on delete restrict,
  ayat_dari         int  not null,
  ayat_ke           int  not null,
  nilai_makhraj     smallint check (nilai_makhraj between 1 and 5),
  nilai_tajwid      smallint check (nilai_tajwid  between 1 and 5),
  nilai_kelancaran  smallint check (nilai_kelancaran between 1 and 5),
  catatan           text,
  created_at        timestamptz default now() not null,
  check (ayat_ke >= ayat_dari)
);
create index idx_tahfidz_logs_student      on tahfidz_logs(student_id, setoran_date desc);
create index idx_tahfidz_logs_teacher_date on tahfidz_logs(teacher_id, setoran_date desc);
create index idx_tahfidz_logs_surat        on tahfidz_logs(surat_id);

-- JUZ PROGRESS (aggregate per siswa & juz)
create table juz_progress (
  student_id        uuid not null references students(id) on delete cascade,
  juz_number        int  not null check (juz_number between 1 and 30),
  ayat_hafal        int  default 0 not null,
  last_setoran_at   timestamptz,
  mutqin            boolean default false not null,
  updated_at        timestamptz default now() not null,
  primary key (student_id, juz_number)
);

-- JUZ PROMOTIONS
create table juz_promotions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  juz_number      int  not null check (juz_number between 1 and 30),
  promoted_by     uuid references teachers(id) on delete set null,
  promotion_date  date default current_date not null,
  exam_score      numeric(5,2),
  catatan         text,
  created_at      timestamptz default now() not null,
  unique (student_id, juz_number)
);
create index idx_juz_prom_student on juz_promotions(student_id);

-- Aggregate trigger: tahfidz_logs insert → juz_progress ayat_hafal
create or replace function upsert_juz_progress_from_tahfidz()
returns trigger as $$
declare
  v_juz_start int;
  v_ayat_count int;
begin
  if new.kind <> 'hafalan_baru' then
    return new;
  end if;

  select juz_start into v_juz_start from surat_master where id = new.surat_id;
  v_ayat_count := new.ayat_ke - new.ayat_dari + 1;

  insert into juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at, updated_at)
  values (new.student_id, v_juz_start, v_ayat_count, now(), now())
  on conflict (student_id, juz_number)
  do update set
    ayat_hafal       = juz_progress.ayat_hafal + excluded.ayat_hafal,
    last_setoran_at  = excluded.last_setoran_at,
    updated_at       = now();

  return new;
end;
$$ language plpgsql;

create trigger tahfidz_logs_aggregate
  after insert on tahfidz_logs
  for each row execute function upsert_juz_progress_from_tahfidz();

-- Updated_at triggers
create trigger teachers_updated_at     before update on teachers
  for each row execute function update_updated_at();
create trigger halaqoh_updated_at      before update on halaqoh
  for each row execute function update_updated_at();
create trigger students_updated_at     before update on students
  for each row execute function update_updated_at();
create trigger juz_progress_updated_at before update on juz_progress
  for each row execute function update_updated_at();

-- RLS
alter table teachers         enable row level security;
alter table halaqoh          enable row level security;
alter table halaqoh_teachers enable row level security;
alter table students         enable row level security;
alter table tahsin_methods   enable row level security;
alter table jilid_levels     enable row level security;
alter table surat_master     enable row level security;
alter table tahsin_logs      enable row level security;
alter table tahfidz_logs     enable row level security;
alter table jilid_promotions enable row level security;
alter table juz_promotions   enable row level security;
alter table juz_progress     enable row level security;
