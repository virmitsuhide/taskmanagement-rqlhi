import { createServerClient } from '@/lib/supabase/server'
import { shiftPeriod } from '@/lib/finance/period'
import { adabRendah, bintangDariNilai } from '@/lib/rq/bintang'
import { labelJenisTahfidz } from '@/lib/data/setoran-ganda'

/**
 * Rekap bulanan per sesi untuk guru — dua halaman, satu sumber:
 *
 *  • Progres Sesi  : tabel siswa × tanggal, isi selnya setoran hari itu.
 *  • Catatan Adab  : siapa yang nilai sikapnya ≤ 2,5★, berapa kali sebulan.
 *
 * Semua agregasi di sini; halaman hanya menerima angka dan label jadi.
 */

type Supabase = ReturnType<typeof createServerClient>

export type JenisRekap = 'tahsin' | 'tahfidz'

/** Rentang [awal, akhir) bulan 'YYYY-MM' dalam bentuk tanggal. */
function rentangBulan(periode: string): { awal: string; akhir: string } {
  return { awal: `${periode}-01`, akhir: `${shiftPeriod(periode, 1)}-01` }
}

function angka(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Ambil seluruh baris, halaman demi halaman. PostgREST memotong jawaban di
 * 1.000 baris tanpa pesan apa pun; sebulan setoran beberapa sesi sekaligus
 * bisa melewatinya, dan rekap yang terpotong diam-diam lebih berbahaya
 * daripada rekap yang lambat.
 */
async function ambilSemua<T>(
  buat: (dari: number, sampai: number) => PromiseLike<{ data: unknown[] | null }>,
): Promise<T[]> {
  const UKURAN = 1000
  const hasil: T[] = []
  for (let dari = 0; ; dari += UKURAN) {
    const { data } = await buat(dari, dari + UKURAN - 1)
    const baris = (data ?? []) as T[]
    hasil.push(...baris)
    if (baris.length < UKURAN) return hasil
  }
}

interface SiswaRingkas { id: string; full_name: string; kelas: string | null; halaqoh_id: string }

async function siswaHalaqoh(supabase: Supabase, halaqohIds: string[]): Promise<SiswaRingkas[]> {
  if (halaqohIds.length === 0) return []
  const { data } = await supabase
    .from('students')
    .select('id, full_name, kelas, halaqoh_id')
    .in('halaqoh_id', halaqohIds)
    .eq('is_active', true)
    .order('full_name')
  return (data ?? []) as SiswaRingkas[]
}

// ─── Progres per sesi ────────────────────────────────────────────────────────

/**
 * Semua hari Senin–Jumat di bulan itu — kolom tetap tabel progres.
 *
 * Kolom tetap, bukan hanya tanggal yang ada setorannya: hari yang kosong
 * justru keterangan (anak tidak setor, atau sesi tidak berjalan), dan
 * posisi kolom yang sama tiap bulan membuat tabel mudah dibaca seperti buku
 * absen. Sabtu–Ahad libur, jadi tidak ditampilkan — kecuali ternyata ada
 * setoran di hari itu, yang tetap dimunculkan supaya tidak ada yang hilang.
 */
function hariSekolah(periode: string): string[] {
  const [tahun, bulan] = periode.split('-').map(Number)
  const jumlahHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const hasil: string[] = []
  for (let d = 1; d <= jumlahHari; d++) {
    const hari = new Date(Date.UTC(tahun, bulan - 1, d)).getUTCDay()
    if (hari !== 0 && hari !== 6) hasil.push(`${periode}-${String(d).padStart(2, '0')}`)
  }
  return hasil
}


export interface SelProgres {
  /** Teks pendek di dalam sel, mis. "12", "Q45", "Z 6". */
  label: string
  /** Rincian lengkap untuk tooltip. */
  rinci: string
  ulang: boolean
  drill: boolean
  adabRendah: boolean
  /** Bahan koreksi oleh koordinator — lihat components/setoran/TabelProgres. */
  sunting: SuntingSetoran
}

/** Isi setoran yang boleh dikoreksi, beserta nilai lamanya. */
export interface SuntingSetoran {
  id: string
  tabel: 'tahsin_logs' | 'tahfidz_logs'
  tanggal: string
  /** Baris judul dialog, mis. "Jilid 6 halaman 40" atau "Ziyadah · An-Naba 1–5". */
  judul: string
  halaman: number | null
  barisDari: number | null
  barisKe: number | null
  ayatDari: number | null
  ayatKe: number | null
  nilai: number | null
  sikap: number | null
  status: 'lulus' | 'ulang' | null
  catatan: string | null
  /**
   * Halaman tahap Gharib/Tajwid adalah turunan materi yang disetor, bukan
   * isian — mengubahnya di sini membuat halaman dan materi saling bertentangan.
   */
  halamanTerkunci: boolean
}

export interface BarisProgres {
  id: string
  nama: string
  kelas: string | null
  /** tanggal 'YYYY-MM-DD' → setoran hari itu (tahfidz bisa >1 jenis). */
  sel: Record<string, SelProgres[]>
  /** Jumlah hari anak ini setor di bulan itu. */
  jumlahHari: number
  /** Posisi setoran pertama & terakhir bulan itu, dalam kata-kata. */
  awal: string | null
  akhir: string | null
  adabRendah: number
}

export interface ProgresSesi {
  /** Senin–Jumat bulan itu (+ akhir pekan yang ternyata ada setorannya), urut naik. */
  tanggal: string[]
  baris: BarisProgres[]
}

interface LogTahsinRekap {
  id: string
  jilid_id: string | null
  baris_dari: number | null
  baris_ke: number | null
  student_id: string
  setoran_date: string
  halaman: number | null
  status: 'lulus' | 'ulang'
  drill: boolean | null
  nilai_tahsin: unknown
  nilai_sikap: unknown
  catatan: string | null
  quran_halaman: number | null
  quran_surat_id: number | null
  quran_ayat_dari: number | null
  quran_ayat_ke: number | null
  jilid: { label: string } | null
}

interface LogTahfidzRekap {
  id: string
  student_id: string
  setoran_date: string
  kind: string
  surat_id: number
  ayat_dari: number | null
  ayat_ke: number | null
  nilai_tahfidz: unknown
  nilai_sikap: unknown
  catatan: string | null
  surat: { name_latin: string } | null
}

function bintangTeks(nilai: number | null): string {
  return nilai === null ? '—' : `${bintangDariNilai(nilai)}★`
}

function selTahsin(l: LogTahsinRekap, jilidMateri: Set<string>): SelProgres {
  const sikap = angka(l.nilai_sikap)
  const posisi = l.halaman !== null
    ? `${l.jilid?.label ?? 'Jilid'} halaman ${l.halaman}`
    : l.jilid?.label ?? ''
  const mushaf = l.quran_halaman !== null ? `mushaf halaman ${l.quran_halaman}` : ''
  return {
    label: l.halaman !== null ? String(l.halaman) : l.quran_halaman !== null ? `Q${l.quran_halaman}` : '✓',
    rinci: [
      [posisi, mushaf].filter(Boolean).join(' · '),
      `${l.status === 'ulang' ? 'Ulang' : 'Lulus'}${l.drill ? ' (drill)' : ''}`,
      `Nilai ${bintangTeks(angka(l.nilai_tahsin))} · Adab ${bintangTeks(sikap)}`,
      l.catatan ?? '',
    ].filter(Boolean).join('\n'),
    ulang: l.status === 'ulang',
    drill: Boolean(l.drill),
    adabRendah: adabRendah(sikap),
    sunting: {
      id: l.id,
      tabel: 'tahsin_logs',
      tanggal: l.setoran_date,
      judul: [posisi, mushaf].filter(Boolean).join(' · ') || 'Setoran tahsin',
      halaman: l.halaman,
      barisDari: l.baris_dari,
      barisKe: l.baris_ke,
      ayatDari: null,
      ayatKe: null,
      nilai: angka(l.nilai_tahsin),
      sikap,
      status: l.status,
      catatan: l.catatan,
      halamanTerkunci: l.jilid_id !== null && jilidMateri.has(l.jilid_id),
    },
  }
}

const SINGKATAN_JENIS: Record<string, string> = {
  ziyadah: 'Z', hafalan_baru: 'Z', murojaah_baru: 'MB', murojaah_lama: 'ML', murojaah: 'M',
}

function selTahfidz(l: LogTahfidzRekap): SelProgres {
  const sikap = angka(l.nilai_sikap)
  const jumlahAyat = l.ayat_dari !== null && l.ayat_ke !== null ? l.ayat_ke - l.ayat_dari + 1 : null
  const judul = `${labelJenisTahfidz(l.kind)} · ${l.surat?.name_latin ?? `Surat ${l.surat_id}`} ${l.ayat_dari ?? ''}–${l.ayat_ke ?? ''}`
  return {
    label: `${SINGKATAN_JENIS[l.kind] ?? '•'}${jumlahAyat !== null ? ` ${jumlahAyat}` : ''}`,
    rinci: [
      `${labelJenisTahfidz(l.kind)} · ${l.surat?.name_latin ?? `Surat ${l.surat_id}`} ${l.ayat_dari ?? ''}–${l.ayat_ke ?? ''}`,
      `Nilai ${bintangTeks(angka(l.nilai_tahfidz))} · Adab ${bintangTeks(sikap)}`,
      l.catatan ?? '',
    ].filter(Boolean).join('\n'),
    ulang: false,
    drill: false,
    adabRendah: adabRendah(sikap),
    sunting: {
      id: l.id,
      tabel: 'tahfidz_logs',
      tanggal: l.setoran_date,
      judul,
      halaman: null,
      barisDari: null,
      barisKe: null,
      ayatDari: l.ayat_dari,
      ayatKe: l.ayat_ke,
      nilai: angka(l.nilai_tahfidz),
      sikap,
      status: null,
      catatan: l.catatan,
      halamanTerkunci: true,
    },
  }
}

export async function getProgresSesi(halaqohId: string, periode: string, jenis: JenisRekap): Promise<ProgresSesi> {
  const supabase = createServerClient()
  const siswa = await siswaHalaqoh(supabase, [halaqohId])
  if (siswa.length === 0) return { tanggal: hariSekolah(periode), baris: [] }
  const ids = siswa.map(s => s.id)
  const { awal, akhir } = rentangBulan(periode)

  const perSiswa = new Map<string, { tanggal: string; sel: SelProgres; posisi: string | null }[]>()
  const catat = (id: string, x: { tanggal: string; sel: SelProgres; posisi: string | null }) =>
    perSiswa.set(id, [...(perSiswa.get(id) ?? []), x])

  if (jenis === 'tahsin') {
    const logs = await ambilSemua<LogTahsinRekap>((dari, sampai) => supabase
      .from('tahsin_logs')
      .select('id, jilid_id, baris_dari, baris_ke, student_id, setoran_date, halaman, status, drill, nilai_tahsin, nilai_sikap, catatan, quran_halaman, quran_surat_id, quran_ayat_dari, quran_ayat_ke, jilid:jilid_levels!tahsin_logs_jilid_id_fkey(label)')
      .in('student_id', ids)
      .gte('setoran_date', awal)
      .lt('setoran_date', akhir)
      .order('setoran_date')
      .order('created_at')
      .range(dari, sampai))
    // Tahap yang punya daftar materi (Gharib/Tajwid) — halamannya turunan.
    const { data: materiRows } = await supabase.from('tahsin_materi').select('jilid_id')
    const jilidMateri = new Set(((materiRows ?? []) as { jilid_id: string }[]).map(m => m.jilid_id))
    for (const l of logs) {
      catat(l.student_id, {
        tanggal: l.setoran_date,
        sel: selTahsin(l, jilidMateri),
        posisi: l.halaman !== null
          ? `${l.jilid?.label ?? ''} halaman ${l.halaman}`.trim()
          : l.quran_halaman !== null ? `${l.jilid?.label ?? ''} · mushaf halaman ${l.quran_halaman}`.trim() : l.jilid?.label ?? null,
      })
    }
  } else {
    const logs = await ambilSemua<LogTahfidzRekap>((dari, sampai) => supabase
      .from('tahfidz_logs')
      .select('id, student_id, setoran_date, kind, surat_id, ayat_dari, ayat_ke, nilai_tahfidz, nilai_sikap, catatan, surat:surat_master!tahfidz_logs_surat_id_fkey(name_latin)')
      .in('student_id', ids)
      .gte('setoran_date', awal)
      .lt('setoran_date', akhir)
      .order('setoran_date')
      .order('created_at')
      .range(dari, sampai))
    for (const l of logs) {
      catat(l.student_id, {
        tanggal: l.setoran_date,
        sel: selTahfidz(l),
        // Titik progres tahfidz = ziyadah; muroja'ah mengulang, bukan maju.
        posisi: l.kind === 'ziyadah' || l.kind === 'hafalan_baru'
          ? `${l.surat?.name_latin ?? `Surat ${l.surat_id}`} : ${l.ayat_ke ?? '?'}`
          : null,
      })
    }
  }

  const semuaTanggal = new Set<string>(hariSekolah(periode))
  const baris: BarisProgres[] = siswa.map(s => {
    const daftar = perSiswa.get(s.id) ?? []
    const sel: Record<string, SelProgres[]> = {}
    for (const d of daftar) {
      semuaTanggal.add(d.tanggal)
      ;(sel[d.tanggal] ??= []).push(d.sel)
    }
    const posisi = daftar.map(d => d.posisi).filter((p): p is string => Boolean(p))
    return {
      id: s.id,
      nama: s.full_name,
      kelas: s.kelas,
      sel,
      jumlahHari: Object.keys(sel).length,
      awal: posisi[0] ?? null,
      akhir: posisi[posisi.length - 1] ?? null,
      adabRendah: daftar.filter(d => d.sel.adabRendah).length,
    }
  })

  return { tanggal: [...semuaTanggal].sort(), baris }
}

// ─── Catatan adab ────────────────────────────────────────────────────────────

export interface KejadianAdab {
  tanggal: string
  jenis: string
  bintang: number
  catatan: string | null
}

export interface SiswaAdab {
  id: string
  nama: string
  kelas: string | null
  halaqoh_id: string
  kejadian: KejadianAdab[]
  /** Setoran bulan itu yang adabnya DINILAI — penyebut "3× dari 12". */
  dinilai: number
}

export interface CatatanAdab {
  /** Hanya anak yang punya ≥1 kejadian, urut terbanyak. */
  siswa: SiswaAdab[]
  jumlahSiswa: number
  totalDinilai: number
  totalRendah: number
}

export async function getCatatanAdab(halaqohIds: string[], periode: string): Promise<CatatanAdab> {
  const supabase = createServerClient()
  const siswa = await siswaHalaqoh(supabase, halaqohIds)
  if (siswa.length === 0) return { siswa: [], jumlahSiswa: 0, totalDinilai: 0, totalRendah: 0 }
  const ids = siswa.map(s => s.id)
  const { awal, akhir } = rentangBulan(periode)

  type Baris = { student_id: string; setoran_date: string; nilai_sikap: unknown; catatan: string | null; kind?: string }
  // Hanya setoran yang adabnya diisi: kosong berarti tidak dinilai, bukan nol.
  const [tahsin, tahfidz] = await Promise.all([
    ambilSemua<Baris>((dari, sampai) => supabase
      .from('tahsin_logs')
      .select('student_id, setoran_date, nilai_sikap, catatan')
      .in('student_id', ids)
      .gte('setoran_date', awal)
      .lt('setoran_date', akhir)
      .not('nilai_sikap', 'is', null)
      .order('setoran_date')
      .range(dari, sampai)),
    ambilSemua<Baris>((dari, sampai) => supabase
      .from('tahfidz_logs')
      .select('student_id, setoran_date, nilai_sikap, catatan, kind')
      .in('student_id', ids)
      .gte('setoran_date', awal)
      .lt('setoran_date', akhir)
      .not('nilai_sikap', 'is', null)
      .order('setoran_date')
      .range(dari, sampai)),
  ])

  const dinilai = new Map<string, number>()
  const kejadian = new Map<string, KejadianAdab[]>()
  const olah = (b: Baris, jenis: string) => {
    dinilai.set(b.student_id, (dinilai.get(b.student_id) ?? 0) + 1)
    const nilai = angka(b.nilai_sikap)
    if (!adabRendah(nilai)) return
    kejadian.set(b.student_id, [...(kejadian.get(b.student_id) ?? []), {
      tanggal: b.setoran_date, jenis, bintang: bintangDariNilai(nilai), catatan: b.catatan,
    }])
  }
  for (const b of tahsin) olah(b, 'Tahsin')
  for (const b of tahfidz) olah(b, `Tahfidz · ${labelJenisTahfidz(b.kind ?? '')}`)

  const hasil: SiswaAdab[] = siswa
    .filter(s => kejadian.has(s.id))
    .map(s => ({
      id: s.id,
      nama: s.full_name,
      kelas: s.kelas,
      halaqoh_id: s.halaqoh_id,
      kejadian: kejadian.get(s.id)!.sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
      dinilai: dinilai.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.kejadian.length - a.kejadian.length || a.nama.localeCompare(b.nama))

  return {
    siswa: hasil,
    jumlahSiswa: siswa.length,
    totalDinilai: tahsin.length + tahfidz.length,
    totalRendah: hasil.reduce((n, s) => n + s.kejadian.length, 0),
  }
}
