/**
 * Seed Fase 0 — data referensi tahsin/tahfidz (metodologi RQ LHI)
 *  - tahsin_methods: UMMI, KIBAR, Syajaroh (metode lama dinonaktifkan)
 *  - jilid_levels: tahapan per metode (termasuk tahap "Lulus Tahsin")
 *  - surat_master: 114 surat Al-Qur'an + juz_start
 *
 * Prasyarat: migrasi drizzle/0006_tahsin_tahfidz_rqlhi sudah diterapkan
 * (kolom jilid_levels.is_terminal harus sudah ada).
 *
 * Idempotent: aman dijalankan berulang (upsert on conflict).
 * Jalankan: npx tsx scripts/seed-phase0.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// ─── METODE TAHSIN (sesuai metodologi RQ LHI) ────────────────────
// Tahap terakhir tiap metode = "Lulus Tahsin" (is_terminal: true).
// is_quran: true menandai tahap membaca mushaf (tanpa total halaman tetap).
type LevelSeed = { label: string; order_num: number; total_pages: number | null; is_quran: boolean; is_terminal?: boolean }
type MethodSeed = { name: string; description: string; levels: LevelSeed[] }

const METHODS: MethodSeed[] = [
  // UMMI — 6 jilid (40 hal) → Al-Qur'an T1/T2/T3 → Talaqqi Mandiri → Gharib → Tajwid → Lulus
  { name: 'UMMI', description: '6 jilid (40 hal) → Al-Qur’an T1–T3 → Talaqqi Mandiri → Gharib → Tajwid',
    levels: [
      { label: 'Jilid 1', order_num: 1, total_pages: 40, is_quran: false },
      { label: 'Jilid 2', order_num: 2, total_pages: 40, is_quran: false },
      { label: 'Jilid 3', order_num: 3, total_pages: 40, is_quran: false },
      { label: 'Jilid 4', order_num: 4, total_pages: 40, is_quran: false },
      { label: 'Jilid 5', order_num: 5, total_pages: 40, is_quran: false },
      { label: 'Jilid 6', order_num: 6, total_pages: 40, is_quran: false },
      { label: 'Al-Qur’an T1', order_num: 7,  total_pages: null, is_quran: true },
      { label: 'Al-Qur’an T2', order_num: 8,  total_pages: null, is_quran: true },
      { label: 'Al-Qur’an T3', order_num: 9,  total_pages: null, is_quran: true },
      { label: 'Talaqqi Mandiri', order_num: 10, total_pages: null, is_quran: true },
      { label: 'Gharib', order_num: 11, total_pages: 28, is_quran: false },
      { label: 'Tajwid', order_num: 12, total_pages: 28, is_quran: false },
      { label: 'Lulus Tahsin', order_num: 13, total_pages: null, is_quran: false, is_terminal: true },
    ],
  },
  // KIBAR — 3 jilid (38 hal) → Talaqqi Al-Qur'an → Lulus
  { name: 'KIBAR', description: '3 jilid (38 hal) → Talaqqi Al-Qur’an',
    levels: [
      { label: 'Jilid 1', order_num: 1, total_pages: 38, is_quran: false },
      { label: 'Jilid 2', order_num: 2, total_pages: 38, is_quran: false },
      { label: 'Jilid 3', order_num: 3, total_pages: 38, is_quran: false },
      { label: 'Talaqqi Al-Qur’an', order_num: 4, total_pages: null, is_quran: true },
      { label: 'Lulus Tahsin', order_num: 5, total_pages: null, is_quran: false, is_terminal: true },
    ],
  },
  // Syajaroh — 5 jilid (36 hal) → Talaqqi Al-Qur'an → Lulus
  { name: 'Syajaroh', description: '5 jilid (36 hal) → Talaqqi Al-Qur’an',
    levels: [
      { label: 'Jilid 1', order_num: 1, total_pages: 36, is_quran: false },
      { label: 'Jilid 2', order_num: 2, total_pages: 36, is_quran: false },
      { label: 'Jilid 3', order_num: 3, total_pages: 36, is_quran: false },
      { label: 'Jilid 4', order_num: 4, total_pages: 36, is_quran: false },
      { label: 'Jilid 5', order_num: 5, total_pages: 36, is_quran: false },
      { label: 'Talaqqi Al-Qur’an', order_num: 6, total_pages: null, is_quran: true },
      { label: 'Lulus Tahsin', order_num: 7, total_pages: null, is_quran: false, is_terminal: true },
    ],
  },
]

// ─── SURAT MASTER (114 surat) ────────────────────────────────────
// Data sumber: standar mushaf Madinah. juz_start = juz di mana surat dimulai.
// is_makkiyah true = turun di Mekkah, false = Madaniyah.
type SuratSeed = {
  id: number; name_arabic: string; name_latin: string; name_id: string;
  total_ayat: number; juz_start: number; juz_end: number; is_makkiyah: boolean
}

const SURAT: SuratSeed[] = [
  { id: 1,  name_arabic: 'الفاتحة',                name_latin: 'Al-Fatihah',     name_id: 'Pembukaan',           total_ayat: 7,   juz_start: 1,  juz_end: 1,  is_makkiyah: true  },
  { id: 2,  name_arabic: 'البقرة',                       name_latin: 'Al-Baqarah',     name_id: 'Sapi Betina',         total_ayat: 286, juz_start: 1,  juz_end: 3,  is_makkiyah: false },
  { id: 3,  name_arabic: 'آل عمران',                 name_latin: 'Ali Imran',      name_id: 'Keluarga Imran',      total_ayat: 200, juz_start: 3,  juz_end: 4,  is_makkiyah: false },
  { id: 4,  name_arabic: 'النساء',                       name_latin: 'An-Nisa',        name_id: 'Wanita',              total_ayat: 176, juz_start: 4,  juz_end: 6,  is_makkiyah: false },
  { id: 5,  name_arabic: 'المائدة',                 name_latin: 'Al-Maidah',      name_id: 'Hidangan',            total_ayat: 120, juz_start: 6,  juz_end: 7,  is_makkiyah: false },
  { id: 6,  name_arabic: 'الأنعام',                 name_latin: 'Al-An‘am',  name_id: 'Binatang Ternak',     total_ayat: 165, juz_start: 7,  juz_end: 8,  is_makkiyah: true  },
  { id: 7,  name_arabic: 'الأعراف',                 name_latin: 'Al-A‘raf',  name_id: 'Tempat Tinggi',       total_ayat: 206, juz_start: 8,  juz_end: 9,  is_makkiyah: true  },
  { id: 8,  name_arabic: 'الأنفال',                 name_latin: 'Al-Anfal',       name_id: 'Harta Rampasan',      total_ayat: 75,  juz_start: 9,  juz_end: 10, is_makkiyah: false },
  { id: 9,  name_arabic: 'التوبة',                       name_latin: 'At-Taubah',      name_id: 'Pengampunan',         total_ayat: 129, juz_start: 10, juz_end: 11, is_makkiyah: false },
  { id: 10, name_arabic: 'يونس',                                   name_latin: 'Yunus',          name_id: 'Yunus',               total_ayat: 109, juz_start: 11, juz_end: 11, is_makkiyah: true  },
  { id: 11, name_arabic: 'هود',                                         name_latin: 'Hud',            name_id: 'Hud',                 total_ayat: 123, juz_start: 11, juz_end: 12, is_makkiyah: true  },
  { id: 12, name_arabic: 'يوسف',                                   name_latin: 'Yusuf',          name_id: 'Yusuf',               total_ayat: 111, juz_start: 12, juz_end: 13, is_makkiyah: true  },
  { id: 13, name_arabic: 'الرعد',                             name_latin: 'Ar-Ra‘d',   name_id: 'Guruh',               total_ayat: 43,  juz_start: 13, juz_end: 13, is_makkiyah: false },
  { id: 14, name_arabic: 'إبراهيم',                 name_latin: 'Ibrahim',        name_id: 'Ibrahim',             total_ayat: 52,  juz_start: 13, juz_end: 13, is_makkiyah: true  },
  { id: 15, name_arabic: 'الحجر',                             name_latin: 'Al-Hijr',        name_id: 'Hijr',                total_ayat: 99,  juz_start: 14, juz_end: 14, is_makkiyah: true  },
  { id: 16, name_arabic: 'النحل',                             name_latin: 'An-Nahl',        name_id: 'Lebah',               total_ayat: 128, juz_start: 14, juz_end: 14, is_makkiyah: true  },
  { id: 17, name_arabic: 'الإسراء',                 name_latin: 'Al-Isra',        name_id: 'Perjalanan Malam',    total_ayat: 111, juz_start: 15, juz_end: 15, is_makkiyah: true  },
  { id: 18, name_arabic: 'الكهف',                             name_latin: 'Al-Kahf',        name_id: 'Gua',                 total_ayat: 110, juz_start: 15, juz_end: 16, is_makkiyah: true  },
  { id: 19, name_arabic: 'مريم',                                   name_latin: 'Maryam',         name_id: 'Maryam',              total_ayat: 98,  juz_start: 16, juz_end: 16, is_makkiyah: true  },
  { id: 20, name_arabic: 'طه',                                               name_latin: 'Taha',           name_id: 'Taha',                total_ayat: 135, juz_start: 16, juz_end: 16, is_makkiyah: true  },
  { id: 21, name_arabic: 'الأنبياء',           name_latin: 'Al-Anbiya',      name_id: 'Para Nabi',           total_ayat: 112, juz_start: 17, juz_end: 17, is_makkiyah: true  },
  { id: 22, name_arabic: 'الحج',                                   name_latin: 'Al-Hajj',        name_id: 'Haji',                total_ayat: 78,  juz_start: 17, juz_end: 17, is_makkiyah: false },
  { id: 23, name_arabic: 'المؤمنون',           name_latin: 'Al-Mu’minun', name_id: 'Orang Beriman',     total_ayat: 118, juz_start: 18, juz_end: 18, is_makkiyah: true  },
  { id: 24, name_arabic: 'النور',                             name_latin: 'An-Nur',         name_id: 'Cahaya',              total_ayat: 64,  juz_start: 18, juz_end: 18, is_makkiyah: false },
  { id: 25, name_arabic: 'الفرقان',                 name_latin: 'Al-Furqan',      name_id: 'Pembeda',             total_ayat: 77,  juz_start: 18, juz_end: 19, is_makkiyah: true  },
  { id: 26, name_arabic: 'الشعراء',                 name_latin: 'Asy-Syu‘ara', name_id: 'Para Penyair',      total_ayat: 227, juz_start: 19, juz_end: 19, is_makkiyah: true  },
  { id: 27, name_arabic: 'النمل',                             name_latin: 'An-Naml',        name_id: 'Semut',               total_ayat: 93,  juz_start: 19, juz_end: 20, is_makkiyah: true  },
  { id: 28, name_arabic: 'القصص',                             name_latin: 'Al-Qasas',       name_id: 'Kisah',               total_ayat: 88,  juz_start: 20, juz_end: 20, is_makkiyah: true  },
  { id: 29, name_arabic: 'العنكبوت',           name_latin: 'Al-Ankabut',     name_id: 'Laba-laba',           total_ayat: 69,  juz_start: 20, juz_end: 21, is_makkiyah: true  },
  { id: 30, name_arabic: 'الروم',                             name_latin: 'Ar-Rum',         name_id: 'Bangsa Romawi',       total_ayat: 60,  juz_start: 21, juz_end: 21, is_makkiyah: true  },
  { id: 31, name_arabic: 'لقمان',                             name_latin: 'Luqman',         name_id: 'Luqman',              total_ayat: 34,  juz_start: 21, juz_end: 21, is_makkiyah: true  },
  { id: 32, name_arabic: 'السجدة',                       name_latin: 'As-Sajdah',      name_id: 'Sajdah',              total_ayat: 30,  juz_start: 21, juz_end: 21, is_makkiyah: true  },
  { id: 33, name_arabic: 'الأحزاب',                 name_latin: 'Al-Ahzab',       name_id: 'Golongan Bersekutu',  total_ayat: 73,  juz_start: 21, juz_end: 22, is_makkiyah: false },
  { id: 34, name_arabic: 'سبأ',                                         name_latin: 'Saba',           name_id: 'Kaum Saba',           total_ayat: 54,  juz_start: 22, juz_end: 22, is_makkiyah: true  },
  { id: 35, name_arabic: 'فاطر',                                   name_latin: 'Fatir',          name_id: 'Pencipta',            total_ayat: 45,  juz_start: 22, juz_end: 22, is_makkiyah: true  },
  { id: 36, name_arabic: 'يس',                                               name_latin: 'Yasin',          name_id: 'Yasin',               total_ayat: 83,  juz_start: 22, juz_end: 23, is_makkiyah: true  },
  { id: 37, name_arabic: 'الصافات',                 name_latin: 'As-Saffat',      name_id: 'Yang Bershaf-shaf',   total_ayat: 182, juz_start: 23, juz_end: 23, is_makkiyah: true  },
  { id: 38, name_arabic: 'ص',                                                     name_latin: 'Sad',            name_id: 'Sad',                 total_ayat: 88,  juz_start: 23, juz_end: 23, is_makkiyah: true  },
  { id: 39, name_arabic: 'الزمر',                             name_latin: 'Az-Zumar',       name_id: 'Rombongan',           total_ayat: 75,  juz_start: 23, juz_end: 24, is_makkiyah: true  },
  { id: 40, name_arabic: 'غافر',                                   name_latin: 'Gafir',          name_id: 'Pengampun',           total_ayat: 85,  juz_start: 24, juz_end: 24, is_makkiyah: true  },
  { id: 41, name_arabic: 'فصلت',                                   name_latin: 'Fussilat',       name_id: 'Diperjelas',          total_ayat: 54,  juz_start: 24, juz_end: 25, is_makkiyah: true  },
  { id: 42, name_arabic: 'الشورى',                       name_latin: 'Asy-Syura',      name_id: 'Musyawarah',          total_ayat: 53,  juz_start: 25, juz_end: 25, is_makkiyah: true  },
  { id: 43, name_arabic: 'الزخرف',                       name_latin: 'Az-Zukhruf',     name_id: 'Perhiasan',           total_ayat: 89,  juz_start: 25, juz_end: 25, is_makkiyah: true  },
  { id: 44, name_arabic: 'الدخان',                       name_latin: 'Ad-Dukhan',      name_id: 'Kabut',               total_ayat: 59,  juz_start: 25, juz_end: 25, is_makkiyah: true  },
  { id: 45, name_arabic: 'الجاثية',                 name_latin: 'Al-Jasiyah',     name_id: 'Berlutut',            total_ayat: 37,  juz_start: 25, juz_end: 25, is_makkiyah: true  },
  { id: 46, name_arabic: 'الأحقاف',                 name_latin: 'Al-Ahqaf',       name_id: 'Bukit Pasir',         total_ayat: 35,  juz_start: 26, juz_end: 26, is_makkiyah: true  },
  { id: 47, name_arabic: 'محمد',                                   name_latin: 'Muhammad',       name_id: 'Muhammad',            total_ayat: 38,  juz_start: 26, juz_end: 26, is_makkiyah: false },
  { id: 48, name_arabic: 'الفتح',                             name_latin: 'Al-Fath',        name_id: 'Kemenangan',          total_ayat: 29,  juz_start: 26, juz_end: 26, is_makkiyah: false },
  { id: 49, name_arabic: 'الحجرات',                 name_latin: 'Al-Hujurat',     name_id: 'Kamar-kamar',         total_ayat: 18,  juz_start: 26, juz_end: 26, is_makkiyah: false },
  { id: 50, name_arabic: 'ق',                                                     name_latin: 'Qaf',            name_id: 'Qaf',                 total_ayat: 45,  juz_start: 26, juz_end: 26, is_makkiyah: true  },
  { id: 51, name_arabic: 'الذاريات',           name_latin: 'Az-Zariyat',     name_id: 'Angin Menerbangkan',  total_ayat: 60,  juz_start: 26, juz_end: 27, is_makkiyah: true  },
  { id: 52, name_arabic: 'الطور',                             name_latin: 'At-Tur',         name_id: 'Bukit',               total_ayat: 49,  juz_start: 27, juz_end: 27, is_makkiyah: true  },
  { id: 53, name_arabic: 'النجم',                             name_latin: 'An-Najm',        name_id: 'Bintang',             total_ayat: 62,  juz_start: 27, juz_end: 27, is_makkiyah: true  },
  { id: 54, name_arabic: 'القمر',                             name_latin: 'Al-Qamar',       name_id: 'Bulan',               total_ayat: 55,  juz_start: 27, juz_end: 27, is_makkiyah: true  },
  { id: 55, name_arabic: 'الرحمن',                       name_latin: 'Ar-Rahman',      name_id: 'Yang Maha Pengasih',  total_ayat: 78,  juz_start: 27, juz_end: 27, is_makkiyah: true  },
  { id: 56, name_arabic: 'الواقعة',                 name_latin: 'Al-Waqi‘ah',name_id: 'Hari Kiamat',         total_ayat: 96,  juz_start: 27, juz_end: 27, is_makkiyah: true  },
  { id: 57, name_arabic: 'الحديد',                       name_latin: 'Al-Hadid',       name_id: 'Besi',                total_ayat: 29,  juz_start: 27, juz_end: 27, is_makkiyah: false },
  { id: 58, name_arabic: 'المجادلة',           name_latin: 'Al-Mujadilah',   name_id: 'Wanita yang Mengajukan Gugatan', total_ayat: 22, juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 59, name_arabic: 'الحشر',                             name_latin: 'Al-Hasyr',       name_id: 'Pengusiran',          total_ayat: 24,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 60, name_arabic: 'الممتحنة',           name_latin: 'Al-Mumtahanah',  name_id: 'Wanita yang Diuji',   total_ayat: 13,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 61, name_arabic: 'الصف',                                   name_latin: 'As-Saff',        name_id: 'Barisan',             total_ayat: 14,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 62, name_arabic: 'الجمعة',                       name_latin: 'Al-Jumu‘ah',name_id: 'Hari Jumat',          total_ayat: 11,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 63, name_arabic: 'المنافقون',     name_latin: 'Al-Munafiqun',   name_id: 'Orang Munafik',       total_ayat: 11,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 64, name_arabic: 'التغابن',                 name_latin: 'At-Tagabun',     name_id: 'Pengungkapan Kesalahan', total_ayat: 18, juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 65, name_arabic: 'الطلاق',                       name_latin: 'At-Talaq',       name_id: 'Talak',               total_ayat: 12,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 66, name_arabic: 'التحريم',                 name_latin: 'At-Tahrim',      name_id: 'Pengharaman',         total_ayat: 12,  juz_start: 28, juz_end: 28, is_makkiyah: false },
  { id: 67, name_arabic: 'الملك',                             name_latin: 'Al-Mulk',        name_id: 'Kerajaan',            total_ayat: 30,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 68, name_arabic: 'القلم',                             name_latin: 'Al-Qalam',       name_id: 'Pena',                total_ayat: 52,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 69, name_arabic: 'الحاقة',                       name_latin: 'Al-Haqqah',      name_id: 'Hari Kiamat',         total_ayat: 52,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 70, name_arabic: 'المعارج',                 name_latin: 'Al-Ma‘arij',name_id: 'Tempat Naik',         total_ayat: 44,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 71, name_arabic: 'نوح',                                         name_latin: 'Nuh',            name_id: 'Nuh',                 total_ayat: 28,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 72, name_arabic: 'الجن',                                   name_latin: 'Al-Jinn',        name_id: 'Jin',                 total_ayat: 28,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 73, name_arabic: 'المزمل',                       name_latin: 'Al-Muzzammil',   name_id: 'Orang yang Berselimut', total_ayat: 20, juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 74, name_arabic: 'المدثر',                       name_latin: 'Al-Muddassir',   name_id: 'Orang yang Berkemul', total_ayat: 56,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 75, name_arabic: 'القيامة',                 name_latin: 'Al-Qiyamah',     name_id: 'Kiamat',              total_ayat: 40,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 76, name_arabic: 'الإنسان',                 name_latin: 'Al-Insan',       name_id: 'Manusia',             total_ayat: 31,  juz_start: 29, juz_end: 29, is_makkiyah: false },
  { id: 77, name_arabic: 'المرسلات',           name_latin: 'Al-Mursalat',    name_id: 'Malaikat yang Diutus',total_ayat: 50,  juz_start: 29, juz_end: 29, is_makkiyah: true  },
  { id: 78, name_arabic: 'النبأ',                             name_latin: 'An-Naba',        name_id: 'Berita Besar',        total_ayat: 40,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 79, name_arabic: 'النازعات',           name_latin: 'An-Nazi‘at',name_id: 'Malaikat Pencabut Nyawa', total_ayat: 46, juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 80, name_arabic: 'عبس',                                         name_latin: '‘Abasa',    name_id: 'Bermuka Masam',       total_ayat: 42,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 81, name_arabic: 'التكوير',                 name_latin: 'At-Takwir',      name_id: 'Penggulungan',        total_ayat: 29,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 82, name_arabic: 'الانفطار',           name_latin: 'Al-Infitar',     name_id: 'Terbelah',            total_ayat: 19,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 83, name_arabic: 'المطففين',           name_latin: 'Al-Mutaffifin', name_id: 'Orang-orang Curang', total_ayat: 36,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 84, name_arabic: 'الانشقاق',           name_latin: 'Al-Insyiqaq',    name_id: 'Terbelah',            total_ayat: 25,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 85, name_arabic: 'البروج',                       name_latin: 'Al-Buruj',       name_id: 'Gugusan Bintang',     total_ayat: 22,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 86, name_arabic: 'الطارق',                       name_latin: 'At-Tariq',       name_id: 'Yang Datang di Malam Hari', total_ayat: 17, juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 87, name_arabic: 'الأعلى',                       name_latin: 'Al-A‘la',   name_id: 'Yang Paling Tinggi',  total_ayat: 19,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 88, name_arabic: 'الغاشية',                 name_latin: 'Al-Gasyiyah',    name_id: 'Hari Pembalasan',     total_ayat: 26,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 89, name_arabic: 'الفجر',                             name_latin: 'Al-Fajr',        name_id: 'Fajar',               total_ayat: 30,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 90, name_arabic: 'البلد',                             name_latin: 'Al-Balad',       name_id: 'Negeri',              total_ayat: 20,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 91, name_arabic: 'الشمس',                             name_latin: 'Asy-Syams',      name_id: 'Matahari',            total_ayat: 15,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 92, name_arabic: 'الليل',                             name_latin: 'Al-Lail',        name_id: 'Malam',               total_ayat: 21,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 93, name_arabic: 'الضحى',                             name_latin: 'Ad-Duha',        name_id: 'Waktu Dhuha',         total_ayat: 11,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 94, name_arabic: 'الشرح',                             name_latin: 'Asy-Syarh',      name_id: 'Melapangkan',         total_ayat: 8,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 95, name_arabic: 'التين',                             name_latin: 'At-Tin',         name_id: 'Buah Tin',            total_ayat: 8,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 96, name_arabic: 'العلق',                             name_latin: 'Al-‘Alaq',  name_id: 'Segumpal Darah',      total_ayat: 19,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 97, name_arabic: 'القدر',                             name_latin: 'Al-Qadr',        name_id: 'Kemuliaan',           total_ayat: 5,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 98, name_arabic: 'البينة',                       name_latin: 'Al-Bayyinah',    name_id: 'Bukti',               total_ayat: 8,   juz_start: 30, juz_end: 30, is_makkiyah: false },
  { id: 99, name_arabic: 'الزلزلة',                 name_latin: 'Az-Zalzalah',    name_id: 'Gempa',               total_ayat: 8,   juz_start: 30, juz_end: 30, is_makkiyah: false },
  { id: 100,name_arabic: 'العاديات',           name_latin: 'Al-‘Adiyat',name_id: 'Kuda Perang yang Berlari Kencang', total_ayat: 11, juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 101,name_arabic: 'القارعة',                 name_latin: 'Al-Qari‘ah',name_id: 'Hari Kiamat',         total_ayat: 11,  juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 102,name_arabic: 'التكاثر',                 name_latin: 'At-Takasur',     name_id: 'Bermegah-megahan',    total_ayat: 8,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 103,name_arabic: 'العصر',                             name_latin: 'Al-‘Asr',   name_id: 'Masa',                total_ayat: 3,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 104,name_arabic: 'الهمزة',                       name_latin: 'Al-Humazah',     name_id: 'Pengumpat',           total_ayat: 9,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 105,name_arabic: 'الفيل',                             name_latin: 'Al-Fil',         name_id: 'Gajah',               total_ayat: 5,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 106,name_arabic: 'قريش',                                   name_latin: 'Quraisy',        name_id: 'Suku Quraisy',        total_ayat: 4,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 107,name_arabic: 'الماعون',                 name_latin: 'Al-Ma‘un',  name_id: 'Barang yang Berguna', total_ayat: 7,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 108,name_arabic: 'الكوثر',                       name_latin: 'Al-Kausar',      name_id: 'Nikmat yang Banyak',  total_ayat: 3,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 109,name_arabic: 'الكافرون',           name_latin: 'Al-Kafirun',     name_id: 'Orang-orang Kafir',   total_ayat: 6,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 110,name_arabic: 'النصر',                             name_latin: 'An-Nasr',        name_id: 'Pertolongan',         total_ayat: 3,   juz_start: 30, juz_end: 30, is_makkiyah: false },
  { id: 111,name_arabic: 'المسد',                             name_latin: 'Al-Masad',       name_id: 'Tali Sabut',          total_ayat: 5,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 112,name_arabic: 'الإخلاص',                 name_latin: 'Al-Ikhlas',      name_id: 'Memurnikan Keesaan Allah', total_ayat: 4, juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 113,name_arabic: 'الفلق',                             name_latin: 'Al-Falaq',       name_id: 'Waktu Subuh',         total_ayat: 5,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
  { id: 114,name_arabic: 'الناس',                             name_latin: 'An-Nas',         name_id: 'Manusia',             total_ayat: 6,   juz_start: 30, juz_end: 30, is_makkiyah: true  },
]

async function seedMethods() {
  console.log('Seeding tahsin methods & jilid levels...')
  for (const m of METHODS) {
    const { data: existing } = await supabase
      .from('tahsin_methods')
      .select('id')
      .eq('name', m.name)
      .maybeSingle()

    let methodId = existing?.id as string | undefined
    if (!methodId) {
      const { data, error } = await supabase
        .from('tahsin_methods')
        .insert({ name: m.name, description: m.description, is_active: true })
        .select('id')
        .single()
      if (error) { console.error(`  ✗ method ${m.name}: ${error.message}`); continue }
      methodId = data.id
      console.log(`  ✓ method ${m.name} created`)
    } else {
      // Pastikan metode aktif & deskripsi terbaru
      await supabase
        .from('tahsin_methods')
        .update({ description: m.description, is_active: true })
        .eq('id', methodId)
      console.log(`  · method ${m.name} exists (diperbarui)`)
    }

    for (const lvl of m.levels) {
      const { error } = await supabase
        .from('jilid_levels')
        .upsert(
          {
            method_id: methodId, label: lvl.label, order_num: lvl.order_num,
            total_pages: lvl.total_pages, is_quran: lvl.is_quran,
            is_terminal: lvl.is_terminal ?? false,
          },
          { onConflict: 'method_id,order_num' },
        )
      if (error) console.error(`    ✗ ${m.name}/${lvl.label}: ${error.message}`)
    }
    console.log(`    ✓ ${m.levels.length} jilid levels`)
  }
}

async function seedSurat() {
  console.log('\nSeeding 114 surat...')
  const { error } = await supabase
    .from('surat_master')
    .upsert(SURAT, { onConflict: 'id' })
  if (error) {
    console.error(`  ✗ surat seed: ${error.message}`)
    return
  }
  console.log(`  ✓ ${SURAT.length} surat upserted`)
}

/** Nonaktifkan metode lama (Tilawati/Iqro/Ummi placeholder) agar tak muncul di dropdown. */
async function deactivateOldMethods() {
  const keep = METHODS.map(m => `"${m.name}"`).join(',')
  const { data, error } = await supabase
    .from('tahsin_methods')
    .update({ is_active: false })
    .not('name', 'in', `(${keep})`)
    .select('name')
  if (error) { console.error(`  ✗ nonaktifkan metode lama: ${error.message}`); return }
  if (data && data.length > 0) {
    console.log(`  · ${data.length} metode lama dinonaktifkan: ${data.map(d => d.name).join(', ')}`)
  }
}

async function main() {
  await seedMethods()
  await deactivateOldMethods()
  await seedSurat()
  console.log('\nDone.')
}

main().catch(err => {
  console.error('Seed gagal:', err)
  process.exit(1)
})
