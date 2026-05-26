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
