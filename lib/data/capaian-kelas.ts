import { createServerClient } from '@/lib/supabase/server'
import { getJuzUjianPerSiswa, juzBerjalanPerSiswa, juzGabunganPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { posisiJuz, URUTAN_JUZ } from '@/lib/rq/hafalan'
import { parseLevel } from '@/lib/rq/level'
import { hafalanDariTeks } from '@/lib/rq/quran'
import { QULS_SD_PROGRAMS } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'

/**
 * Capaian tahsin & tahfidz per kelas — bentuk tabel bab 02 Laporan Eksekutif
 * (2.1 CLIL, 2.2 QULS, 2.3–2.4 SMP), tapi dihitung dari POSISI SISWA SAAT INI,
 * bukan dari rekap bulanan yang diisi guru.
 *
 * Tahsin dibaca dari students.current_jilid_id — kolom yang ikut bergerak
 * setiap kali anak naik jilid. Tahfidz dibaca dari juz yang sedang dihafal:
 * yang terjauh antara setoran berjalan dan juz sesudah juz terakhir yang
 * lulus ujian (lib/data/hafalan.ts). Karena itu angkanya berubah begitu
 * setoran atau kenaikan dicatat, tanpa menunggu akhir bulan. Hanya bila
 * aplikasi belum punya posisi sama sekali, rekap bulanan guru terbaru dipakai
 * sebagai cadangan — dan jumlahnya dilaporkan (MatriksCapaian.dariRekap).
 *
 * Siswa tanpa posisi masuk kolom "Belum tercatat" — BUKAN dianggap Jilid 1
 * atau Juz 30. Laporan manual menaruh semua anak kelas 1 di Juz 30; di sini
 * anak yang belum pernah setor ditampilkan apa adanya, supaya lubang
 * pencatatan terlihat dan bisa ditagih.
 */

export const BELUM_TERCATAT = 'Belum tercatat'

/** Urutan kolom tahsin — ordinal, tidak pernah diurut menurut jumlah. */
const URUTAN_TAHSIN = [
  'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6',
  "Al-Qur'an", 'Gharib', 'Tajwid', 'Lulus',
] as const

/** Tahap yang sudah membaca mushaf — dipakai kolom ringkas "Sudah Al-Qur'an". */
const TAHAP_QURAN = new Set(["Al-Qur'an", 'Gharib', 'Tajwid', 'Lulus'])

export interface BarisMatriks {
  tingkat: number | null
  label: string
  total: number
  /** Sejajar dengan MatriksCapaian.kolom. */
  sel: number[]
  /** Pembilang kolom ringkas (Sudah Al-Qur'an / Lewat Juz 30). */
  maju: number
}

export interface MatriksCapaian {
  kolom: string[]
  baris: BarisMatriks[]
  /** Jumlah per kolom, sejajar dengan kolom. */
  jumlahKolom: number[]
  total: number
  maju: number
  labelMaju: string
  /** Siswa yang posisinya diambil dari rekap bulanan guru, bukan dari aplikasi. */
  dariRekap: number
}

export type KodeKelompok = 'clil' | 'quls' | 'smp'

export interface CapaianKelompok {
  kode: KodeKelompok
  judul: string
  keterangan: string
  jenjang: Jenjang
  siswa: number
  metode: string[]
  tahsin: MatriksCapaian
  tahfidz: MatriksCapaian
}

export interface CapaianKelasData {
  kelompok: CapaianKelompok[]
  /** Siswa SD aktif yang programnya belum ditandai — tidak masuk CLIL maupun QULS. */
  sdTanpaProgram: number
  diambil: string
}

interface BarisSiswa {
  id: string
  jenjang: Jenjang
  kelas: string | null
  program: string | null
  current_jilid_id: string | null
}

interface BarisLevel {
  id: string
  method_id: string
  label: string
  order_num: number
  is_quran: boolean
  is_terminal: boolean
}

const DEFINISI: {
  kode: KodeKelompok
  judul: string
  keterangan: string
  jenjang: Jenjang
  cocok: (s: BarisSiswa) => boolean
}[] = [
  {
    kode: 'clil', judul: 'SDIT — Kelas CLIL', keterangan: 'Program reguler SDIT LHI',
    jenjang: 'sd', cocok: s => s.program === 'clil',
  },
  {
    kode: 'quls', judul: 'SDIT — Kelas QULS', keterangan: 'Program intensif, termasuk QULS Takhassus',
    jenjang: 'sd', cocok: s => (QULS_SD_PROGRAMS as readonly string[]).includes(s.program ?? ''),
  },
  {
    kode: 'smp', judul: 'SMPIT LHI', keterangan: 'Seluruh program: reguler & QULS, fullday & boarding',
    jenjang: 'smp', cocok: () => true,
  },
]

/** Tingkat kelas dari teks bebas ('1A', '9C', '4.0') — hanya angkanya. */
function tingkatOf(kelas: string | null): number | null {
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** Satukan label jilid_levels lintas metode menjadi kolom laporan. */
function kolomTahsin(level: BarisLevel): string {
  if (level.is_terminal) return 'Lulus'
  const jilid = /^jilid\s*([1-6])/i.exec(level.label)
  if (jilid) return `Jilid ${jilid[1]}`
  const l = level.label.toLowerCase()
  if (/gh?[ao]r[io]i?b/.test(l)) return 'Gharib'
  if (l.includes('tajwid')) return 'Tajwid'
  // Al-Qur'an T1–T3, Talaqqi Mandiri, Talaqqi Al-Qur'an: semuanya membaca mushaf.
  if (level.is_quran || l.includes('qur') || l.includes('talaqqi')) return "Al-Qur'an"
  return level.label
}

/** Ambil seluruh baris, menembus batas 1000 baris PostgREST. */
async function ambilSemua<T>(
  buat: () => { range: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<T[]> {
  const UKURAN = 1000
  const hasil: T[] = []
  for (let hal = 0; hal < 50; hal++) {
    const { data, error } = await buat().range(hal * UKURAN, hal * UKURAN + UKURAN - 1)
    if (error) {
      console.error('[capaian-kelas] gagal mengambil data:', error)
      break
    }
    const batch = (data ?? []) as T[]
    hasil.push(...batch)
    if (batch.length < UKURAN) break
  }
  return hasil
}

/**
 * Susun matriks tingkat × kolom. Kolom yang selalu tampil (`kolomTetap`)
 * dipertahankan walau nol, supaya tangga metodenya utuh; kolom lain hanya
 * muncul bila ada isinya.
 */
function susunMatriks(
  siswa: BarisSiswa[],
  kolomSiswa: (s: BarisSiswa) => Posisi,
  urutan: readonly string[],
  kolomTetap: Set<string>,
  maju: (kolom: string) => boolean,
  labelMaju: string,
): MatriksCapaian {
  const perTingkat = new Map<number | null, Map<string, number>>()
  const hitungKolom = new Map<string, number>()
  let dariRekap = 0
  for (const s of siswa) {
    const t = tingkatOf(s.kelas)
    const { kolom: k, rekap } = kolomSiswa(s)
    if (rekap) dariRekap++
    const peta = perTingkat.get(t) ?? new Map<string, number>()
    peta.set(k, (peta.get(k) ?? 0) + 1)
    perTingkat.set(t, peta)
    hitungKolom.set(k, (hitungKolom.get(k) ?? 0) + 1)
  }

  const posisi = (k: string) => {
    if (k === BELUM_TERCATAT) return Number.MAX_SAFE_INTEGER
    const i = urutan.indexOf(k)
    return i === -1 ? urutan.length : i
  }
  const kolom = [...new Set([...kolomTetap, ...hitungKolom.keys()])]
    .filter(k => kolomTetap.has(k) || (hitungKolom.get(k) ?? 0) > 0)
    .sort((a, b) => posisi(a) - posisi(b) || a.localeCompare(b))

  const baris: BarisMatriks[] = [...perTingkat.entries()]
    .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
    .map(([tingkat, peta]) => {
      const sel = kolom.map(k => peta.get(k) ?? 0)
      return {
        tingkat,
        label: tingkat ? `Kelas ${tingkat}` : 'Tanpa kelas',
        total: sel.reduce((a, b) => a + b, 0),
        sel,
        maju: kolom.reduce((n, k, i) => n + (maju(k) ? sel[i] : 0), 0),
      }
    })

  return {
    kolom,
    baris,
    jumlahKolom: kolom.map(k => hitungKolom.get(k) ?? 0),
    total: siswa.length,
    maju: baris.reduce((n, b) => n + b.maju, 0),
    labelMaju,
    dariRekap,
  }
}

/** Kolom seorang siswa, dan apakah kolom itu berasal dari rekap bulanan. */
interface Posisi {
  kolom: string
  rekap: boolean
}

interface BarisRekap {
  student_id: string
  period: string
  level: string
  halaman_awal_tahsin: string
  halaman_akhir_tahsin: string
  tahfidz_awal: string
  tahfidz_akhir: string
}

/**
 * Posisi hafalan dari catatan bebas rekap bulanan, sebagai POSISI dalam
 * URUTAN_JUZ (1 = juz 30). "3 juz" berarti tiga juz tuntas, jadi anaknya
 * sedang di posisi ke-4; "Al-Mulk ayat 10" berarti sedang di juz 29.
 */
function posisiJuzDariTeks(teks: string): number {
  const jumlah = teks.toLowerCase().match(/(\d+)\s*juz/)
  if (jumlah) {
    const n = Number(jumlah[1])
    if (n >= 1 && n <= 30) return n + 1
  }
  const { juz } = hafalanDariTeks(teks)
  return juz ? (posisiJuz(juz) ?? 0) : 0
}

export async function getCapaianKelas(jenjangBoleh: Jenjang[]): Promise<CapaianKelasData> {
  const diambil = new Date().toISOString()
  const definisi = DEFINISI.filter(d => jenjangBoleh.includes(d.jenjang))
  if (definisi.length === 0) return { kelompok: [], sdTanpaProgram: 0, diambil }

  const supabase = createServerClient()
  const jenjangDipakai = [...new Set(definisi.map(d => d.jenjang))]

  const [siswaSemua, levelRes, methodRes, juzProgress, juzUjian, rekap] = await Promise.all([
    ambilSemua<BarisSiswa>(() => supabase.from('students')
      .select('id, jenjang, kelas, program, current_jilid_id')
      .eq('is_active', true).in('jenjang', jenjangDipakai).order('id')),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, is_quran, is_terminal'),
    supabase.from('tahsin_methods').select('id, name'),
    ambilSemua<BarisJuzProgress>(() => supabase.from('juz_progress')
      .select('student_id, juz_number, ayat_hafal, mutqin').order('student_id').order('juz_number')),
    getJuzUjianPerSiswa(),
    // Terbaru lebih dulu: pembacaan di bawah mengambil yang pertama ditemui.
    ambilSemua<BarisRekap>(() => supabase.from('student_monthly')
      .select('student_id, period, level, halaman_awal_tahsin, halaman_akhir_tahsin, tahfidz_awal, tahfidz_akhir')
      .order('period', { ascending: false }).order('student_id')),
  ])

  const levels = (levelRes.data ?? []) as BarisLevel[]
  const levelById = new Map(levels.map(l => [l.id, l]))
  const namaMetode = new Map(((methodRes.data ?? []) as { id: string; name: string }[]).map(m => [m.id, m.name]))

  const berjalan = juzBerjalanPerSiswa(juzProgress)
  const tuntas = juzGabunganPerSiswa(juzProgress, juzUjian)

  /*
    Juz yang sedang dihafal = yang terjauh dari dua petunjuk:
      · setoran berjalan (juz terjauh yang sudah ada ayatnya), atau
      · juz sesudah juz terakhir yang tuntas (lulus ujian / setoran penuh).
    Anak yang lulus ujian juz 29 tapi belum setor juz 28 tetap terbaca di
    juz 28, bukan tertinggal di juz 30 hanya karena setorannya belum masuk.
  */
  /*
    Rekap bulanan guru sebagai CADANGAN, dipakai hanya ketika aplikasi belum
    punya posisi untuk anak itu. Setoran tahfidz harian di aplikasi baru
    sedikit, sementara rekap bulanan sudah terisi untuk ratusan siswa —
    tanpa cadangan ini hampir seluruh kolom tahfidz terbaca "belum tercatat"
    padahal gurunya sudah melaporkan. Yang diambil catatan terbaru yang
    kolomnya terisi, per kolom: bulan terakhir bisa baru terisi tahsinnya.
  */
  const rekapTahsin = new Map<string, string>()
  const rekapJuz = new Map<string, number>()
  for (const r of rekap) {
    if (!rekapTahsin.has(r.student_id)) {
      const lv = parseLevel(r.level, r.halaman_akhir_tahsin || r.halaman_awal_tahsin)
      if (lv) rekapTahsin.set(r.student_id, lv === 'Tahfidz' ? 'Lulus' : lv)
    }
    if (!rekapJuz.has(r.student_id)) {
      const pos = posisiJuzDariTeks(r.tahfidz_akhir || r.tahfidz_awal)
      if (pos > 0) rekapJuz.set(r.student_id, pos)
    }
  }

  const kolomJuz = (s: BarisSiswa): Posisi => {
    const dariSetoran = berjalan.has(s.id) ? (posisiJuz(berjalan.get(s.id)!) ?? 0) : 0
    const nTuntas = tuntas.get(s.id) ?? 0
    const dariAplikasi = Math.max(dariSetoran, nTuntas > 0 ? nTuntas + 1 : 0)
    const pos = dariAplikasi || rekapJuz.get(s.id) || 0
    const rekap = dariAplikasi === 0 && pos > 0
    if (pos === 0) return { kolom: BELUM_TERCATAT, rekap }
    if (pos > URUTAN_JUZ.length) return { kolom: 'Khatam 30 juz', rekap }
    return { kolom: `Juz ${URUTAN_JUZ[pos - 1]}`, rekap }
  }
  const urutanJuz = [...URUTAN_JUZ.map(j => `Juz ${j}`), 'Khatam 30 juz']

  const kolomJilid = (s: BarisSiswa): Posisi => {
    const lv = s.current_jilid_id ? levelById.get(s.current_jilid_id) : undefined
    if (lv) return { kolom: kolomTahsin(lv), rekap: false }
    const dariRekap = rekapTahsin.get(s.id)
    return dariRekap ? { kolom: dariRekap, rekap: true } : { kolom: BELUM_TERCATAT, rekap: false }
  }

  const kelompok: CapaianKelompok[] = definisi.map(d => {
    const siswa = siswaSemua.filter(s => s.jenjang === d.jenjang && d.cocok(s))

    // Tangga metode yang dipakai kelompok ini ditampilkan utuh — Jilid 5
    // yang kosong tetap satu kolom, karena kosongnya itu sendiri informasi.
    const metodeIds = new Set(
      siswa.map(s => (s.current_jilid_id ? levelById.get(s.current_jilid_id)?.method_id : undefined))
        .filter((x): x is string => Boolean(x)),
    )
    const tetapTahsin = new Set(levels.filter(l => metodeIds.has(l.method_id)).map(kolomTahsin))

    return {
      kode: d.kode,
      judul: d.judul,
      keterangan: d.keterangan,
      jenjang: d.jenjang,
      siswa: siswa.length,
      metode: [...metodeIds].map(id => namaMetode.get(id) ?? '—').sort(),
      tahsin: susunMatriks(siswa, kolomJilid, URUTAN_TAHSIN, tetapTahsin,
        k => TAHAP_QURAN.has(k), "Sudah Al-Qur'an"),
      tahfidz: susunMatriks(siswa, kolomJuz, urutanJuz, new Set(siswa.length ? ['Juz 30'] : []),
        k => k !== 'Juz 30' && k !== BELUM_TERCATAT, 'Lewat Juz 30'),
    }
  })

  const sdTanpaProgram = jenjangDipakai.includes('sd')
    ? siswaSemua.filter(s => s.jenjang === 'sd' && !s.program).length
    : 0

  return { kelompok, sdTanpaProgram, diambil }
}

// ─── Capaian unit untuk portal guru ─────────────────────────────────────────
//
// Posisi tiap siswa aktif satu unit, dengan aturan yang SAMA persis dengan
// matriks di atas (kolomTahsin, juz terjauh setoran/ujian, cadangan rekap
// bulanan) — supaya angka yang dilihat guru tidak pernah berbeda dengan
// laporan pengurus. Hanya membaca; nama siswa tidak ikut dikembalikan.

export interface PosisiSiswaUnit {
  halaqoh_id: string | null
  tingkat: number | null
  metode_id: string | null
  /** Label jilid_levels asli metodenya (mis. 'Jilid 4' KIBAR) — untuk tampilan per metode. */
  level: string | null
  tahsin: string
  tahfidz: string
}

export interface PosisiUnit {
  siswa: PosisiSiswaUnit[]
  metode: { id: string; name: string }[]
  /** Tangga level tiap metode, urut order_num — label asli, tidak digabung lintas metode. */
  tangga: Record<string, string[]>
  urutanTahsin: string[]
  urutanTahfidz: string[]
}

async function ambilPerPotong<T>(
  ids: string[],
  buat: (potong: string[]) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const hasil: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await buat(ids.slice(i, i + 150))
    if (error) { console.error('[capaian-unit] gagal mengambil data:', error); continue }
    hasil.push(...((data ?? []) as T[]))
  }
  return hasil
}

export async function getPosisiUnit(jenjang: Jenjang): Promise<PosisiUnit> {
  const supabase = createServerClient()
  const [siswaRows, levelRes, methodRes, juzUjian] = await Promise.all([
    ambilSemua<BarisSiswa & { halaqoh_id: string | null }>(() => supabase.from('students')
      .select('id, jenjang, kelas, program, current_jilid_id, halaqoh_id')
      .eq('is_active', true).eq('jenjang', jenjang).order('id')),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, is_quran, is_terminal'),
    supabase.from('tahsin_methods').select('id, name'),
    getJuzUjianPerSiswa(),
  ])
  const ids = siswaRows.map(s => s.id)
  const [juzProgress, rekap] = await Promise.all([
    ambilPerPotong<BarisJuzProgress>(ids, p => supabase.from('juz_progress')
      .select('student_id, juz_number, ayat_hafal, mutqin').in('student_id', p)),
    ambilPerPotong<BarisRekap>(ids, p => supabase.from('student_monthly')
      .select('student_id, period, level, halaman_awal_tahsin, halaman_akhir_tahsin, tahfidz_awal, tahfidz_akhir')
      .in('student_id', p).order('period', { ascending: false })),
  ])
  rekap.sort((a, b) => b.period.localeCompare(a.period))

  const levelById = new Map(((levelRes.data ?? []) as BarisLevel[]).map(l => [l.id, l]))
  const berjalan = juzBerjalanPerSiswa(juzProgress)
  const tuntas = juzGabunganPerSiswa(juzProgress, juzUjian)
  const rekapTahsin = new Map<string, string>()
  const rekapJuz = new Map<string, number>()
  for (const r of rekap) {
    if (!rekapTahsin.has(r.student_id)) {
      const lv = parseLevel(r.level, r.halaman_akhir_tahsin || r.halaman_awal_tahsin)
      if (lv) rekapTahsin.set(r.student_id, lv === 'Tahfidz' ? 'Lulus' : lv)
    }
    if (!rekapJuz.has(r.student_id)) {
      const pos = posisiJuzDariTeks(r.tahfidz_akhir || r.tahfidz_awal)
      if (pos > 0) rekapJuz.set(r.student_id, pos)
    }
  }

  const siswa: PosisiSiswaUnit[] = siswaRows.map(s => {
    const lv = s.current_jilid_id ? levelById.get(s.current_jilid_id) : undefined
    const tahsin = lv ? kolomTahsin(lv) : rekapTahsin.get(s.id) ?? BELUM_TERCATAT
    const dariSetoran = berjalan.has(s.id) ? (posisiJuz(berjalan.get(s.id)!) ?? 0) : 0
    const nTuntas = tuntas.get(s.id) ?? 0
    const pos = Math.max(dariSetoran, nTuntas > 0 ? nTuntas + 1 : 0) || rekapJuz.get(s.id) || 0
    const tahfidz = pos === 0 ? BELUM_TERCATAT : pos > URUTAN_JUZ.length ? 'Khatam 30 juz' : `Juz ${URUTAN_JUZ[pos - 1]}`
    return { halaqoh_id: s.halaqoh_id, tingkat: tingkatOf(s.kelas), metode_id: lv?.method_id ?? null, level: lv?.label ?? null, tahsin, tahfidz }
  })

  const dipakai = new Set(siswa.map(s => s.metode_id).filter((x): x is string => Boolean(x)))
  const metode = ((methodRes.data ?? []) as { id: string; name: string }[])
    .filter(m => dipakai.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))

  const tangga: Record<string, string[]> = {}
  for (const l of [...levelById.values()].sort((a, b) => a.order_num - b.order_num)) {
    if (!dipakai.has(l.method_id)) continue
    const t = tangga[l.method_id] ?? []
    if (!t.includes(l.label)) t.push(l.label)
    tangga[l.method_id] = t
  }

  return {
    siswa,
    metode,
    tangga,
    urutanTahsin: [...URUTAN_TAHSIN],
    urutanTahfidz: [...URUTAN_JUZ.map(j => `Juz ${j}`), 'Khatam 30 juz'],
  }
}
