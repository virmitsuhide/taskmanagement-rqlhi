-- ============================================================
-- Pulihkan basis data dari berkas backup (.json.gz) — khusus Kepala RQ
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • pulih_staging       : tabel baru — isi berkas backup yang sedang diunggah
--   • pulih_riwayat       : tabel baru — catatan setiap pemulihan yang diterapkan
--   • pulihkan_backup()   : fungsi baru — simulasi / terapkan pemulihan
--
-- ── KENAPA LEWAT STAGING ────────────────────────────────────
--
-- Berkas backup "semua" bisa puluhan MB setelah dibuka, padahal satu
-- permintaan ke server dibatasi ±4 MB. Maka peramban membuka gzip-nya
-- sendiri lalu mengirim baris per potongan ke pulih_staging. Setelah
-- semua potongan masuk, SATU panggilan pulihkan_backup() menerapkan
-- semuanya dalam SATU transaksi: berhasil seluruhnya, atau tidak ada
-- yang berubah sama sekali. Pemulihan setengah jadi tidak mungkin terjadi.
--
-- ── ARTI "MEMULIHKAN" ───────────────────────────────────────
--
-- Hanya tabel yang ADA di berkas yang disentuh. Untuk tiap tabel itu:
--   1. baris yang tidak ada di berkas dihapus      (anak dulu, lalu induk)
--   2. baris di berkas di-upsert menurut kunci utama (induk dulu, lalu anak)
-- Hapus didahulukan supaya baris baru yang kebetulan memakai nilai unik
-- yang sama (mis. username) tidak bentrok dengan baris dari berkas.
-- Upsert hanya menulis kolom yang ADA di berkas: kolom yang ditambahkan
-- setelah backup dibuat tetap pada nilainya, dan password_hash (tidak
-- pernah ikut backup) tidak tersentuh. Akun yang terhapus sejak backup
-- dibuat kembali dengan sandi tak terpakai '!dipulihkan' (bcrypt.compare
-- selalu false) — Admin perlu mengatur ulang sandinya di /akun.
--
-- Tabel di LUAR berkas bisa ikut berubah lewat ON DELETE CASCADE / SET
-- NULL. Simulasi menghitung selisih baris tabel-tabel itu supaya Kepala RQ
-- melihatnya sebelum menerapkan.
--
-- Simulasi menjalankan pemulihan sungguhan, mengumpulkan angkanya, lalu
-- membatalkan dirinya sendiri (RAISE di dalam blok EXCEPTION = sub-
-- transaksi yang digulung balik). Jadi galat kunci asing dan sejenisnya
-- sudah ketahuan di simulasi, bukan baru saat diterapkan.
-- ============================================================

create table if not exists public.pulih_staging (
  sesi    uuid        not null,
  tabel   text        not null,
  bagian  integer     not null,
  baris   jsonb       not null,
  dibuat  timestamptz not null default now(),
  primary key (sesi, tabel, bagian)
);
alter table public.pulih_staging enable row level security;

create table if not exists public.pulih_riwayat (
  id             uuid        primary key default gen_random_uuid(),
  oleh_id        uuid,
  oleh           text        not null,
  berkas         text,
  bidang         text,
  backup_dibuat  timestamptz,
  hasil          jsonb       not null,
  dibuat         timestamptz not null default now()
);
alter table public.pulih_riwayat enable row level security;

create or replace function public.pulihkan_backup(p_sesi uuid, p_terapkan boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
-- PostgREST menerapkan statement_timeout milik fungsi (bawaan service_role
-- terlalu pendek untuk seluruh basis data).
set statement_timeout = '280s'
as $$
declare
  v_berkas   text[];
  v_tabel    text[];
  v_lewati   text[];
  v_urut     text[] := '{}';
  v_sisa     text[];
  v_siap     text[];
  v_luar     text[];
  v_luar_awal jsonb := '{}';
  v_hasil    jsonb := '{}';
  v_luar_hasil jsonb := '{}';
  v_sedang   text;
  t          text;
  v_tmp      text;
  v_reg      regclass;
  v_pk       text[];
  v_kolom    text[];
  v_isi      text[];
  v_isi_nilai text[];
  v_ubah     text[];
  v_cocok    text;
  v_sql      text;
  v_baru     bigint;
  v_berubah  bigint;
  v_hapus    bigint;
  v_jumlah   bigint;
  v_n        bigint;
  r          record;
  i          integer;
begin
  select array_agg(distinct tabel order by tabel) into v_berkas
  from pulih_staging where sesi = p_sesi;
  if v_berkas is null then
    return jsonb_build_object('ok', false, 'galat', 'Berkas belum terunggah atau sesi sudah kedaluwarsa.');
  end if;

  -- Hanya tabel biasa yang memang ada di skema public. Tabel milik fitur
  -- ini sendiri tidak pernah dipulihkan (riwayat pemulihan tidak boleh
  -- ikut mundur).
  select array_agg(c.relname::text order by c.relname) into v_tabel
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and c.relname = any (v_berkas)
    and c.relname not in ('pulih_staging', 'pulih_riwayat');
  v_tabel := coalesce(v_tabel, '{}');
  select coalesce(array_agg(x order by x), '{}') into v_lewati
  from unnest(v_berkas) x where x <> all (v_tabel);

  -- Urutan induk → anak dari kunci asing antar-tabel di berkas.
  v_sisa := v_tabel;
  while cardinality(v_sisa) > 0 loop
    select coalesce(array_agg(s order by s), '{}') into v_siap
    from unnest(v_sisa) s
    where not exists (
      select 1 from pg_constraint k
      join pg_class anak  on anak.oid  = k.conrelid
      join pg_class induk on induk.oid = k.confrelid
      where k.contype = 'f' and anak.relname = s
        and anak.relnamespace = 'public'::regnamespace
        and induk.relnamespace = 'public'::regnamespace
        and induk.relname <> s
        and induk.relname = any (v_sisa)
    );
    -- Siklus kunci asing: sisanya diurut abjad. Bila urutannya keliru,
    -- galatnya muncul di simulasi dan tidak ada yang berubah.
    if cardinality(v_siap) = 0 then v_siap := v_sisa; end if;
    v_urut := v_urut || v_siap;
    select coalesce(array_agg(s), '{}') into v_sisa from unnest(v_sisa) s where s <> all (v_siap);
  end loop;

  -- Tabel di luar berkas yang menunjuk tabel di berkas — bisa ikut berubah.
  select coalesce(array_agg(distinct anak.relname::text order by anak.relname::text), '{}') into v_luar
  from pg_constraint k
  join pg_class anak  on anak.oid  = k.conrelid
  join pg_class induk on induk.oid = k.confrelid
  where k.contype = 'f'
    and anak.relnamespace = 'public'::regnamespace
    and induk.relnamespace = 'public'::regnamespace
    and induk.relname = any (v_tabel)
    and anak.relname <> all (v_tabel)
    and anak.relname not in ('pulih_staging', 'pulih_riwayat');
  foreach t in array v_luar loop
    execute format('select count(*) from public.%I', t) into v_n;
    v_luar_awal := v_luar_awal || jsonb_build_object(t, v_n);
  end loop;

  begin
    -- 1. Isi berkas → tabel sementara bertipe sama dengan tabel aslinya.
    for i in 1 .. cardinality(v_urut) loop
      t := v_urut[i];
      v_sedang := t;
      execute format(
        'create temp table %I on commit drop as
           select * from jsonb_populate_recordset(null::public.%I,
             (select coalesce(jsonb_agg(e), ''[]''::jsonb)
                from pulih_staging s, jsonb_array_elements(s.baris) e
               where s.sesi = $1 and s.tabel = $2))',
        '_pulih_' || i, t) using p_sesi, t;
    end loop;

    -- 2. Hapus baris yang tidak ada di berkas — anak dulu.
    for i in reverse cardinality(v_urut) .. 1 loop
      t := v_urut[i];
      v_sedang := t;
      v_tmp := '_pulih_' || i;
      v_reg := format('public.%I', t)::regclass;
      select array_agg(a.attname::text order by array_position(x.indkey::int2[], a.attnum)) into v_pk
      from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = any (x.indkey::int2[])
      where x.indrelid = v_reg and x.indisprimary;

      if v_pk is null then
        execute format('delete from public.%I', t);
      else
        select string_agg(format('b.%1$I = x.%1$I', c), ' and ') into v_cocok from unnest(v_pk) c;
        execute format('delete from public.%I x where not exists (select 1 from %I b where %s)', t, v_tmp, v_cocok);
      end if;
      get diagnostics v_hapus = row_count;
      v_hasil := v_hasil || jsonb_build_object(t, jsonb_build_object('dihapus', v_hapus));
    end loop;

    -- 3. Upsert isi berkas — induk dulu.
    for i in 1 .. cardinality(v_urut) loop
      t := v_urut[i];
      v_sedang := t;
      v_tmp := '_pulih_' || i;
      v_reg := format('public.%I', t)::regclass;
      select array_agg(a.attname::text order by array_position(x.indkey::int2[], a.attnum)) into v_pk
      from pg_index x join pg_attribute a on a.attrelid = x.indrelid and a.attnum = any (x.indkey::int2[])
      where x.indrelid = v_reg and x.indisprimary;

      -- Kolom yang tertulis di berkas (semua baris satu tabel berkunci sama).
      select array_agg(k) into v_kolom
      from jsonb_object_keys((
        select s.baris -> 0 from pulih_staging s
        where s.sesi = p_sesi and s.tabel = t and jsonb_array_length(s.baris) > 0
        order by s.bagian limit 1)) k;

      execute format('select count(*) from %I', v_tmp) into v_jumlah;
      v_baru := 0; v_berubah := 0;

      if v_jumlah > 0 and v_kolom is not null then
        v_isi := '{}'; v_isi_nilai := '{}'; v_ubah := '{}';
        for r in
          select a.attname::text as nama, a.attnotnull as wajib, a.atthasdef as ada_bawaan
          from pg_attribute a
          where a.attrelid = v_reg and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
          order by a.attnum
        loop
          if r.nama = any (v_kolom) then
            v_isi := v_isi || r.nama;
            v_isi_nilai := v_isi_nilai || format('%I', r.nama);
            if v_pk is null or r.nama <> all (v_pk) then v_ubah := v_ubah || r.nama; end if;
          elsif r.nama ~* '^(password_hash|.*_secret|.*_token)$' and r.wajib and not r.ada_bawaan then
            -- Kolom rahasia tidak ikut backup; baris yang kembali muncul
            -- mendapat nilai tak terpakai. Tidak masuk SET, jadi baris yang
            -- masih ada tetap memakai sandinya sekarang.
            v_isi := v_isi || r.nama;
            v_isi_nilai := v_isi_nilai || quote_literal('!dipulihkan');
          end if;
        end loop;

        v_sql := format('insert into public.%I as x (%s) overriding system value select %s from %I',
          t,
          (select string_agg(format('%I', c), ', ') from unnest(v_isi) c),
          array_to_string(v_isi_nilai, ', '),
          v_tmp);
        if v_pk is not null then
          if cardinality(v_ubah) > 0 then
            -- Baris yang isinya sama persis tidak ditulis ulang, supaya
            -- angka "berubah" jujur. Dibandingkan sebagai teks karena tipe
            -- json tidak punya operator kesamaan.
            v_sql := v_sql || format(' on conflict (%s) do update set %s where (%s) is distinct from (%s)',
              (select string_agg(format('%I', c), ', ') from unnest(v_pk) c),
              (select string_agg(format('%1$I = excluded.%1$I', c), ', ') from unnest(v_ubah) c),
              (select string_agg(format('x.%I::text', c), ', ') from unnest(v_ubah) c) || ', null::text',
              (select string_agg(format('excluded.%I::text', c), ', ') from unnest(v_ubah) c) || ', null::text');
          else
            v_sql := v_sql || format(' on conflict (%s) do nothing',
              (select string_agg(format('%I', c), ', ') from unnest(v_pk) c));
          end if;
        end if;
        execute format('with r as (%s returning (xmax = 0) as baru) select count(*) filter (where baru), count(*) filter (where not baru) from r', v_sql)
          into v_baru, v_berubah;
      end if;

      -- Urutan nomor (serial/identity) dinaikkan melewati nilai terbesar,
      -- supaya baris baru berikutnya tidak bentrok dengan baris pulihan.
      for r in
        select a.attname::text as nama, pg_get_serial_sequence(format('public.%I', t), a.attname) as urutan
        from pg_attribute a
        where a.attrelid = v_reg and a.attnum > 0 and not a.attisdropped
      loop
        if r.urutan is not null then
          execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', r.urutan, r.nama, t);
        end if;
      end loop;

      v_hasil := jsonb_set(v_hasil, array[t], (v_hasil -> t) || jsonb_build_object(
        'berkas', v_jumlah, 'baru', v_baru, 'berubah', v_berubah));
    end loop;

    foreach t in array v_luar loop
      execute format('select count(*) from public.%I', t) into v_n;
      if v_n <> (v_luar_awal ->> t)::bigint then
        v_luar_hasil := v_luar_hasil || jsonb_build_object(t, jsonb_build_object(
          'sebelum', (v_luar_awal ->> t)::bigint, 'sesudah', v_n));
      end if;
    end loop;

    if not p_terapkan then
      raise exception using errcode = 'P0001', message = 'PULIH_SIMULASI_SELESAI';
    end if;
  exception when others then
    if sqlerrm = 'PULIH_SIMULASI_SELESAI' then
      return jsonb_build_object('ok', true, 'diterapkan', false,
        'tabel', v_hasil, 'luar', v_luar_hasil, 'dilewati', v_lewati);
    end if;
    return jsonb_build_object('ok', false, 'diterapkan', false,
      'galat', sqlerrm, 'tabel_galat', v_sedang, 'dilewati', v_lewati);
  end;

  delete from pulih_staging where sesi = p_sesi;
  return jsonb_build_object('ok', true, 'diterapkan', true,
    'tabel', v_hasil, 'luar', v_luar_hasil, 'dilewati', v_lewati);
end;
$$;

-- Hanya server (service_role) yang boleh memanggil; izin Kepala RQ
-- diperiksa di server action sebelum fungsi ini dipanggil.
revoke all on function public.pulihkan_backup(uuid, boolean) from public, anon, authenticated;
grant execute on function public.pulihkan_backup(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
