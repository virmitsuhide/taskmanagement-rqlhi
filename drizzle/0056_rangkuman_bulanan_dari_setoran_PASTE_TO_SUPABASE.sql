-- ============================================================
-- Rangkuman bulanan diturunkan dari setoran harian
-- ============================================================
-- 📋 CARA PAKAI: Supabase SQL Editor → paste seluruh file → Run.
--    Idempoten (boleh dijalankan ulang).
--
-- Yang berubah:
--   • student_monthly : + ujian_tercatat, total_hafalan, dari_setoran
--
-- ── PERSOALAN YANG DITUTUP ──────────────────────────────────
--
-- Sistem ini punya dua tempat mencatat capaian santri, dan keduanya menuntut
-- pekerjaan yang terpisah:
--
--   tahsin_logs / tahfidz_logs  setoran harian, satu baris tiap pertemuan
--   student_monthly             rangkuman bulanan, DIKETIK ULANG guru
--
-- Angkanya menunjukkan mana yang bertahan. Untuk 694 santri sepanjang satu
-- semester: 17 baris setoran tahsin, 17 baris setoran tahfidz — sementara
-- student_monthly berisi 1.238 baris. Yang harian ditinggalkan, yang bulanan
-- jalan.
--
-- Sebabnya bukan gurunya malas. Mencatat harian tidak memberi keuntungan apa
-- pun kepada yang mencatat: di akhir bulan ia tetap harus mengetik ulang
-- capaian awal, capaian akhir, dan jumlah halaman — dari ingatan atau dari
-- buku, bukan dari yang sudah ia masukkan. Pekerjaan dua kali untuk satu
-- keterangan. Fitur yang meminta lebih tanpa memberi lebih akan selalu kalah
-- oleh cara lama.
--
-- ── YANG DIPILIH: SEMI ──────────────────────────────────────
--
-- Harian dicatat sepanjang bulan; di akhir bulan yang DISIMPAN hanya inti
-- sarinya — dan inti sari itu DIHITUNG dari setoran hariannya, tidak diketik
-- lagi. Mencatat harian jadi menguntungkan yang mencatat: rangkuman bulannya
-- terisi sendiri.
--
-- Tiga kolom yang ditambahkan melengkapi rangkuman itu supaya benar-benar
-- memuat lima hal yang diminta, tidak empat:
--
--   capaian awal bulan   sudah ada  → halaman_awal_tahsin, tahfidz_awal
--   capaian akhir bulan  sudah ada  → halaman_akhir_tahsin, tahfidz_akhir
--   jumlah halaman       sudah ada  → capaian_halaman
--   ujian yang tercatat  BARU       → ujian_tercatat
--   total hafalan        BARU       → total_hafalan
--
-- ── KENAPA TEKS, BUKAN ANGKA ────────────────────────────────
--
-- total_hafalan disimpan sebagai teks ('Juz 30 · Al-Buruj', '3 juz'), bukan
-- angka juz. Capaian hafalan di RQ tidak selalu bulat: seorang anak bisa
-- berada di tengah juz 29 sambil sudah menuntaskan juz 30, dan memaksanya jadi
-- satu bilangan akan membuang justru bagian yang dibaca wali murid di rapor.
-- Angka yang bisa dihitung tetap tersedia dari tahfidz_logs kapan pun
-- diperlukan; yang disimpan di sini adalah yang TERCETAK.
--
-- Alasan yang sama berlaku untuk ujian_tercatat: 'Tahfidz 1 juz — Mumtaz'
-- bermakna utuh bagi pembacanya, sementara satu kolom nilai memaksa jenis
-- ujian, juz, dan predikatnya dipecah ke kolom yang belum tentu terisi.
--
-- ── KENAPA ADA PENANDA SUMBER ───────────────────────────────
--
-- dari_setoran membedakan baris yang DIHITUNG dari setoran harian dengan baris
-- yang diketik tangan. Keduanya sah dan keduanya akan hidup berdampingan
-- bertahun-tahun — 1.238 baris yang sudah ada seluruhnya hasil ketikan.
--
-- Bedanya penting saat angkanya dipertanyakan. Rangkuman hasil hitungan bisa
-- ditelusuri sampai ke baris setoran hari itu; rangkuman ketikan hanya bisa
-- ditanyakan kepada orang yang mengetiknya. Tanpa penanda ini, keduanya tampak
-- sama persis di layar, dan tidak ada yang tahu mana yang bisa ditelusuri.
--
-- DEFAULT false, sebab itulah keadaan seluruh baris lama.

ALTER TABLE "student_monthly"
  ADD COLUMN IF NOT EXISTS "ujian_tercatat" text NOT NULL DEFAULT '';

ALTER TABLE "student_monthly"
  ADD COLUMN IF NOT EXISTS "total_hafalan" text NOT NULL DEFAULT '';

ALTER TABLE "student_monthly"
  ADD COLUMN IF NOT EXISTS "dari_setoran" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "student_monthly"."ujian_tercatat" IS
  'Ujian yang terjadi pada bulan ini, mis. "Tahfidz 1 juz — Mumtaz". Kosong = tidak ada ujian.';
COMMENT ON COLUMN "student_monthly"."total_hafalan" IS
  'Capaian hafalan kumulatif seperti yang tercetak di rapor, mis. "Juz 30 · Al-Buruj".';
COMMENT ON COLUMN "student_monthly"."dari_setoran" IS
  'true = dihitung dari tahsin_logs/tahfidz_logs; false = diketik guru. Menentukan apakah angkanya bisa ditelusuri ke setoran harian.';

-- Dipakai saat merangkum satu halaqoh satu periode sekaligus.
CREATE INDEX IF NOT EXISTS "tahsin_logs_siswa_tanggal_idx"
  ON "tahsin_logs" ("student_id", "setoran_date");
CREATE INDEX IF NOT EXISTS "tahfidz_logs_siswa_tanggal_idx"
  ON "tahfidz_logs" ("student_id", "setoran_date");
