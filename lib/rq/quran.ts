/**
 * Daftar surah dan juz awalnya — dipakai menyimpulkan capaian hafalan.
 *
 * Rekap hafalan gukar ditulis bebas oleh pengampu: "Al-Buruj (Juz 30)",
 * "Al-Lahab–Al-Kafirun", "Nuh — selesai". Laporan Eksekutif SDM Juni 2026
 * menyebut ambang "≥ 1 juz" di sana DIESTIMASI dari surah terjauh yang
 * tercatat; tabel ini yang membuat estimasi itu bisa dihitung ulang oleh
 * mesin alih-alih dibaca satu per satu.
 *
 * Hafalan berjalan MUNDUR dari An-Nas ke An-Naba, jadi "terjauh" berarti
 * nomor surah TERKECIL — bukan terbesar.
 */

export interface Surah {
  nomor: number
  nama: string
  /** Juz tempat surah ini dimulai. */
  juz: number
}

/** Nama dan juz awal, berurut dari surah 1. Indeks + 1 = nomor surah. */
const DAFTAR: [nama: string, juz: number][] = [
  ['Al-Fatihah', 1], ['Al-Baqarah', 1], ['Ali Imran', 3], ['An-Nisa', 4],
  ['Al-Maidah', 6], ["Al-An'am", 7], ["Al-A'raf", 8], ['Al-Anfal', 9],
  ['At-Taubah', 10], ['Yunus', 11], ['Hud', 11], ['Yusuf', 12],
  ["Ar-Ra'd", 13], ['Ibrahim', 13], ['Al-Hijr', 14], ['An-Nahl', 14],
  ['Al-Isra', 15], ['Al-Kahf', 15], ['Maryam', 16], ['Taha', 16],
  ['Al-Anbiya', 17], ['Al-Hajj', 17], ["Al-Mu'minun", 18], ['An-Nur', 18],
  ['Al-Furqan', 18], ["Asy-Syu'ara", 19], ['An-Naml', 19], ['Al-Qasas', 20],
  ['Al-Ankabut', 20], ['Ar-Rum', 21], ['Luqman', 21], ['As-Sajdah', 21],
  ['Al-Ahzab', 21], ['Saba', 22], ['Fatir', 22], ['Yasin', 22],
  ['As-Saffat', 23], ['Sad', 23], ['Az-Zumar', 23], ['Gafir', 24],
  ['Fussilat', 24], ['Asy-Syura', 25], ['Az-Zukhruf', 25], ['Ad-Dukhan', 25],
  ['Al-Jasiyah', 25], ['Al-Ahqaf', 26], ['Muhammad', 26], ['Al-Fath', 26],
  ['Al-Hujurat', 26], ['Qaf', 26], ['Az-Zariyat', 26], ['At-Tur', 27],
  ['An-Najm', 27], ['Al-Qamar', 27], ['Ar-Rahman', 27], ["Al-Waqi'ah", 27],
  ['Al-Hadid', 27], ['Al-Mujadalah', 28], ['Al-Hasyr', 28], ['Al-Mumtahanah', 28],
  ['As-Saff', 28], ["Al-Jumu'ah", 28], ['Al-Munafiqun', 28], ['At-Tagabun', 28],
  ['At-Talaq', 28], ['At-Tahrim', 28], ['Al-Mulk', 29], ['Al-Qalam', 29],
  ['Al-Haqqah', 29], ["Al-Ma'arij", 29], ['Nuh', 29], ['Al-Jinn', 29],
  ['Al-Muzzammil', 29], ['Al-Muddassir', 29], ['Al-Qiyamah', 29], ['Al-Insan', 29],
  ['Al-Mursalat', 29], ["An-Naba'", 30], ["An-Nazi'at", 30], ['Abasa', 30],
  ['At-Takwir', 30], ['Al-Infitar', 30], ['Al-Mutaffifin', 30], ['Al-Insyiqaq', 30],
  ['Al-Buruj', 30], ['At-Tariq', 30], ["Al-A'la", 30], ['Al-Gasyiyah', 30],
  ['Al-Fajr', 30], ['Al-Balad', 30], ['Asy-Syams', 30], ['Al-Lail', 30],
  ['Ad-Duha', 30], ['Asy-Syarh', 30], ['At-Tin', 30], ["Al-'Alaq", 30],
  ['Al-Qadr', 30], ['Al-Bayyinah', 30], ['Az-Zalzalah', 30], ["Al-'Adiyat", 30],
  ["Al-Qari'ah", 30], ['At-Takatsur', 30], ["Al-'Asr", 30], ['Al-Humazah', 30],
  ['Al-Fil', 30], ['Quraisy', 30], ["Al-Ma'un", 30], ['Al-Kautsar', 30],
  ['Al-Kafirun', 30], ['An-Nasr', 30], ['Al-Lahab', 30], ['Al-Ikhlas', 30],
  ['Al-Falaq', 30], ['An-Nas', 30],
]

export const SURAH: Surah[] = DAFTAR.map(([nama, juz], i) => ({ nomor: i + 1, nama, juz }))

/** Surah pertama juz 30 — menyentuhnya berarti juz 30 tuntas. */
export const AWAL_JUZ_30 = 78

const ARTIKEL = new Set([
  'al', 'an', 'ar', 'as', 'at', 'az', 'ad', 'asy', 'ash', 'ath', 'adh', 'asz',
  'surah', 'surat', 'qs', 's',
])

/**
 * Samakan ragam transliterasi menjadi satu kunci.
 *
 * Satu surah bisa ditulis "Al-Kautsar" atau "Al-Kawthar", "At-Takatsur" atau
 * "At-Takathur". Huruf ث muncul sebagai ts maupun th, ش sebagai sy maupun sh,
 * ق sebagai q maupun k — jadi semuanya dilipat ke satu bentuk sebelum
 * dibandingkan, bukan didaftar satu per satu sebagai alias.
 */
function lipat(kata: string): string {
  return kata
    .replace(/ts|th/g, 't')
    .replace(/sy|sh/g, 's')
    .replace(/dz/g, 'z')
    .replace(/dh/g, 'd')
    .replace(/q/g, 'k')
    .replace(/w/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/h$/, '')
}

/** Pecah teks menjadi kata bersih, tanpa tanda baca dan angka. */
function kata(teks: string): string[] {
  return teks
    .toLowerCase()
    .replace(/['’`ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** Kunci pencarian satu nama surah: buang artikel di depan, lalu lipat. */
function kunci(nama: string): string {
  const bagian = kata(nama)
  if (bagian.length > 1 && ARTIKEL.has(bagian[0])) bagian.shift()
  return lipat(bagian.join(''))
}

const INDEKS = new Map<string, number>()
for (const s of SURAH) INDEKS.set(kunci(s.nama), s.nomor)

// Ejaan yang tidak tertangkap pelipatan karena akar Arabnya berbeda huruf.
const ALIAS: Record<string, number> = {
  'muddatsir': 74, 'mudatir': 74, 'insirah': 94, 'alamnasrah': 94, 'nasrah': 94,
  'duha': 93, 'masad': 111, 'tabbat': 111, 'lahab': 111, 'dahr': 76,
  'insan': 76, 'tatfif': 83, 'mutaffifin': 83, 'iqra': 96, 'alak': 96,
  'gasiyah': 88, 'kahfi': 18, 'yaasin': 36, 'thaha': 20, 'baqoroh': 2,
}
for (const [nama, nomor] of Object.entries(ALIAS)) {
  if (!INDEKS.has(lipat(nama))) INDEKS.set(lipat(nama), nomor)
}

/**
 * Surah terjauh yang disebut sebuah catatan hafalan.
 *
 * "Terjauh" = nomor terkecil, karena hafalan ditempuh mundur dari An-Nas.
 * Catatan seperti "Al-Lahab–Al-Kafirun" menyebut dua surah; yang dipakai
 * Al-Kafirun (109), sebab itulah batas terjauh yang sudah dicapai.
 */
export function surahTerjauh(teks: string): Surah | null {
  const bagian = kata(teks)
  let terkecil: number | null = null

  for (let i = 0; i < bagian.length; i++) {
    if (/^\d+$/.test(bagian[i])) continue

    // Coba dua kata dulu ("Ali Imran", "Alam Nasyrah") baru satu kata,
    // supaya nama majemuk tidak terpotong jadi kata pertamanya saja.
    const kandidat: string[] = []
    if (i + 1 < bagian.length) {
      const dua = ARTIKEL.has(bagian[i]) ? bagian[i + 1] : bagian[i] + bagian[i + 1]
      kandidat.push(lipat(dua))
    }
    if (!ARTIKEL.has(bagian[i])) kandidat.push(lipat(bagian[i]))

    for (const k of kandidat) {
      const nomor = INDEKS.get(k)
      if (nomor && (terkecil === null || nomor < terkecil)) terkecil = nomor
    }
  }

  return terkecil ? SURAH[terkecil - 1] : null
}

export interface CapaianHafalan {
  /** Juz yang sedang atau sudah ditempuh, mis. 30 atau 29. */
  juz: number | null
  /** Sudah menuntaskan minimal satu juz penuh. */
  minSatuJuz: boolean
  /** Ringkasan singkat untuk ditampilkan, mis. "Juz 30 · Al-Buruj". */
  label: string
}

const KOSONG: CapaianHafalan = { juz: null, minSatuJuz: false, label: '' }

/**
 * Simpulkan capaian hafalan dari catatan bebas pengampu.
 *
 * Ambangnya mengikuti definisi laporan: satu juz dianggap tuntas bila juz 30
 * selesai (sudah menyentuh An-Naba) ATAU sudah masuk juz 29 ke atas. Berhenti
 * di tengah juz 30 — sejauh apa pun — belum terhitung satu juz.
 */
export function hafalanDariTeks(teks: string): CapaianHafalan {
  const bersih = (teks ?? '').trim()
  if (!bersih) return KOSONG
  const rendah = bersih.toLowerCase()

  // "3 juz", "2 Juz" — jumlah juz yang sudah dituntaskan, bukan nomor juz.
  const jumlah = rendah.match(/(\d+)\s*juz/)
  if (jumlah) {
    const n = Number(jumlah[1])
    if (n >= 1 && n <= 30) {
      return { juz: null, minSatuJuz: true, label: `${n} juz tuntas` }
    }
  }

  const surah = surahTerjauh(bersih)
  const nomorJuz = rendah.match(/juz\s*(\d+)/)
  const juz = nomorJuz ? Number(nomorJuz[1]) : (surah?.juz ?? null)
  if (!juz || juz < 1 || juz > 30) {
    return surah
      ? { juz: surah.juz, minSatuJuz: surah.juz <= 29, label: surah.nama }
      : KOSONG
  }

  const selesai = /\b(selesai|tuntas|khatam|lulus)\b/.test(rendah)
  const minSatuJuz =
    juz <= 29 ||
    selesai ||
    (surah !== null && surah.nomor <= AWAL_JUZ_30)

  return {
    juz,
    minSatuJuz,
    label: surah ? `Juz ${juz} · ${surah.nama}` : `Juz ${juz}`,
  }
}

/** Predikat hafalan menurut Peraturan Kepegawaian Yayasan. */
export function predikatHafalan(nilai: number | null): string {
  if (nilai === null || !Number.isFinite(nilai)) return ''
  if (nilai >= 95) return 'Mumtaz'
  if (nilai >= 85) return 'Jayyid Jiddan'
  if (nilai >= 70) return 'Jayyid'
  if (nilai >= 60) return 'Maqbul'
  return 'Belum lulus'
}
