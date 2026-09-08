-- ============================================================
-- Kategori guru: Guru RQ, Guru QULS SD, Musyrif/ah SMP
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum baru : kategori_guru
--   • teachers  : kolom kategori_guru (boleh NULL — belum ditentukan)
--
-- ── PERSOALAN YANG DITUTUP ──────────────────────────────────
--
-- Tiga rombongan guru Qur'an hidup berdampingan di tabel yang sama, dan tidak
-- satu pun kolom yang ada bisa membedakannya:
--
--   1. Guru RQ       — di bawah Rumah Qur'an. Bisa ditugaskan ke QULS mana pun:
--                      SD, SMP, maupun SD Juara. Guru QULS SMP seluruhnya
--                      berasal dari sini.
--   2. Guru QULS SD  — hanya mengajar di QULS SD, dan berada di bawah unit SD,
--                      BUKAN di bawah RQ.
--   3. Musyrif/ah SMP — guru Qur'an di jam asrama SMPIT LHI, mengampu halaqoh
--                      khusus santri boarding.
--
-- Yang membedakan mereka bukan tempat mengajar melainkan siapa yang membawahi
-- dan atas dasar apa mereka ditugaskan. Guru RQ dan Guru QULS SD sama-sama bisa
-- berdiri di kelas QULS SD yang sama, di jam yang sama; keduanya ber-unit 'sd';
-- keduanya berlingkup 'unit'. Tidak ada satu pun baris di teachers hari ini
-- yang menyimpan perbedaan itu, jadi tidak ada layar yang bisa menampilkannya.
--
-- ── KENAPA KOLOM KETIGA, BUKAN MENUMPANG YANG ADA ───────────
--
-- Alasannya sama persis dengan yang ditulis 0052, dan sekarang berlaku dua kali.
--
-- Menumpang `unit` ditolak: unit adalah enum jenjang yang juga memikul
-- halaqoh.jenjang, meetings, classes, dan teacher_unit_transfers. Nilai
-- 'guru_quls_sd' di sana akan menjadikan "halaqoh berjenjang guru QULS SD"
-- sebagai keadaan yang SAH di tingkat database padahal tak bermakna apa pun.
-- Lagi pula ketiganya memang punya unit yang benar: Guru QULS SD ber-unit 'sd',
-- Musyrif ber-unit 'smp', dan Guru RQ bisa di mana saja.
--
-- Menumpang `lingkup_penugasan` juga ditolak, meski godaannya lebih besar
-- karena sama-sama menjawab "di bawah siapa". Tapi lingkup menjawabnya untuk
-- keperluan yang sempit dan sudah terpakai: SIAPA YANG MENANDATANGANI RAPOR
-- KPI — koordinator unit atau Kepala RQ. Guru RQ dan Guru QULS SD sama-sama
-- berlingkup 'unit'; menambahkan nilai baru di sana akan mengubah alur
-- pengesahan rapor puluhan guru sebagai efek samping dari perubahan yang tidak
-- pernah membicarakan rapor.
--
-- Jadi teachers kini menyimpan tiga pertanyaan yang berbeda, masing-masing di
-- kolomnya sendiri:
--
--   unit               → rubrik KPI mana yang berlaku baginya
--   lingkup_penugasan  → siapa yang mengesahkan rapornya
--   kategori_guru      → rombongan mana ia, dan siapa yang membawahinya
--
-- ── KENAPA BOLEH NULL ───────────────────────────────────────
--
-- Berbeda dari 0052 yang memilih NOT NULL DEFAULT 'unit'. Di sana nilai bawaan
-- memang benar untuk seluruh baris lama: berlingkup unit adalah keadaan wajar,
-- dan lingkup yayasan adalah pengecualian yang ditetapkan seseorang.
--
-- Di sini tidak ada nilai bawaan yang benar. DEFAULT 'guru_rq' akan menyatakan
-- sesuatu yang tidak diketahui siapa pun tentang setiap baris — dan justru
-- Guru QULS SD serta Musyrif yang sudah bertugas hari ini akan menjadi yang
-- salah label, tanpa seorang pun bisa menunjuk siapa saja mereka. Tab "Guru
-- QULS SD" yang kosong akan terbaca sebagai "belum ada", padahal artinya
-- "belum disortir".
--
-- NULL di sini karena itu tidak bermakna ganda seperti NULL pada `unit` yang
-- ditutup 0052. Ia menjawab satu hal saja: belum ada yang menetapkannya. Itulah
-- yang membuatnya layak disimpan — ia menjadi daftar kerja SDM di tab "Belum
-- ditentukan" pada /ustadz, dan daftar itu menyusut sampai habis.
--
-- ── TIDAK ADA PENEBAKAN OTOMATIS ────────────────────────────
--
-- Sama seperti 0052, dan atas alasan yang sama. unit='smp' menggoda untuk
-- dijadikan penanda Musyrif, tapi guru RQ pun banyak yang ber-unit 'smp' —
-- merekalah yang mengampu QULS SMP. Menebak dari sana akan memindahkan guru RQ
-- menjadi Musyrif tanpa ada yang meminta, dan keliru itu baru ketahuan saat
-- seseorang bertanya kenapa halaqoh boarding diampu orang yang tidak pernah
-- masuk asrama. SDM menetapkannya satu per satu lewat Profil Guru.

-- ── ENUM ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE kategori_guru AS ENUM (
    -- Di bawah Rumah Qur'an. Boleh ditugaskan ke QULS SD, QULS SMP, maupun
    -- SD Juara — unit-nya bisa berpindah tanpa mengubah kategorinya.
    'guru_rq',
    -- Hanya mengajar di QULS SD. Berada di bawah unit SD, bukan di bawah RQ.
    'guru_quls_sd',
    -- Guru Qur'an jam asrama SMPIT LHI; mengampu halaqoh santri boarding.
    'musyrif_smp'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Kolom ────────────────────────────────────────────────────
--
-- Tanpa DEFAULT dan tanpa NOT NULL — lihat "KENAPA BOLEH NULL" di atas.

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "kategori_guru" kategori_guru;

-- Dipakai tab kategori di /ustadz. Sengaja tidak parsial pada NULL: tab "Belum
-- ditentukan" justru menyaring baris NULL, dan indeks yang membuang NULL tidak
-- akan pernah melayani tab yang paling sering dibuka di awal.
CREATE INDEX IF NOT EXISTS "teachers_kategori_idx"
  ON "teachers" ("kategori_guru")
  WHERE "deleted_at" IS NULL;

-- ── Data lama ────────────────────────────────────────────────
--
-- Sengaja dibiarkan NULL seluruhnya. Tidak ada UPDATE di file ini.
