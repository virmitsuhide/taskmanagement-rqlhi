# Fase 0 — Foundation Tahsin & Tahfidz

> Status: **DB schema siap. Belum diapply ke Supabase.**
> Setelah ini selesai, lanjut ke Fase 1A (auth guru terpisah).

## Yang Sudah Disiapkan

| File | Isi |
|---|---|
| `drizzle/0004_phase0_tahsin_tahfidz.sql` | Migration incremental — apply ke DB existing |
| `scripts/schema.sql` | Updated canonical schema untuk fresh install |
| `scripts/seed-phase0.ts` | Seed metode tahsin (Tilawati/Ummi/Iqro) + 114 surat |
| `types/index.ts` | TypeScript types untuk semua entity baru |
| `public/mockups/` | Mockup visual referensi UI |

## ERD Singkat

```
                       ┌──────────────────┐
                       │  tahsin_methods  │  (Tilawati, Ummi, Iqro)
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  jilid_levels    │  (Jilid 1..6, Al-Qur'an)
                       └─────────────────┘
                                ▲
                                │ current_jilid_id
┌───────────────┐  wali  ┌──────────────────┐  halaqoh_id  ┌──────────┐
│   teachers    │◄───────┤     halaqoh      │◄─────────────┤ students │
└────┬──────────┘        └────────┬─────────┘              └────┬─────┘
     │                            │ many-to-many                │
     │                  ┌─────────▼─────────┐                   │
     │                  │ halaqoh_teachers  │                   │
     │                  └───────────────────┘                   │
     │                                                          │
     │     teacher_id              ┌──────────┐  student_id     │
     ├────────────────────────────►│ tahsin_  │◄────────────────┤
     │                             │  logs    │                 │
     │                             └──────────┘                 │
     │                                                          │
     │     teacher_id              ┌──────────┐  student_id     │
     ├────────────────────────────►│ tahfidz_ │◄────────────────┤
     │                             │  logs    │                 │
     │                             └────┬─────┘                 │
     │                                  │ trigger               │
     │                                  ▼                       │
     │                             ┌──────────┐  student_id     │
     │                             │ juz_     │◄────────────────┤
     │                             │ progress │                 │
     │                             └──────────┘                 │
     │                                                          │
     │     promoted_by             ┌──────────────────┐         │
     ├────────────────────────────►│ jilid_promotions │◄────────┤
     │                             │ juz_promotions   │         │
     │                             └──────────────────┘         │
     │                                                          │
     │   surat_id ►  surat_master (114 surat, juz_start)         │
```

## Cara Apply ke Supabase

### Pre-requisite
1. File `.env.local` sudah ada dan berisi `DATABASE_URL` (Supabase connection string), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Schema lama (`users`, `tasks`, dst) sudah ter-apply — Fase 0 ini menambah tabel, bukan menggantikan.

### Step 1 — Apply migration

```bash
npm run db:migrate
```

Script ini membaca semua file `drizzle/*.sql` dan apply yang belum ada di tabel `drizzle_migrations`. Sudah idempotent — aman dijalankan ulang.

### Step 2 — Seed data referensi

```bash
npm run seed:phase0
```

Akan mengisi:
- **3 metode tahsin**: Tilawati (default), Ummi, Iqro
- **23 jilid levels** total (6-9 per metode)
- **114 surat** Al-Qur'an dengan `total_ayat` + `juz_start`

Idempotent juga — upsert on conflict.

### Step 3 — Verifikasi

Di Supabase SQL Editor:

```sql
-- Cek metode terisi
select name, (select count(*) from jilid_levels where method_id = tm.id) as jilid_count
from tahsin_methods tm;

-- Cek surat
select count(*) from surat_master;  -- harus 114

-- Cek juz 30 surat-suratnya
select id, name_latin, total_ayat from surat_master where juz_start = 30 order by id;
```

## Keputusan Desain yang Penting

### 1. Tabel `teachers` benar-benar terpisah dari `users`
- Guru pakai login sendiri di `/guru/login` (akan dibuat di Fase 1A)
- Field `linked_user_id` opsional untuk kasus admin yang juga merangkap guru
- Tidak ada FK ke `users` di domain tahsin/tahfidz — semua menunjuk ke `teachers`

### 2. Tahsin & tahfidz adalah tabel berbeda
Alasan: granularitas beda (jilid+halaman vs surat+ayat). Mempersatukan akan menyulitkan query agregat & analitik.

### 3. `juz_progress` adalah aggregate yang di-maintain trigger
Setiap insert ke `tahfidz_logs` dengan `kind='hafalan_baru'` otomatis menambah `ayat_hafal` di `juz_progress`.

**Caveat:** trigger ini **hanya menambah**. Kalau ada koreksi (delete log), perlu recompute manual via server action. Pattern recompute:

```sql
-- Recompute juz_progress untuk satu siswa
delete from juz_progress where student_id = $1;
insert into juz_progress (student_id, juz_number, ayat_hafal, last_setoran_at)
select tl.student_id, sm.juz_start,
       sum(tl.ayat_ke - tl.ayat_dari + 1),
       max(tl.created_at)
from tahfidz_logs tl
join surat_master sm on sm.id = tl.surat_id
where tl.student_id = $1 and tl.kind = 'hafalan_baru'
group by tl.student_id, sm.juz_start;
```

### 4. `current_jilid_id` & `current_jilid_page` di `students`
Denormalisasi sengaja — kita simpan "posisi tahsin sekarang" di tabel siswa supaya tidak perlu query agregat tiap render dashboard. Update via server action saat log baru / kenaikan jilid.

### 5. Surat `id` pakai integer 1-114 (bukan UUID)
Standar industri (semua API Quran pakai number 1-114), lebih ringan di FK, dan stabil — tidak akan ada surat baru.

## Yang Belum Dibuat di Fase 0 (Sesuai Rencana)

- ❌ Halaman `/guru/login` (Fase 1A)
- ❌ Middleware `/guru/*` (Fase 1A)
- ❌ Admin CRUD untuk siswa & halaqoh (Fase 1B)
- ❌ Form setoran fungsional (Fase 2)
- ❌ `lib/auth/teacher-session.ts` (Fase 1A)

## Next Step

```
Fase 1A — Auth Guru Terpisah
├── lib/auth/teacher-session.ts (JWT terpisah, cookie nama beda)
├── app/guru/login/page.tsx
├── app/guru/layout.tsx (guard)
├── app/actions/teacher-auth.ts
└── middleware.ts (split /guru/* validation)
```

Estimasi: 1 hari kerja.

## Catatan Verifikasi

Setelah `npm run db:migrate` dan `npm run seed:phase0` jalan, cek di Supabase Table Editor bahwa tabel-tabel berikut muncul:

- [x] `tahsin_methods` (3 row)
- [x] `jilid_levels` (~23 row)
- [x] `surat_master` (114 row)
- [x] `teachers` (kosong)
- [x] `halaqoh` (kosong)
- [x] `halaqoh_teachers` (kosong)
- [x] `students` (kosong)
- [x] `tahsin_logs` (kosong)
- [x] `tahfidz_logs` (kosong)
- [x] `jilid_promotions` (kosong)
- [x] `juz_promotions` (kosong)
- [x] `juz_progress` (kosong)

Kalau ada error saat apply migration, kemungkinan:
1. **`update_updated_at()` function tidak ada** → jalankan dulu `scripts/schema.sql` original untuk bikin function tersebut, lalu retry migration.
2. **Enum sudah ada** → migration pakai `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL` jadi aman, tapi kalau gagal lain bisa drop dulu: `drop type if exists gender cascade;`.

Jika ragu, restore Supabase ke titik backup terdekat sebelum apply, dan apply via Supabase SQL Editor secara manual file per file.
