/**
 * Aturan baca berkas impor siswa — bebas dependensi xlsx maupun server.
 *
 * Kolomnya sengaja mengikuti formulir Tambah Siswa satu per satu: orang yang
 * pernah mengisi formulir itu tidak perlu belajar susunan baru, dan setiap
 * penambahan kolom di formulir punya satu tempat yang jelas untuk menyusul.
 *
 * Yang ditulis operator di Excel adalah NAMA ('SD', 'UMMI', 'Sesi 1 — Ust.
 * Amru'), bukan UUID. Penerjemahan nama → id terjadi di sini, dan sengaja
 * ketat: nama halaqoh yang tidak dikenali menjadi galat, bukan diam-diam
 * dikosongkan. Impor 700 baris adalah tempat kesalahan sunyi paling mahal.
 */
import { JENJANG_LABELS } from '@/lib/auth/permissions'
import { getProgramsForJenjang, UNIT_LABELS } from '@/lib/rq/programs'
import { methodsForJenjang } from '@/lib/tahsin'
import type { Jenjang } from '@/types'

/** Satu baris siap simpan — bentuknya sama persis dengan yang ditulis formulir. */
export interface BarisSiswa {
  nis: string | null
  full_name: string
  gender: 'L' | 'P' | null
  birth_date: string | null
  jenjang: Jenjang
  kelas: string | null
  program: string | null
  halaqoh_id: string | null
  wali_name: string | null
  wali_phone: string | null
  wali_email: string | null
  current_method_id: string | null
  current_jilid_id: string | null
  current_jilid_page: number | null
}

export interface HasilBaris {
  /** Nomor baris di Excel apa adanya, judul terhitung — supaya operator bisa
   *  langsung menuju barisnya tanpa menghitung ulang. */
  baris: number
  /** Nama seperti tertulis di berkas; tetap tampil walau barisnya gagal. */
  nama: string
  jenjang: string
  kelas: string
  data: BarisSiswa | null
  galat: string[]
  /** Hal yang layak dilihat tapi tidak menghalangi impor. */
  catatan: string[]
}

export interface RujukanImpor {
  allowedJenjang: Jenjang[]
  halaqohList: { id: string; name: string; jenjang: Jenjang }[]
  methods: { id: string; name: string }[]
  jilidLevels: { id: string; label: string; method_id: string; order_num?: number }[]
}

interface Kolom {
  key: keyof BarisSiswa | 'birth_date'
  header: string
  wajib?: boolean
  contoh: string
  petunjuk: string
  lebar: number
  /** Ejaan lain yang ikut diterima, sudah dalam bentuk ternormalisasi. */
  alias?: string[]
}

/** Susunan kolom berkas impor — juga dipakai membangun berkas contoh. */
export const KOLOM_IMPOR: Kolom[] = [
  {
    key: 'full_name', header: 'Nama Lengkap', wajib: true, lebar: 30,
    contoh: 'Ahmad Fauzan Hakim',
    petunjuk: 'Wajib. Baris tanpa nama dilewati.',
    alias: ['nama', 'namasiswa'],
  },
  {
    key: 'nis', header: 'NIS', lebar: 14,
    contoh: '2024001',
    petunjuk: 'Boleh kosong. Harus unik — NIS yang sudah dipakai akan ditolak.',
  },
  {
    key: 'gender', header: 'Jenis Kelamin', lebar: 14,
    contoh: 'L',
    petunjuk: "L atau P. Boleh juga ditulis 'Laki-laki' / 'Perempuan'.",
    alias: ['jk', 'lp', 'kelamin'],
  },
  {
    key: 'birth_date', header: 'Tanggal Lahir', lebar: 14,
    contoh: '2015-03-21',
    petunjuk: 'Format tanggal Excel, atau ketik 2015-03-21 / 21-03-2015.',
    alias: ['tgllahir', 'lahir'],
  },
  {
    key: 'jenjang', header: 'Jenjang', wajib: true, lebar: 12,
    contoh: 'SD',
    petunjuk: 'Wajib. Lihat sheet Daftar Pilihan.',
    alias: ['unit'],
  },
  {
    key: 'kelas', header: 'Kelas', lebar: 10,
    contoh: '4A',
    petunjuk: 'Bebas, mis. 4A. Tulis sebagai teks agar tidak berubah jadi 4.0.',
  },
  {
    key: 'program', header: 'Program', lebar: 20,
    contoh: 'QULS',
    petunjuk: 'Harus cocok dengan jenjangnya. Lihat sheet Daftar Pilihan.',
  },
  {
    key: 'halaqoh_id', header: 'Halaqoh', lebar: 30,
    contoh: 'Sesi 1 — Ust. Amru',
    petunjuk: 'Nama halaqoh persis seperti di sheet Daftar Pilihan.',
    alias: ['halaqoh', 'namahalaqoh'],
  },
  {
    key: 'current_method_id', header: 'Metode', lebar: 12,
    contoh: 'UMMI',
    petunjuk: 'UMMI / KIBAR / Syajaroh, sesuai jenjang. Boleh kosong.',
    alias: ['metode', 'metodetahsin'],
  },
  {
    key: 'current_jilid_id', header: 'Jilid', lebar: 16,
    contoh: 'Jilid 3',
    petunjuk: 'Harus milik metode di atas. Boleh kosong.',
    alias: ['jilid'],
  },
  {
    key: 'current_jilid_page', header: 'Halaman', lebar: 10,
    contoh: '12',
    petunjuk: 'Angka halaman jilid. Boleh kosong.',
    alias: ['halaman', 'hal'],
  },
  {
    key: 'wali_name', header: 'Nama Wali', lebar: 26,
    contoh: 'Bapak Suryanto',
    petunjuk: 'Boleh kosong.',
    alias: ['wali', 'namaortu', 'namaorangtua'],
  },
  {
    key: 'wali_phone', header: 'No. HP Wali', lebar: 18,
    contoh: '081234567890',
    petunjuk: 'Boleh kosong. Tulis sebagai teks agar angka 0 di depan tidak hilang.',
    alias: ['nohp', 'nohpwa', 'wa', 'nowa', 'telepon', 'hpwali'],
  },
  {
    key: 'wali_email', header: 'Email Wali', lebar: 26,
    contoh: 'suryanto@gmail.com',
    petunjuk: 'Boleh kosong.',
    alias: ['email', 'emailortu'],
  },
]

/** Judul kolom dicocokkan longgar: 'No. HP Wali', 'no_hp_wali', dan 'NO HP WALI' sama saja. */
function normal(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function teks(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return tanggalISO(v)
  return String(v).trim()
}

function tanggalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Tanggal lahir dari sel yang bentuknya bisa apa saja.
 *
 * Excel menyimpan tanggal sebagai angka hari sejak 1899-12-30, tapi kolom yang
 * pernah disalin-tempel sering tinggal teks. Ketiganya diterima; yang ambigu
 * ('03/04/2015' bisa Maret atau April) dibaca hari-dulu mengikuti kebiasaan
 * penulisan di sini, dan itu disebutkan di petunjuk berkas contoh.
 */
function bacaTanggal(v: unknown): { nilai: string | null; galat?: string } {
  if (v === null || v === undefined || v === '') return { nilai: null }
  if (v instanceof Date) return { nilai: tanggalISO(v) }

  if (typeof v === 'number') {
    if (v < 1 || v > 60000) return { nilai: null, galat: 'Tanggal Lahir tidak terbaca.' }
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return { nilai: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` }
  }

  const s = String(v).trim()
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    return { nilai: `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}` }
  }
  const lokal = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (lokal) {
    const hari = Number(lokal[1]), bulan = Number(lokal[2])
    if (hari > 31 || bulan > 12) return { nilai: null, galat: `Tanggal Lahir '${s}' tidak masuk akal.` }
    return { nilai: `${lokal[3]}-${lokal[2].padStart(2, '0')}-${lokal[1].padStart(2, '0')}` }
  }
  return { nilai: null, galat: `Tanggal Lahir '${s}' tidak terbaca — pakai 2015-03-21 atau 21-03-2015.` }
}

/** Semua ejaan jenjang yang diterima: kode, label pendek, dan label unit panjang. */
function petaJenjang(): Map<string, Jenjang> {
  const peta = new Map<string, Jenjang>()
  for (const j of Object.keys(JENJANG_LABELS) as Jenjang[]) {
    peta.set(normal(j), j)
    peta.set(normal(JENJANG_LABELS[j]), j)
    peta.set(normal(UNIT_LABELS[j]), j)
  }
  return peta
}

const JENJANG_ALIAS = petaJenjang()

/**
 * Baca satu baris berkas menjadi data siap simpan, atau kumpulan alasan
 * mengapa tidak bisa.
 *
 * Galat dikumpulkan semuanya, tidak berhenti di yang pertama: operator yang
 * memperbaiki berkas ingin melihat seluruh masalah satu baris sekaligus, bukan
 * mengunggah ulang lima kali untuk lima kolom.
 */
export function periksaBaris(
  mentah: Record<string, unknown>,
  baris: number,
  rujukan: RujukanImpor,
): HasilBaris {
  // Kunci objek dari sheet_to_json masih judul asli; dinormalkan dulu supaya
  // pencocokan tidak bergantung pada spasi & tanda baca di berkas operator.
  const sel = new Map<string, unknown>()
  for (const [k, v] of Object.entries(mentah)) sel.set(normal(k), v)

  const ambil = (kol: Kolom): unknown => {
    const utama = sel.get(normal(kol.header))
    if (utama !== undefined) return utama
    for (const a of kol.alias ?? []) {
      const v = sel.get(a)
      if (v !== undefined) return v
    }
    return null
  }
  const kolom = (key: Kolom['key']) => KOLOM_IMPOR.find(k => k.key === key)!
  const str = (key: Kolom['key']) => teks(ambil(kolom(key)))

  const galat: string[] = []
  const catatan: string[] = []

  const full_name = str('full_name')
  const jenjangTeks = str('jenjang')
  const kelas = str('kelas')

  const gagal = (): HasilBaris => ({
    baris, nama: full_name, jenjang: jenjangTeks, kelas, data: null, galat, catatan,
  })

  if (!full_name) galat.push('Nama Lengkap kosong.')

  const jenjang = JENJANG_ALIAS.get(normal(jenjangTeks))
  if (!jenjangTeks) galat.push('Jenjang kosong.')
  else if (!jenjang) galat.push(`Jenjang '${jenjangTeks}' tidak dikenal.`)
  else if (!rujukan.allowedJenjang.includes(jenjang)) {
    galat.push(`Anda tidak berwenang menambah siswa ${JENJANG_LABELS[jenjang]}.`)
  }

  // Sisa kolom bergantung jenjang (program, metode, halaqoh), jadi tanpa
  // jenjang yang sah tidak ada yang bisa diperiksa lebih jauh.
  if (!jenjang || galat.length > 0) return gagal()

  // ── Jenis kelamin ──
  const genderTeks = normal(str('gender'))
  let gender: 'L' | 'P' | null = null
  if (genderTeks) {
    if (genderTeks === 'l' || genderTeks.startsWith('laki')) gender = 'L'
    else if (genderTeks === 'p' || genderTeks.startsWith('perempuan')) gender = 'P'
    else galat.push(`Jenis Kelamin '${str('gender')}' tidak dikenal — isi L atau P.`)
  }

  // ── Tanggal lahir ──
  const tgl = bacaTanggal(ambil(kolom('birth_date')))
  if (tgl.galat) galat.push(tgl.galat)

  // ── Program ──
  const programTeks = str('program')
  let program: string | null = null
  if (programTeks) {
    const opsi = getProgramsForJenjang(jenjang)
    const cocok = opsi.find(p => normal(p.code) === normal(programTeks) || normal(p.label) === normal(programTeks))
    if (cocok) program = cocok.code
    else if (opsi.length === 0) galat.push(`Jenjang ${JENJANG_LABELS[jenjang]} tidak punya program.`)
    else galat.push(`Program '${programTeks}' tidak berlaku untuk ${JENJANG_LABELS[jenjang]}.`)
  }

  // ── Halaqoh ── dicocokkan di dalam jenjangnya saja: nama halaqoh berulang
  // antar unit, dan yang benar selalu yang sejenjang dengan siswanya.
  const halaqohTeks = str('halaqoh_id')
  let halaqoh_id: string | null = null
  if (halaqohTeks) {
    const sejenjang = rujukan.halaqohList.filter(h => h.jenjang === jenjang)
    const cocok = sejenjang.filter(h => normal(h.name) === normal(halaqohTeks))
    if (cocok.length === 1) halaqoh_id = cocok[0].id
    else if (cocok.length > 1) galat.push(`Ada ${cocok.length} halaqoh bernama '${halaqohTeks}' di ${JENJANG_LABELS[jenjang]}.`)
    else galat.push(`Halaqoh '${halaqohTeks}' tidak ada di ${JENJANG_LABELS[jenjang]}.`)
  }

  // ── Metode & jilid ──
  const metodeTeks = str('current_method_id')
  let current_method_id: string | null = null
  if (metodeTeks) {
    const berlaku = methodsForJenjang(jenjang, rujukan.methods)
    const cocok = berlaku.find(m => normal(m.name) === normal(metodeTeks))
    if (cocok) current_method_id = cocok.id
    else {
      const daftar = berlaku.map(m => m.name).join(', ') || '—'
      galat.push(`Metode '${metodeTeks}' tidak berlaku untuk ${JENJANG_LABELS[jenjang]} (pilihan: ${daftar}).`)
    }
  }

  const jilidTeks = str('current_jilid_id')
  let current_jilid_id: string | null = null
  if (jilidTeks) {
    // Metode yang diisi tapi ditolak sudah punya galatnya sendiri; menambah
    // 'Metode kosong' di sini hanya membingungkan orang yang membacanya.
    if (!current_method_id) {
      if (!metodeTeks) galat.push('Jilid diisi tapi Metode kosong.')
    } else {
      const cocok = rujukan.jilidLevels.find(
        j => j.method_id === current_method_id && normal(j.label) === normal(jilidTeks),
      )
      if (cocok) current_jilid_id = cocok.id
      else galat.push(`Jilid '${jilidTeks}' bukan milik metode ${metodeTeks}.`)
    }
  }

  const halamanTeks = str('current_jilid_page')
  let current_jilid_page: number | null = null
  if (halamanTeks) {
    const n = Number(halamanTeks)
    if (!Number.isInteger(n) || n < 1) galat.push(`Halaman '${halamanTeks}' bukan angka halaman yang sah.`)
    else current_jilid_page = n
  }

  // ── Wali ──
  const wali_email = str('wali_email') || null
  if (wali_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(wali_email)) {
    galat.push(`Email Wali '${wali_email}' tidak berbentuk alamat email.`)
  }

  const wali_phone = str('wali_phone') || null
  // Nomor disimpan apa adanya seperti pada formulir satuan; yang janggal cukup
  // ditandai supaya bisa dibetulkan di berkas, bukan menahan seluruh impor.
  if (wali_phone && !/^(\+?62|0)\d{8,14}$/.test(wali_phone.replace(/[\s-]/g, ''))) {
    catatan.push('No. HP tidak berbentuk nomor Indonesia — tetap disimpan.')
  }

  if (galat.length > 0) return gagal()

  return {
    baris,
    nama: full_name,
    jenjang: JENJANG_LABELS[jenjang],
    kelas,
    galat,
    catatan,
    data: {
      nis: str('nis') || null,
      full_name,
      gender,
      birth_date: tgl.nilai,
      jenjang,
      kelas: kelas || null,
      program,
      halaqoh_id,
      wali_name: str('wali_name') || null,
      wali_phone,
      wali_email,
      current_method_id,
      current_jilid_id,
      current_jilid_page,
    },
  }
}

/**
 * Tandai NIS kembar DI DALAM berkas sebagai galat pada kemunculan kedua dan
 * seterusnya. Bentrok dengan NIS yang sudah ada di basis data diperiksa
 * belakangan di server — di sini datanya belum diketahui.
 */
export function tandaiNisKembar(hasil: HasilBaris[]): HasilBaris[] {
  const pertama = new Map<string, number>()
  for (const h of hasil) {
    const nis = h.data?.nis
    if (!nis) continue
    const awal = pertama.get(nis)
    if (awal === undefined) pertama.set(nis, h.baris)
    else {
      h.galat.push(`NIS ${nis} kembar dengan baris ${awal} di berkas ini.`)
      h.data = null
    }
  }
  return hasil
}
