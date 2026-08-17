# PRD — RQ LHI Task & Tahsin-Tahfidz Management System

> **Status:** dokumen aktif, sumber kebenaran utama untuk kondisi produk & arah
> pengembangan. Menggantikan `docs/PHASE_0_FOUNDATION.md` (diarsipkan, historis
> saja) yang sudah lama tidak mengikuti kecepatan development.
> **Terakhir diupdate:** Agustus 2026.

## 1. Ringkasan Produk

Platform operasional internal untuk **Rumah Qur'an LHI (RQ LHI)** — dua sisi
dalam satu aplikasi Next.js:

1. **Sisi admin/manajemen** — rapat, task tracking, permintaan konten humas,
   pengumuman publik, CMS berita, halaman program & tentang RQ, dashboard
   analitik per divisi.
2. **Sisi guru/tahsin-tahfidz** — portal terpisah untuk ustadz/ustadzah:
   kelola siswa & halaqoh, catat setoran tahsin/tahfidz/tasmi, progress
   per-juz otomatis, rapor siswa yang bisa di-share via link token publik
   (tanpa login, untuk wali santri).

**Bahasa produk:** Indonesia, penuh. **Bahasa dokumentasi:** Indonesia.

## 2. Target Pengguna & Peran

| Peran | Akses |
|---|---|
| 10 role admin (`kepala_rq`, `kumik`, `sdm`, `bendahara`, `koor_ekstra`, `koor_sd`, `koor_smp`, `humas`, `div_training`, `new_squad`) | Sisi admin, dengan permission matrix per-role (`lib/auth/permissions.ts`) — dashboard, hak create/edit/delete per jenis rapat, `canManageHalaqoh` scoped ke jenjang. |
| Guru/ustadz (`teachers`) | Portal `/guru/*` — identitas terpisah dari `users`, tidak overlap kecuali via `linked_user_id` opsional untuk admin yang merangkap guru. |
| Wali santri | Read-only, akses lewat link token publik `/rapor/[token]` — tanpa akun. |

Login admin & guru **satu form terpadu** (`app/actions/auth.ts`) — deteksi
otomatis: cek tabel `users` dulu, lalu `teachers`.

## 3. Modul yang Sudah Berjalan (As-Is)

### Sisi Admin

| Route | Fungsi |
|---|---|
| `dashboard/*` | Landing per divisi + `dashboard/analitik` (umum) dan `dashboard/analitik/tahsin-tahfidz`. |
| `rapat` | CRUD rapat + agenda item, sumber otomatis untuk task. |
| `tasks` (+ `/board`, `/matrix`) | List, Kanban, matrix prioritas/urgensi; detail dengan comment & riwayat status. |
| `humas-request` | Antrian permintaan konten (flyer/video) dengan status workflow. |
| `home-post` | Pengumuman/tugas guru publik, target SD/SMP/all. |
| `notes` | Catatan pribadi per user. |
| `profil` | Ganti email/password sendiri. |
| `news` | CMS berita (create/edit/list/toggle/delete), kategori + tipe, OG image otomatis. |
| `program`, `tentang` | Halaman publik editable (kurikulum, visi-misi, sejarah). |
| `halaqoh`, `siswa`, `ustadz` | CRUD admin untuk data guru/tahsin-tahfidz. |

### Sisi Guru & Tahsin-Tahfidz

| Route | Fungsi |
|---|---|
| `guru` | Dashboard guru, aksi cepat. |
| `guru/siswa`, `guru/siswa/[id]` | Daftar & detail siswa binaan. |
| `guru/setoran/tahsin/baru`, `guru/setoran/tahfidz/baru` | Form input setoran, dengan penilaian fashohah/tajwid/kelancaran (skala 0.5–5, kelipatan setengah bintang). |
| `guru/statistik` | Statistik progress. |
| `guru/siswa/[id]/rapor`, `rapor/[token]` | Rapor siswa + share link publik. |

**Metodologi:** UMMI/KIBAR/Syajaroh untuk tahsin, jilid berjenjang; tahfidz per
surat/ayat dengan jenis setoran (`hafalan_baru`, `murojaah`, `ziyadah`,
`murojaah_baru`, `murojaah_lama`, `tasmi`). `juz_progress` adalah agregat yang
di-maintain trigger DB (hanya menambah — koreksi butuh recompute manual, lihat
`docs/PHASE_0_FOUNDATION.md` untuk pattern-nya).

**Notifikasi email** (Resend) — sudah jalan untuk: task assigned, task
returned, task submitted for review, content request ke humas. **Belum
jalan:** `sendTaskDeadlineReminder` (H-2) sudah ditulis di
`lib/email/reminders.ts` tapi tidak pernah dipanggil dari mana pun — tidak
ada cron/scheduler yang trigger dia. Setengah jadi.

## 4. Arsitektur & Stack Teknis

- **Next.js 16** (App Router, Turbopack dev), **React 19**, **TypeScript**.
- **Database:** Supabase Postgres. **Dua lapis akses data by design:**
  - **Drizzle ORM** (`lib/db/schema.ts`) — domain ops lama: `users`,
    `meetings`, `agenda_items`, `tasks`, `task_history`, `task_comments`,
    `public_posts`, `content_requests`, `private_notes`, `news_articles`.
  - **Raw Supabase client** (`lib/supabase/server.ts`) — domain
    guru/tahsin-tahfidz: `teachers`, `halaqoh`, `students`, dan seluruh
    tabel setoran/progress. Sejak Agustus 2026, tabel-tabel ini **juga**
    terdaftar di `lib/db/schema.ts` untuk type-safety & konsistensi
    tooling, tapi kode aplikasi (`app/actions/setoran.ts`, `teachers.ts`,
    `students.ts`, `halaqoh.ts`) **tetap** pakai Supabase client — split ini
    disengaja, bukan dibongkar (lihat §6).
- **Auth:** custom JWT cookie via `jose` — `rqlhi-session` (admin, 7 hari) dan
  `rqlhi-teacher-session` (guru), diverifikasi di `proxy.ts`. **NextAuth
  sudah dihapus** (Agustus 2026) — sebelumnya terpasang lengkap tapi dead
  code, tidak pernah ter-wire ke satu pun route.
- **Migration:** `scripts/migrate.ts` (custom runner, bukan `drizzle-kit
  migrate`) — baca semua `drizzle/*.sql`, track via tabel `drizzle_migrations`
  sendiri (bukan tabel internal drizzle-kit). Idempotent by tag/filename.
- **Email:** Resend. **Storage:** Supabase Storage (asumsi, untuk foto siswa/guru dsb — pakai kredensial Supabase yang sama).

## 5. Perubahan Terbaru (Log Singkat)

**Agustus 2026** — dua perbaikan fondasi:
1. **NextAuth dihapus** — dead code, tidak pernah dipakai (auth sungguhan
   selalu custom JWT cookie). Commit `bdcf720`.
2. **Schema Drizzle di-baseline ulang** — `lib/db/schema.ts` sebelumnya cuma
   sinkron sampai migration 0002; 16 tabel (seluruh domain guru/tahsin-tahfidz
   + `task_comments`, `program_details`, `about_rq`) ditambahkan berdasarkan
   introspeksi live DB. `drizzle/meta/_journal.json` + snapshot di-reset jadi
   satu baseline bersih (`0008_baseline_full_schema.sql`). Tag migration
   0004-0008 (termasuk varian `_PASTE_TO_SUPABASE` yang belum tercatat)
   didaftarkan ke `drizzle_migrations` supaya tidak ke-run ulang. Terverifikasi:
   `drizzle-kit generate` → "No schema changes, nothing to migrate". Commit
   `ad1bfba`.

**Aturan baru ke depan:** perubahan schema **wajib** lewat
`npm run db:generate` (bukan paste manual ke SQL Editor lagi) → review file
migration yang dihasilkan → `npm run db:migrate`. Kalau koneksi DB langsung
tidak tersedia (mis. environment dengan port 5432 diblokir), fallback ke
paste manual tetap boleh, **tapi wajib** diikuti dengan mendaftarkan tag
filename-nya ke tabel `drizzle_migrations` secara manual (lihat contoh insert
di riwayat commit `ad1bfba`) supaya `db:generate` berikutnya tidak drift lagi.

## 6. Constraint & Debt yang Diketahui (Disengaja / Belum Diselesaikan)

- **Tidak ada automated test** sama sekali di repo ini.
- **Split Drizzle vs raw Supabase client** untuk domain guru/tahsin-tahfidz
  dipertahankan sengaja (§4) — migrasi penuh ke Drizzle relations adalah
  perubahan besar yang menyentuh banyak business logic (`setoran.ts` dkk)
  tanpa jaring pengaman test; tidak dilakukan dalam siklus perbaikan ini.
- **`sendTaskDeadlineReminder`** — fungsi ada, tidak pernah dipanggil, tidak
  ada scheduler.
- **`agent-skills/`** — folder vendored (repo git terpisah), sekarang
  di-gitignore, tidak masuk source project.
- **`docs/PHASE_0_FOUNDATION.md`** — diarsipkan sebagai referensi historis
  (ERD, keputusan desain data model tahsin/tahfidz, cara apply migration awal
  masih valid dibaca), tapi bukan lagi dokumen roadmap aktif.

## 7. Rencana Pengembangan (To-Be — Untuk Didiskusikan)

Belum ada keputusan final di bagian ini — daftar di bawah adalah kandidat,
bukan komitmen.

| Kandidat | Kenapa relevan |
|---|---|
| Selesaikan reminder H-2 deadline task | Fungsi sudah ada, tinggal wiring cron/scheduler — quick win. |
| Automated test untuk business logic kritis | `setoran.ts` (resolusi posisi jilid, trigger juz_progress) adalah logic paling berisiko kalau salah — belum ada test sama sekali. |
| Migrasi domain guru/tahsin-tahfidz ke Drizzle relations sepenuhnya | Sekarang schema-nya sudah terdaftar (§5) tapi business logic masih raw client — unifikasi penuh butuh keputusan terpisah karena besar & berisiko tanpa test. |
| Fitur baru di sisi guru/analitik | Tergantung kebutuhan RQ LHI saat ini — belum digali. |
| Deploy/CI hardening | Tidak ada CI terlihat di repo (`.github/workflows` tidak ada untuk project ini, beda dengan `agent-skills/` yang punya). |

---

*Dokumen ini dimaksudkan untuk terus diupdate seiring keputusan & pengembangan berjalan — bukan snapshot sekali-tulis.*
