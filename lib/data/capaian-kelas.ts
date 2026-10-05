import { createServerClient } from '@/lib/supabase/server'
import { getJuzUjianPerSiswa, getSiswaUrutanBebas, juzBerjalanPerSiswa, juzGabunganPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { getTargetTahfidz, getTargetTahfidzSemua } from '@/lib/data/target-tahfidz'
import { ayatPerJuz } from '@/lib/rq/batas-juz'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { hitungJuzHafalan, posisiJuz, URUTAN_JUZ } from '@/lib/rq/hafalan'
import { posisiJuz30, UNIT_PER_SURAT, URUTAN_SURAT_JUZ30 } from '@/lib/rq/hafalan-juz30'
import { KELAS_TETAP } from '@/lib/rq/kelas'
import { mencapaiTarget } from '@/lib/rq/level'
import { UNIT_LABELS, UNIT_ORDER } from '@/lib/rq/programs'
import { JENJANG_METHODS, methodsForProgram, tahapBerlaku } from '@/lib/tahsin'
import type { Jenjang } from '@/types'

/**
 * Capaian tahsin & tahfidz per kelas — bentuk tabel bab 02 Laporan Eksekutif,
 * tapi dihitung dari SETORAN TERAKHIR tiap siswa di aplikasi, bukan dari rekap
 * bulanan yang diisi guru. Angkanya berubah begitu setoran, kenaikan jilid,
 * atau ujian dicatat.
 *
 * Siswa yang belum pernah setor masuk kolom "Belum" — BUKAN dianggap Jilid 1
 * atau Juz 30, dan tidak ditambal dari rekap bulanan. Lubang pencatatan harus
 * terlihat supaya bisa ditagih.
 *
 * Kolom persen di ujung tabel adalah KETERCAPAIAN TARGET kelasnya:
 *   · tahsin  — target jilid/tahap per angkatan (kurikulum_targets semester ini)
 *   · tahfidz — status terhadap rencana target tahfidz programnya
 *               (lib/data/target-tahfidz.ts: sesuai atau di atas target)
 * Penyebutnya siswa yang kelasnya PUNYA target; siswa yang belum setor ikut
 * dihitung sebagai belum mencapai.
 */

export const BELUM_TERCATAT = 'Belum tercatat'

/** Urutan kolom tahsin — ordinal, tidak pernah diurut menurut jumlah. */
const URUTAN_TAHSIN = [
  // Pra = buku sebelum Jilid 1 (KIBAR SD LHI Juara, Pra-UMMI TPAIT — tahapBerlaku).
  'Pra', 'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6',
  "Al-Qur'an", 'Gharib', 'Tajwid', 'Lulus',
] as const

/** Satu siswa di balik sebuah sel — isi dialog saat sel diklik. */
export interface SiswaSel {
  nama: string
  kelas: string | null
  pengampu: string | null
  /** Isi setoran terakhir, mis. 'Jilid 3 hal. 12' atau "An-Naba' 1–20". */
  posisi: string | null
  /** Tanggal setoran terakhir, sudah diformat. */
  tanggal: string | null
  /** null = kelasnya belum punya target. */
  capai: boolean | null
}

export interface BarisMatriks {
  tingkat: number | null
  label: string
  total: number
  /** Sejajar dengan MatriksCapaian.kolom. */
  sel: number[]
  /** Pembilang kolom persen (mis. siswa yang mencapai target). */
  maju: number
  /** Penyebut kolom persen bila berbasis target; tanpa ini: total dikurangi "Belum". */
  bertarget?: number
  /** Teks target baris ini, untuk keterangan judul baris. */
  target?: string
  /** Siswa per sel, sejajar dengan sel — hanya bila tabelnya bisa diklik. */
  rincian?: SiswaSel[][]
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
  bertarget?: number
  /** Judul tabel bila satu panel memuat beberapa tabel (blok juz). */
  judul?: string
  /** Keterangan kolom yang labelnya ringkas, mis. '3 juz' → 'Tuntas juz 30–28'. */
  kolomInfo?: Record<string, string>
}

export type JalurCapaian = 'reguler' | 'quls'

export interface CapaianKelompok {
  /** `${jenjang}:${jalur}` */
  kode: string
  jenjang: Jenjang
  jalur: JalurCapaian
  judul: string
  keterangan: string
  siswa: number
  metode: string[]
  tahsin: MatriksCapaian
  /** Satu tabel per blok lima juz (30–26, 1–5, 6–10, …); blok kosong sesudah yang pertama tidak ikut. */
  tahfidz: MatriksCapaian[]
}

export interface CapaianKelasData {
  kelompok: CapaianKelompok[]
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

/** Nama jalur per unit. QULS dipisah; sisanya (termasuk yang programnya kosong) reguler. */
const NAMA_JALUR: Partial<Record<Jenjang, Record<JalurCapaian, { judul: string; keterangan: string }>>> = {
  sd: {
    reguler: { judul: 'CLIL / non-QULS', keterangan: 'Program reguler SDIT, termasuk yang programnya belum ditandai' },
    quls: { judul: 'QULS', keterangan: 'Program intensif, termasuk QULS Takhassus' },
  },
  sd_juara: {
    reguler: { judul: 'Reguler', keterangan: 'Program reguler SD Juara' },
    quls: { judul: 'QULS', keterangan: 'Program intensif SD Juara' },
  },
  smp: {
    reguler: { judul: 'Reguler (non-QULS)', keterangan: 'Reguler fullday & boarding' },
    quls: { judul: 'QULS', keterangan: 'Fullday & boarding QULS' },
  },
}

/** Unit yang selalu ditampilkan berpasangan reguler vs QULS, walau QULS-nya kosong. */
const UNIT_BERJALUR = new Set<Jenjang>(['sd', 'sd_juara', 'smp'])

function jalurOf(program: string | null): JalurCapaian {
  return /quls/i.test(program ?? '') ? 'quls' : 'reguler'
}

/**
 * Tingkat kelas dari teks bebas ('1A', '9C', '4.0') — hanya angkanya.
 * Unit berkelas huruf (TPAIT: TKA, TKB) memakai urutan KELAS_TETAP: TKA = 1.
 */
function tingkatOf(kelas: string | null, jenjang?: Jenjang): number | null {
  const huruf = jenjang ? KELAS_TETAP[jenjang]?.indexOf((kelas ?? '').trim()) ?? -1 : -1
  if (huruf >= 0 && !/^\d/.test(KELAS_TETAP[jenjang!]![huruf])) return huruf + 1
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** Satukan label jilid_levels lintas metode menjadi kolom laporan. */
function kolomTahsin(level: BarisLevel): string {
  if (level.is_terminal) return 'Lulus'
  if (/^pra\b/i.test(level.label.trim())) return 'Pra'
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
  for (let hal = 0; hal < 200; hal++) {
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

// ─── Tabel dengan kolom target ───────────────────────────────────────────────

interface Entri {
  tingkat: number | null
  kolom: string
  siswa: SiswaSel
}

const menurutNama = (a: SiswaSel, b: SiswaSel) => a.nama.localeCompare(b.nama, 'id')

/**
 * Susun matriks tingkat × kolom beserta rincian siswanya. Kolom yang selalu
 * tampil (`kolomTetap`) dipertahankan walau nol, supaya tangganya utuh; kolom
 * lain hanya muncul bila ada isinya.
 */
function susunMatriks(
  entri: Entri[],
  urutan: readonly string[],
  kolomTetap: Set<string>,
  opsi: { targetPerTingkat?: Map<number, string>; judul?: string; kolomInfo?: Record<string, string> } = {},
): MatriksCapaian {
  const hitungKolom = new Map<string, number>()
  const perTingkat = new Map<number | null, Entri[]>()
  for (const e of entri) {
    hitungKolom.set(e.kolom, (hitungKolom.get(e.kolom) ?? 0) + 1)
    const isi = perTingkat.get(e.tingkat) ?? []
    isi.push(e)
    perTingkat.set(e.tingkat, isi)
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
    .map(([tingkat, isi]) => {
      const rincian = kolom.map(k => isi.filter(e => e.kolom === k).map(e => e.siswa).sort(menurutNama))
      const sel = rincian.map(r => r.length)
      return {
        tingkat,
        label: tingkat ? `Kelas ${tingkat}` : 'Tanpa kelas',
        total: isi.length,
        sel,
        maju: isi.filter(e => e.siswa.capai === true).length,
        bertarget: isi.filter(e => e.siswa.capai !== null).length,
        target: tingkat ? opsi.targetPerTingkat?.get(tingkat) : undefined,
        rincian,
      }
    })

  return {
    kolom,
    baris,
    jumlahKolom: kolom.map(k => hitungKolom.get(k) ?? 0),
    total: entri.length,
    maju: baris.reduce((n, b) => n + b.maju, 0),
    bertarget: baris.reduce((n, b) => n + (b.bertarget ?? 0), 0),
    labelMaju: 'Capai target',
    dariRekap: 0,
    judul: opsi.judul,
    kolomInfo: opsi.kolomInfo,
  }
}

// ─── Blok juz tahfidz ────────────────────────────────────────────────────────
//
// Urutan hafalan dibagi per lima juz: 30–26, lalu 1–5, 6–10, … Tiap blok
// punya dua tonggak, sama dengan tasmi' di lib/rq/hafalan.ts: "3 juz" (tiga
// juz pertama blok tuntas) dan "5 juz" (bloknya genap). Kolomnya:
//   Juz a · Juz b · Juz c · 3 juz · Juz d · Juz e · 5 juz

const PER_BLOK = 5

function juzBlok(blok: number): number[] {
  return URUTAN_JUZ.slice(blok * PER_BLOK, blok * PER_BLOK + PER_BLOK)
}

function kolomBlok(blok: number): string[] {
  const [a, b, c, d, e] = juzBlok(blok).map(j => `Juz ${j}`)
  return [a, b, c, '3 juz', d, e, '5 juz']
}

function rentang(daftar: number[]): string {
  return `${daftar[0]}–${daftar[daftar.length - 1]}`
}

/**
 * Blok & kolom tahfidz seorang siswa.
 *
 * `berjalan` = posisi (dalam urutan hafalan) juz terjauh yang sudah ada
 * setorannya; `tuntas` = jumlah juz yang sudah selesai — lewat kenaikan juz
 * (mutqin) atau ujian. Selama anak belum mulai menyetor juz berikutnya, ia
 * berada di tonggak juz yang baru dituntaskannya: sesudah juz 28 tuntas ia di
 * kolom "3 juz", bukan di "Juz 27" yang belum disentuhnya.
 */
function posisiTahfidz(berjalan: number, tuntas: number): { blok: number; kolom: string } | null {
  if (berjalan === 0 && tuntas === 0) return null
  const diJuz = (p: number) => ({ blok: Math.floor((p - 1) / PER_BLOK), kolom: `Juz ${URUTAN_JUZ[p - 1]}` })
  if (tuntas < berjalan) return diJuz(berjalan)

  const n = Math.min(tuntas, URUTAN_JUZ.length)
  const dalamBlok = ((n - 1) % PER_BLOK) + 1
  const blok = Math.floor((n - 1) / PER_BLOK)
  if (dalamBlok === 3) return { blok, kolom: '3 juz' }
  if (dalamBlok === 5) return { blok, kolom: '5 juz' }
  return diJuz(n + 1)
}

/**
 * Penentu blok & kolom tahfidz untuk sekumpulan siswa — satu-satunya aturan,
 * dipakai laporan pengurus dan portal guru supaya angkanya tidak pernah berbeda.
 */
function pembacaTahfidz(juzProgress: BarisJuzProgress[], juzUjian: Map<string, number>, bebas: ReadonlySet<string>) {
  const berjalan = juzBerjalanPerSiswa(juzProgress)
  const tuntasSetoran = juzGabunganPerSiswa(juzProgress, juzUjian, bebas)
  const tuntasMutqin = new Map<string, number>()
  for (const r of juzProgress) {
    // Urutan bebas (SMA): juz tuntas hanya dari ujian, bukan setoran/mutqin.
    if (!r.mutqin || bebas.has(r.student_id)) continue
    const p = posisiJuz(r.juz_number) ?? 0
    if (p > (tuntasMutqin.get(r.student_id) ?? 0)) tuntasMutqin.set(r.student_id, p)
  }
  return (id: string) => {
    const pBerjalan = berjalan.has(id) && !bebas.has(id) ? (posisiJuz(berjalan.get(id)!) ?? 0) : 0
    const tuntas = Math.max(tuntasSetoran.get(id) ?? 0, tuntasMutqin.get(id) ?? 0)
    return { tuntas, letak: posisiTahfidz(pBerjalan, tuntas) }
  }
}

/**
 * Label tahfidz yang berdiri sendiri, tanpa judul tabel bloknya: tonggak
 * menyebut juz-nya ('3 juz (28–30)'), sebab "3 juz" di blok 1–5 bukan
 * tonggak yang sama dengan "3 juz" di blok 30–26.
 */
function labelTahfidzLepas(letak: { blok: number; kolom: string }): string {
  if (letak.kolom !== '3 juz' && letak.kolom !== '5 juz') return letak.kolom
  const juz = juzBlok(letak.blok).slice(0, letak.kolom === '3 juz' ? 3 : 5)
  return `${letak.kolom} (${Math.min(...juz)}–${Math.max(...juz)})`
}

/** Seluruh label tahfidz lepas, urut sepanjang urutan hafalan — untuk median & legenda. */
const URUTAN_TAHFIDZ_LEPAS = Array.from({ length: URUTAN_JUZ.length / PER_BLOK }, (_, blok) =>
  kolomBlok(blok).map(kolom => labelTahfidzLepas({ blok, kolom }))).flat()

// ─── Tabel per surat Juz 30 (PAUD) ──────────────────────────────────────────
//
// Unit yang menghafal Juz 30 mundur per surat (lib/rq/hafalan-juz30.ts) tidak
// memakai blok juz: kolomnya surat, mulai An-Nas. 37 surat terlalu lebar untuk
// satu tabel, jadi dipotong per delapan surat — An-Nas–Al-Ma'un, Quraisy–
// Al-Bayyinah, dan seterusnya.

const SURAT_PER_TABEL = 8

function suratBlok(blok: number): number[] {
  return URUTAN_SURAT_JUZ30.slice(blok * SURAT_PER_TABEL, (blok + 1) * SURAT_PER_TABEL)
}

// ─── Data ────────────────────────────────────────────────────────────────────

interface LogTahsin {
  student_id: string
  setoran_date: string
  jilid_id: string | null
  halaman: number | null
  quran_halaman: number | null
  quran_surat_id: number | null
  quran_ayat_dari: number | null
  quran_ayat_ke: number | null
  teacher_id: string | null
}

interface LogZiyadah {
  student_id: string
  setoran_date: string
  surat_id: number
  ayat_dari: number | null
  ayat_ke: number | null
  teacher_id: string | null
}

const ZIYADAH = ['ziyadah', 'hafalan_baru']

/** '2026-09-12' → '12 Sep 2026'. Tanggal saja, jadi dibaca sebagai UTC. */
function formatTanggal(iso: string | null): string | null {
  if (!iso) return null
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/**
 * `sampai` (YYYY-MM-DD) = hitung posisi PER TANGGAL ITU, bukan hari ini —
 * dipakai laporan bulanan (lib/data/laporan-kurikulum.ts). Setoran, kenaikan
 * jilid/juz, dan ujian sesudah tanggal itu diabaikan; aturan penentuan kolom
 * tetap sama persis dengan dashboard.
 */
export async function getCapaianKelas(jenjangBoleh: Jenjang[], opsi: { sampai?: string; hanyaSiswa?: string[] } = {}): Promise<CapaianKelasData> {
  const { sampai } = opsi
  // Subset siswa (mis. peserta ekstra) — aturan penghitungan tetap sama persis.
  const hanya = opsi.hanyaSiswa ? new Set(opsi.hanyaSiswa) : null
  const diambil = sampai ? `${sampai}T23:59:59+07:00` : new Date().toISOString()
  const jenjangDipakai = UNIT_ORDER.filter(j => jenjangBoleh.includes(j))
  if (jenjangDipakai.length === 0) return { kelompok: [], diambil }

  const supabase = createServerClient()

  const [
    siswaMentah, levelRes, methodRes, halaqohRes, guruRes, termRes,
    juzProgressKini, juzUjianKini, logTahsin, logZiyadah, targetTahfidz, infoSurat, riwayat,
  ] = await Promise.all([
    ambilSemua<BarisSiswa & { full_name: string; halaqoh_id: string | null }>(() => supabase.from('students')
      .select('id, full_name, jenjang, kelas, program, current_jilid_id, halaqoh_id')
      .eq('is_active', true).in('jenjang', jenjangDipakai).order('id')),
    supabase.from('jilid_levels').select('id, method_id, label, order_num, is_quran, is_terminal'),
    supabase.from('tahsin_methods').select('id, name'),
    supabase.from('halaqoh').select('id, wali_teacher_id'),
    supabase.from('teachers').select('id, full_name'),
    supabase.from('academic_terms').select('id').eq('is_current', true).maybeSingle(),
    // juz_progress & rekap ujian tidak bertanggal — untuk `sampai` keduanya
    // disusun ulang dari riwayat bertanggal (riwayatSampai di bawah).
    sampai ? Promise.resolve([] as BarisJuzProgress[]) : ambilSemua<BarisJuzProgress>(() => supabase.from('juz_progress')
      .select('student_id, juz_number, ayat_hafal, mutqin').order('student_id').order('juz_number')),
    sampai ? Promise.resolve(new Map<string, number>()) : getJuzUjianPerSiswa(),
    // Terbaru lebih dulu: pembacaan di bawah mengambil yang pertama ditemui.
    ambilSemua<LogTahsin>(() => supabase.from('tahsin_logs')
      .select('student_id, setoran_date, jilid_id, halaman, quran_halaman, quran_surat_id, quran_ayat_dari, quran_ayat_ke, teacher_id')
      .lte('setoran_date', sampai ?? '9999-12-31')
      .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
    ambilSemua<LogZiyadah>(() => supabase.from('tahfidz_logs')
      .select('student_id, setoran_date, surat_id, ayat_dari, ayat_ke, teacher_id')
      .in('kind', ZIYADAH)
      .lte('setoran_date', sampai ?? '9999-12-31')
      .order('setoran_date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
    (sampai ? getTargetTahfidz(UNIT_ORDER, sampai) : getTargetTahfidzSemua()).catch(err => {
      console.error('[capaian-kelas] target tahfidz gagal dihitung:', err)
      return null
    }),
    getInfoSurat(),
    sampai ? riwayatSampai(supabase, sampai) : Promise.resolve(null),
  ])

  // Posisi per `sampai`: juz_progress disusun ulang dari ayat ziyadah, tanda
  // tuntas (mutqin) dari kenaikan juz, ujian dari yang selesai s.d. tanggal itu.
  const juzProgress = riwayat ? progresDariZiyadah(logZiyadah, riwayat.juzNaik) : juzProgressKini
  const juzUjian = riwayat ? riwayat.juzUjian : juzUjianKini

  const siswaSemua = hanya ? siswaMentah.filter(s => hanya.has(s.id)) : siswaMentah

  const term = termRes.data as { id: string } | null
  const targetRes = term
    ? await supabase.from('kurikulum_targets').select('jenjang, tingkat, target_tahsin').eq('term_id', term.id)
    : { data: [] }
  const targetTahsin = new Map(
    ((targetRes.data ?? []) as { jenjang: string; tingkat: number; target_tahsin: string | null }[])
      .filter(t => t.target_tahsin)
      .map(t => [`${t.jenjang}|${t.tingkat}`, t.target_tahsin as string]),
  )

  const levels = (levelRes.data ?? []) as BarisLevel[]
  const levelById = new Map(levels.map(l => [l.id, l]))
  const namaMetode = new Map(((methodRes.data ?? []) as { id: string; name: string }[]).map(m => [m.id, m.name]))
  const namaGuru = new Map(((guruRes.data ?? []) as { id: string; full_name: string }[]).map(g => [g.id, g.full_name]))
  const waliHalaqoh = new Map(((halaqohRes.data ?? []) as { id: string; wali_teacher_id: string | null }[])
    .map(h => [h.id, h.wali_teacher_id]))

  const tahsinTerakhir = new Map<string, LogTahsin>()
  for (const l of logTahsin) if (!tahsinTerakhir.has(l.student_id)) tahsinTerakhir.set(l.student_id, l)
  const ziyadahTerakhir = new Map<string, LogZiyadah>()
  for (const l of logZiyadah) if (!ziyadahTerakhir.has(l.student_id)) ziyadahTerakhir.set(l.student_id, l)

  // Jilid siswa: kolom students (hari ini), atau — dengan `sampai` — yang
  // terakhir dari kenaikan jilid / setoran s.d. tanggal itu.
  const jilidSiswa = (s: { id: string; current_jilid_id: string | null }): string | null => {
    // Tak bergerak sesudah `sampai` → posisinya hari ini = posisinya saat itu,
    // termasuk koreksi penempatan yang diketik langsung tanpa setoran.
    if (!riwayat || !riwayat.bergerakSesudah.has(s.id)) return s.current_jilid_id
    const log = tahsinTerakhir.get(s.id)
    const naik = riwayat.jilidNaik.get(s.id)
    if (naik && (!log || naik.tanggal >= log.setoran_date)) return naik.jilid
    return log?.jilid_id ?? null
  }

  // Setoran ziyadah per siswa — posisi Juz 30 unit per surat.
  const ziyadahPerSiswa = new Map<string, LogZiyadah[]>()
  for (const l of logZiyadah) {
    const d = ziyadahPerSiswa.get(l.student_id) ?? []
    d.push(l)
    ziyadahPerSiswa.set(l.student_id, d)
  }

  const statusTahfidz = new Map((targetTahfidz?.siswa ?? []).map(s => [s.id, s.status]))

  // Juz tuntas: yang terjauh dari kenaikan juz (mutqin), ujian, dan juz
  // sebelum juz yang sedang disetor.
  const bacaTahfidz = pembacaTahfidz(juzProgress, juzUjian, await getSiswaUrutanBebas())

  const namaSurat = (id: number) => infoSurat.get(id)?.name_latin ?? `Surah ${id}`
  const ayat = (dari: number | null, ke: number | null) =>
    dari && ke ? (dari === ke ? ` ${dari}` : ` ${dari}–${ke}`) : ke ? ` ${ke}` : ''

  const pengampu = (s: { halaqoh_id: string | null }, cadangan: string | null | undefined) => {
    const wali = s.halaqoh_id ? waliHalaqoh.get(s.halaqoh_id) : null
    return (wali && namaGuru.get(wali)) || (cadangan && namaGuru.get(cadangan)) || null
  }

  type Siswa = (typeof siswaSemua)[number]

  const entriTahsin = (s: Siswa): Entri => {
    const log = tahsinTerakhir.get(s.id)
    const tingkat = tingkatOf(s.kelas, s.jenjang)
    const target = tingkat ? targetTahsin.get(`${s.jenjang}|${tingkat}`) : undefined
    // Jilid diambil dari posisi siswa yang digerakkan setoran (termasuk
    // kenaikan jilid), tapi hanya bila memang ada setorannya.
    //
    // Kecuali Lulus Tahsin: anak yang sudah lulus tidak lagi setor tahsin
    // (ia sudah di tahfidz), jadi menuntut setoran berarti ia terkunci di
    // kolom "Belum" selamanya.
    const jilidKini = jilidSiswa(s)
    const lvKini = jilidKini ? levelById.get(jilidKini) : undefined
    const lv = log ? lvKini ?? (log.jilid_id ? levelById.get(log.jilid_id) : undefined)
      : lvKini?.is_terminal ? lvKini : undefined
    const kolom = lv ? kolomTahsin(lv) : BELUM_TERCATAT

    let posisi: string | null = null
    if (log) {
      const bagian: string[] = []
      const lvLog = log.jilid_id ? levelById.get(log.jilid_id) : undefined
      if (lvLog) bagian.push(log.halaman ? `${lvLog.label} hal. ${log.halaman}` : lvLog.label)
      if (log.quran_surat_id) bagian.push(`${namaSurat(log.quran_surat_id)}${ayat(log.quran_ayat_dari, log.quran_ayat_ke)}`)
      else if (log.quran_halaman) bagian.push(`mushaf hal. ${log.quran_halaman}`)
      posisi = bagian.join(' · ') || null
    }

    return {
      tingkat,
      kolom,
      siswa: {
        nama: s.full_name,
        kelas: s.kelas,
        pengampu: pengampu(s, log?.teacher_id),
        posisi,
        tanggal: formatTanggal(log?.setoran_date ?? null),
        capai: target ? mencapaiTarget(kolom === 'Lulus' ? 'Tahfidz' : kolom, target) : null,
      },
    }
  }

  const entriTahfidz = (s: Siswa): Entri & { blok: number } => {
    const { tuntas, letak } = bacaTahfidz(s.id)
    const log = ziyadahTerakhir.get(s.id)
    const status = statusTahfidz.get(s.id)

    return {
      tingkat: tingkatOf(s.kelas, s.jenjang),
      blok: letak?.blok ?? 0,
      kolom: letak?.kolom ?? BELUM_TERCATAT,
      siswa: {
        nama: s.full_name,
        kelas: s.kelas,
        pengampu: pengampu(s, log?.teacher_id),
        posisi: log
          ? `${namaSurat(log.surat_id)}${ayat(log.ayat_dari, log.ayat_ke)}`
          : tuntas > 0 ? `${tuntas} juz tuntas (ujian)` : null,
        tanggal: formatTanggal(log?.setoran_date ?? null),
        capai: !status || status === 'tanpa_target' ? null : status === 'sesuai' || status === 'di_atas',
      },
    }
  }

  /** Kolom = surat terjauh (urutan An-Nas → An-Naba'); blok = potongan delapan surat. */
  const entriTahfidzSurat = (s: Siswa): Entri & { blok: number } => {
    const pos = posisiJuz30(ziyadahPerSiswa.get(s.id) ?? [])
    const log = ziyadahTerakhir.get(s.id)
    const urutan = pos ? URUTAN_SURAT_JUZ30.indexOf(pos.surat) : -1
    return {
      tingkat: tingkatOf(s.kelas, s.jenjang),
      blok: urutan >= 0 ? Math.floor(urutan / SURAT_PER_TABEL) : 0,
      kolom: pos ? namaSurat(pos.surat) : BELUM_TERCATAT,
      siswa: {
        nama: s.full_name,
        kelas: s.kelas,
        pengampu: pengampu(s, log?.teacher_id),
        posisi: log ? `${namaSurat(log.surat_id)}${ayat(log.ayat_dari, log.ayat_ke)}` : null,
        tanggal: formatTanggal(log?.setoran_date ?? null),
        capai: null,
      },
    }
  }

  const tabelPerSurat = (siswa: Siswa[]): MatriksCapaian[] => {
    const entri = siswa.map(entriTahfidzSurat)
    // Semua potongan sampai yang terjauh terisi — tangganya utuh dari An-Nas.
    const terjauh = Math.max(0, ...entri.filter(e => e.kolom !== BELUM_TERCATAT).map(e => e.blok))
    return Array.from({ length: terjauh + 1 }, (_, blok) => {
      const kolom = suratBlok(blok).map(namaSurat)
      return susunMatriks(
        entri.filter(e => e.blok === blok),
        [...kolom, BELUM_TERCATAT],
        new Set(blok === 0 ? [...kolom, BELUM_TERCATAT] : kolom),
        { judul: `Juz 30 · ${kolom[0]} – ${kolom[kolom.length - 1]}` },
      )
    })
  }

  const kelompok: CapaianKelompok[] = []
  for (const jenjang of jenjangDipakai) {
    const siswaUnit = siswaSemua.filter(s => s.jenjang === jenjang)
    if (siswaUnit.length === 0) continue

    const targetPerTingkat = new Map<number, string>()
    for (const [k, v] of targetTahsin) {
      const [j, t] = k.split('|')
      if (j === jenjang) targetPerTingkat.set(Number(t), v)
    }

    for (const jalur of ['reguler', 'quls'] as const) {
      const siswa = siswaUnit.filter(s => jalurOf(s.program) === jalur)
      if (siswa.length === 0 && !(jalur === 'quls' && UNIT_BERJALUR.has(jenjang))) continue
      const nama = NAMA_JALUR[jenjang]?.[jalur]
      const pisah = UNIT_BERJALUR.has(jenjang) || siswaUnit.some(s => jalurOf(s.program) === 'quls')

      // Tangga metode RESMI unit ini (JENJANG_METHODS / methodsForProgram)
      // ditampilkan utuh — Jilid 5 yang kosong tetap satu kolom, karena
      // kosongnya itu sendiri informasi. Bukan metode yang tercatat pada
      // siswa: kelas 9 SMP yang menamatkan UMMI semasa SD akan menyeret
      // Jilid 6, Gharib, dan Tajwid ke tabel Syajaroh. Siswa seperti itu
      // tetap terhitung — kolomnya muncul hanya bila memang ada isinya.
      const metodeIds = new Set(
        siswa.map(s => { const j = jilidSiswa(s); return j ? levelById.get(j)?.method_id : undefined })
          .filter((x): x is string => Boolean(x)),
      )
      const metodeResmi = new Set(methodsForProgram(jenjang, jalur === 'quls' ? siswa[0]?.program : null) ?? JENJANG_METHODS[jenjang])
      const tetapTahsin = new Set([
        // Tahap khusus unit (KIBAR "Pra" hanya SD Juara) tidak menjadi kolom
        // tetap di unit lain — kolom itu akan selalu kosong di sana.
        ...levels.filter(l => metodeResmi.has(namaMetode.get(l.method_id) ?? '')
          && tahapBerlaku(namaMetode.get(l.method_id), l.label, jenjang)).map(kolomTahsin),
        BELUM_TERCATAT,
      ])

      const tahfidzEntri = UNIT_PER_SURAT.has(jenjang) ? [] : siswa.map(entriTahfidz)
      const blokTerisi = new Set(tahfidzEntri.map(e => e.blok))
      blokTerisi.add(0)
      const tahfidz = UNIT_PER_SURAT.has(jenjang) ? tabelPerSurat(siswa) : [...blokTerisi].sort((a, b) => a - b).map(blok => {
        const kolom = kolomBlok(blok)
        const juz = juzBlok(blok)
        return susunMatriks(
          tahfidzEntri.filter(e => e.blok === blok),
          [...kolom, BELUM_TERCATAT],
          new Set(blok === 0 ? [...kolom, BELUM_TERCATAT] : kolom),
          {
            judul: `Juz ${rentang(juz)}`,
            kolomInfo: {
              '3 juz': `Tuntas juz ${rentang(juz.slice(0, 3))}, belum mulai juz ${juz[3]}`,
              '5 juz': `Tuntas juz ${rentang(juz)}${blok + 1 < URUTAN_JUZ.length / PER_BLOK ? `, belum mulai juz ${URUTAN_JUZ[(blok + 1) * PER_BLOK]}` : ' — khatam 30 juz'}`,
            },
          },
        )
      })

      kelompok.push({
        kode: `${jenjang}:${jalur}`,
        jenjang,
        jalur,
        judul: pisah ? `${UNIT_LABELS[jenjang]} — ${nama?.judul ?? (jalur === 'quls' ? 'QULS' : 'Reguler')}` : UNIT_LABELS[jenjang],
        keterangan: pisah ? nama?.keterangan ?? '' : 'Seluruh program',
        siswa: siswa.length,
        metode: [...metodeIds].map(id => namaMetode.get(id) ?? '—').sort(),
        tahsin: namaiBarisKelas(susunMatriks(siswa.map(entriTahsin), [...URUTAN_TAHSIN, BELUM_TERCATAT], tetapTahsin, { targetPerTingkat }), jenjang),
        tahfidz: tahfidz.map(m => namaiBarisKelas(m, jenjang)),
      })
    }
  }

  return { kelompok, diambil }
}

// ─── Riwayat per tanggal (opsi `sampai`) ─────────────────────────────────

interface RiwayatSampai {
  /** Siswa yang punya setoran tahsin / kenaikan jilid SESUDAH `sampai`. */
  bergerakSesudah: Set<string>
  jilidNaik: Map<string, { jilid: string; tanggal: string }>
  juzNaik: Map<string, Set<number>>
  juzUjian: Map<string, number>
}

/** Kenaikan jilid & juz dan ujian tahfidz lulus yang terjadi s.d. `sampai`. */
async function riwayatSampai(supabase: ReturnType<typeof createServerClient>, sampai: string): Promise<RiwayatSampai> {
  const akhirHari = `${sampai}T23:59:59+07:00`
  const [jilid, juz, ujian, logSesudah, naikSesudah] = await Promise.all([
    ambilSemua<{ student_id: string; to_jilid_id: string; promotion_date: string }>(() => supabase.from('jilid_promotions')
      .select('student_id, to_jilid_id, promotion_date').lte('promotion_date', sampai)
      .order('promotion_date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
    ambilSemua<{ student_id: string; juz_number: number }>(() => supabase.from('juz_promotions')
      .select('student_id, juz_number').lte('promotion_date', sampai).order('id')),
    // Selesai & tidak mengulang; ujian tanpa jadwal adalah catatan riwayat lama.
    ambilSemua<{ student_id: string; juz: string }>(() => supabase.from('ujian_tahfidz')
      .select('student_id, juz').not('student_id', 'is', null).eq('status', 'selesai')
      .or('predikat.is.null,predikat.neq.mengulang')
      .or(`jadwal.is.null,jadwal.lte.${akhirHari}`).order('id')),
    ambilSemua<{ student_id: string }>(() => supabase.from('tahsin_logs')
      .select('student_id').gt('setoran_date', sampai).order('id')),
    ambilSemua<{ student_id: string }>(() => supabase.from('jilid_promotions')
      .select('student_id').gt('promotion_date', sampai).order('id')),
  ])
  const bergerakSesudah = new Set([...logSesudah, ...naikSesudah].map(r => r.student_id))
  const jilidNaik = new Map<string, { jilid: string; tanggal: string }>()
  for (const r of jilid) if (!jilidNaik.has(r.student_id)) jilidNaik.set(r.student_id, { jilid: r.to_jilid_id, tanggal: r.promotion_date })
  const juzNaik = new Map<string, Set<number>>()
  for (const r of juz) { const d = juzNaik.get(r.student_id) ?? new Set<number>(); d.add(r.juz_number); juzNaik.set(r.student_id, d) }
  const teksUjian = new Map<string, string[]>()
  for (const r of ujian) { const d = teksUjian.get(r.student_id) ?? []; d.push(String(r.juz)); teksUjian.set(r.student_id, d) }
  const juzUjian = new Map<string, number>()
  const bebas = await getSiswaUrutanBebas()
  for (const [id, d] of teksUjian) juzUjian.set(id, hitungJuzHafalan(d, bebas.has(id)))
  return { bergerakSesudah, jilidNaik, juzNaik, juzUjian }
}

/**
 * Padanan juz_progress yang dibentuk dari setoran ziyadah — cermin trigger
 * upsert_juz_progress (ayat dibagi menurut batas juz mushaf) — ditambah tanda
 * mutqin dari kenaikan juz.
 */
function progresDariZiyadah(log: LogZiyadah[], juzNaik: Map<string, Set<number>>): BarisJuzProgress[] {
  const ayat = new Map<string, number>()
  for (const l of log) {
    if (l.ayat_dari === null || l.ayat_ke === null) continue
    for (const [juz, n] of ayatPerJuz(l.surat_id, l.ayat_dari, l.ayat_ke)) {
      const k = `${l.student_id}|${juz}`
      ayat.set(k, (ayat.get(k) ?? 0) + n)
    }
  }
  const baris = new Map<string, BarisJuzProgress>()
  for (const [k, n] of ayat) {
    const [student_id, juz] = k.split('|')
    baris.set(k, { student_id, juz_number: Number(juz), ayat_hafal: n, mutqin: juzNaik.get(student_id)?.has(Number(juz)) ?? false })
  }
  for (const [student_id, set] of juzNaik) for (const juz of set) {
    const k = `${student_id}|${juz}`
    if (!baris.has(k)) baris.set(k, { student_id, juz_number: juz, ayat_hafal: 0, mutqin: true })
  }
  return [...baris.values()]
}

/** Baris unit berkelas huruf diberi nama kelasnya ('TKA'), bukan 'Kelas 1'. */
function namaiBarisKelas(m: MatriksCapaian, jenjang: Jenjang): MatriksCapaian {
  const tetap = KELAS_TETAP[jenjang]
  if (!tetap || /^\d/.test(tetap[0])) return m
  return { ...m, baris: m.baris.map(b => (b.tingkat ? { ...b, label: tetap[b.tingkat - 1] ?? b.label } : b)) }
}

/** Ringkasan target per tingkat dari satu atau beberapa matriks — bahan perbandingan jalur. */
export function targetPerTingkat(matriks: MatriksCapaian[]): Map<number | null, { tercapai: number; bertarget: number }> {
  const peta = new Map<number | null, { tercapai: number; bertarget: number }>()
  for (const m of matriks) {
    for (const b of m.baris) {
      const e = peta.get(b.tingkat) ?? { tercapai: 0, bertarget: 0 }
      e.tercapai += b.maju
      e.bertarget += b.bertarget ?? 0
      peta.set(b.tingkat, e)
    }
  }
  return peta
}

// ─── Capaian unit untuk portal guru ─────────────────────────────────────────
//
// Posisi tiap siswa aktif satu unit dengan aturan yang SAMA persis dengan
// laporan pengurus di atas: hanya dari setoran & ujian di aplikasi, siswa
// tanpa setoran = "Belum tercatat", tahfidz lewat pembacaTahfidz(). Hanya
// membaca; nama siswa tidak ikut dikembalikan.

export interface PosisiSiswaUnit {
  /** Id siswa — hanya untuk pengelompokan di server (mis. kelompok asrama), tidak pernah dikirim ke peramban. */
  id: string
  halaqoh_id: string | null
  tingkat: number | null
  metode_id: string | null
  /** Label jilid_levels asli metodenya (mis. 'Jilid 4' KIBAR); null = belum ada setoran tahsin. */
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
  buat: (potong: string[]) => { range: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: unknown }> },
): Promise<T[]> {
  const hasil: T[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const potong = ids.slice(i, i + 150)
    hasil.push(...await ambilSemua<T>(() => buat(potong)))
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
  const [juzProgress, logTahsin] = await Promise.all([
    ambilPerPotong<BarisJuzProgress>(ids, p => supabase.from('juz_progress')
      .select('student_id, juz_number, ayat_hafal, mutqin').in('student_id', p).order('student_id').order('juz_number')),
    // Cukup tahu siapa yang pernah setor; posisinya sudah ada di students.
    ambilPerPotong<{ student_id: string; jilid_id: string | null }>(ids, p => supabase.from('tahsin_logs')
      .select('student_id, jilid_id').in('student_id', p).order('id')),
  ])

  const levelById = new Map(((levelRes.data ?? []) as BarisLevel[]).map(l => [l.id, l]))
  const jilidLog = new Map<string, string | null>()
  for (const l of logTahsin) if (!jilidLog.get(l.student_id)) jilidLog.set(l.student_id, l.jilid_id)
  const bacaTahfidz = pembacaTahfidz(juzProgress, juzUjian, await getSiswaUrutanBebas())

  const siswa: PosisiSiswaUnit[] = siswaRows.map(s => {
    const lvSiswa = s.current_jilid_id ? levelById.get(s.current_jilid_id) : undefined
    // Metode tetap dari posisi siswa (untuk pengelompokan), tapi levelnya
    // hanya dihitung bila memang ada setoran tahsin.
    const adaSetoran = jilidLog.has(s.id)
    const logJilid = jilidLog.get(s.id)
    const lv = adaSetoran ? lvSiswa ?? (logJilid ? levelById.get(logJilid) : undefined) : undefined
    const { letak } = bacaTahfidz(s.id)
    return {
      id: s.id,
      halaqoh_id: s.halaqoh_id,
      tingkat: tingkatOf(s.kelas, s.jenjang),
      metode_id: (lv ?? lvSiswa)?.method_id ?? null,
      level: lv?.label ?? null,
      tahsin: lv ? kolomTahsin(lv) : BELUM_TERCATAT,
      tahfidz: letak ? labelTahfidzLepas(letak) : BELUM_TERCATAT,
    }
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
    urutanTahfidz: URUTAN_TAHFIDZ_LEPAS,
  }
}
