-- ============================================================
-- 1. Kategori keempat: Guru Unit Lain
-- 2. Penguji ujian ditautkan ke guru sungguhan
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • enum kategori_guru  : + nilai 'guru_unit_lain'
--   • ujian_pengujis      : kolom teacher_id (boleh NULL — entri lama)
--
-- ── BAGIAN 1: KATEGORI KEEMPAT ──────────────────────────────
--
-- 0053 menutup tiga rombongan dan menyisakan satu yang tidak terpikir: guru
-- Qur'an yang bertugas di unit selain SD dan SMP. TPAIT LHI, SD LHI Juara, dan
-- SMA LHI masing-masing punya guru Qur'annya sendiri, dan tak satu pun dari
-- ketiga kategori 0053 memuat mereka — bukan Guru RQ, bukan Guru QULS SD, dan
-- jelas bukan Musyrif SMP. Mereka tertinggal di tab "Belum ditentukan" bukan
-- karena SDM belum sempat, melainkan karena tidak ada jawaban yang benar untuk
-- dipilih.
--
-- ── KENAPA SATU NILAI, BUKAN TIGA ───────────────────────────
--
-- Godaannya adalah membuat 'guru_tpait', 'guru_sd_juara', dan 'guru_sma'
-- terpisah. Ditolak, dan alasannya justru prinsip yang sama yang dipakai 0053
-- untuk MEMISAHKAN kategori dari unit.
--
-- Kolom `unit` sudah menyimpan di unit mana seorang guru bertugas, dengan nilai
-- 'paud' (TPAIT LHI), 'sd_juara', dan 'sma' yang persis membedakan ketiganya.
-- Tiga nilai enum kategori yang baru hanya akan menyalin isi kolom sebelahnya —
-- dan salinan itu bisa berbeda dari aslinya. Seorang guru dengan
-- kategori='guru_sma' tapi unit='paud' adalah keadaan yang SAH di tingkat
-- database dan mustahil ditafsirkan siapa pun.
--
-- Yang benar-benar belum tersimpan bukan "di unit mana" melainkan "di bawah
-- siapa": guru-guru ini tidak di bawah RQ, tidak di bawah unit SD, dan tidak
-- mengampu asrama. Itu SATU jawaban, dan unit persisnya tetap dibaca dari
-- kolom `unit` seperti selama ini. Layar yang perlu menyebut sekolahnya sudah
-- punya UNIT_PENUGASAN_LABELS untuk itu.
--
-- ── CATATAN PELAKSANAAN ─────────────────────────────────────
--
-- ALTER TYPE ... ADD VALUE tidak boleh DIPAKAI dalam transaksi yang sama dengan
-- yang menambahkannya (Postgres 12+). Karena itu berkas ini hanya menambah
-- nilainya dan tidak menyentuh baris mana pun — penetapan kategori dilakukan
-- SDM lewat layar /ustadz, sebagaimana 0053.

ALTER TYPE kategori_guru ADD VALUE IF NOT EXISTS 'guru_unit_lain';

-- ── BAGIAN 2: PENGUJI = GURU SUNGGUHAN ──────────────────────
--
-- ujian_pengujis lahir sebagai daftar nama bebas: satu kolom teks, diketik
-- tangan. Sebelas entri yang ada hari ini berbunyi "Ust Akhid", "Usth Erna",
-- "Ust Bahrun (Boarding)" — panggilan sehari-hari, bukan nama yang tercatat di
-- mana pun. Akibatnya daftar penguji dan daftar guru adalah dua semesta yang
-- tidak pernah bertemu:
--
--   • Nama yang salah ketik menjadi penguji baru yang sah, dan tidak ada yang
--     memberi tahu. "Ust Ahkid" akan berdiri rukun di sebelah "Ust Akhid".
--   • Guru yang berganti nama atau bergelar baru tidak ikut berubah di sini.
--   • Tidak ada yang bisa menjawab "ujian apa saja yang diuji Ustadz Akhid?"
--     tanpa mencocokkan teks dengan mata.
--
-- teacher_id menutup ketiganya: penguji baru dipilih dari guru yang benar-benar
-- ada, bukan diketik.
--
-- ── KENAPA `nama` TETAP ADA ─────────────────────────────────
--
-- Kolomnya TIDAK dihapus dan TIDAK diubah jadi turunan teacher_id.
--
-- ujian_tahfidz.penguji dan ujian_tahsin.penguji menyimpan NAMA sebagai teks,
-- bukan id — 49 baris riwayat hari ini berbunyi "Ust Maulana", "Usth Karima
-- (Boarding)", dan seterusnya. Itu keputusan yang benar dan dipertahankan:
-- rapor ujian yang sudah diserahkan harus menyebut nama yang tertulis saat itu,
-- bukan nama yang berlaku hari ini. Guru yang gelarnya bertambah tahun depan
-- tidak boleh mengubah rapor yang sudah dicetak tahun ini.
--
-- Jadi `nama` adalah yang tercetak, teacher_id adalah yang ditunjuk. Keduanya
-- berbeda peran, dan yang lama tidak dibuang hanya karena yang baru datang.
--
-- ── KENAPA teacher_id BOLEH NULL ────────────────────────────
--
-- Sebelas entri lama tidak semuanya bisa dicocokkan dengan yakin — "Ust
-- Maulana" cocok dengan dua guru sekaligus. Memaksa NOT NULL berarti menebak,
-- dan tebakan yang salah di sini menempel pada 30 riwayat ujian. NULL di sini
-- berarti satu hal saja: entri warisan yang belum ditautkan.
--
-- ON DELETE SET NULL, bukan CASCADE: guru yang akunnya dihapus tidak boleh
-- menghapus dirinya dari daftar penguji dan memutus riwayat ujian yang sudah
-- berjalan atas namanya.

ALTER TABLE "ujian_pengujis"
  ADD COLUMN IF NOT EXISTS "teacher_id" uuid
  REFERENCES "teachers"("id") ON DELETE SET NULL;

-- Satu guru satu entri. Parsial pada NULL, sebab entri warisan yang belum
-- tertaut boleh berjumlah berapa pun — yang dilarang adalah satu guru yang
-- sama masuk daftar dua kali.
CREATE UNIQUE INDEX IF NOT EXISTS "ujian_pengujis_teacher_unik"
  ON "ujian_pengujis" ("teacher_id")
  WHERE "teacher_id" IS NOT NULL;

-- ── Data ─────────────────────────────────────────────────────
--
-- Sengaja tidak ada INSERT/UPDATE di sini. Penautan sebelas entri lama dan
-- pendaftaran musyrif/ah baru dijalankan lewat skrip supaya tiap kecocokan
-- nama bisa dilaporkan satu per satu: npm run musyrif:penguji
