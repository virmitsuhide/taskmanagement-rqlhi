import { createServerClient } from '@/lib/supabase/server'
import { getJuzUjianPerSiswa, juzGabunganPerSiswa, type BarisJuzProgress } from '@/lib/data/hafalan'
import { UNIT_LABELS } from '@/lib/rq/programs'
import { tanggalWIB } from '@/lib/rq/ujian'
import {
  RENCANA, URUTAN_RENCANA, buatKurva, buatPetaHalaman, capaianSiswa, formatPosisi, kalenderBawaan,
  pilihRencana, posisiPada, progresKalender, selisihPekan, semesterKurva, statusTerhadapTarget,
  tahunAjaranDari, targetHalaman, tindakLanjutMurojaah,
  type AlasanTanpaTarget, type BulanKalender, type JenisSemester, type KodeRencana, type KurvaRencana,
  type PetaHalaman, type ProgresKalender, type StatusTarget,
} from '@/lib/rq/target-tahfidz'
import type { Jenjang } from '@/types'

// ─── Kalender ─────────────────────────────────────────────────────────────────

export interface KalenderTahfidz {
  tahunAjaran: string
  bulan: BulanKalender[]
  /**
   * 'bawaan' = perkiraan di kode, belum pernah disimpan RQ. Layar wajib
   * mengatakannya: target yang dihitung dari kalender tebakan tidak boleh
   * tampil seyakin target dari kalender resmi.
   */
  sumber: 'tersimpan' | 'bawaan'
  /** false = migrasi 0070 belum dijalankan; kalender belum bisa disimpan. */
  tabelAda: boolean
}

export async function getKalenderTahfidz(tahunAjaran: string): Promise<KalenderTahfidz> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('kalender_pekan_efektif')
    .select('bulan, semester, pekan_efektif')
    .eq('tahun_ajaran', tahunAjaran)
    .order('bulan')

  if (error) return { tahunAjaran, bulan: kalenderBawaan(tahunAjaran), sumber: 'bawaan', tabelAda: false }
  const rows = (data ?? []) as { bulan: string; semester: number; pekan_efektif: number | string }[]
  if (rows.length === 0) return { tahunAjaran, bulan: kalenderBawaan(tahunAjaran), sumber: 'bawaan', tabelAda: true }

  // Bulan yang belum pernah disimpan diisi dari pola bawaan, supaya kalender
  // yang baru disimpan separuh tidak membuat semester terpotong diam-diam.
  const tersimpan = new Map(rows.map(r => [r.bulan.slice(0, 7), r]))
  return {
    tahunAjaran,
    bulan: kalenderBawaan(tahunAjaran).map(b => {
      const r = tersimpan.get(b.bulan)
      return r ? { bulan: b.bulan, semester: (r.semester === 2 ? 2 : 1) as 1 | 2, pekan: Number(r.pekan_efektif) } : b
    }),
    sumber: 'tersimpan',
    tabelAda: true,
  }
}

// ─── Peta halaman & kurva (sekali per proses) ─────────────────────────────────

let petaCache: Promise<PetaHalaman> | null = null
const kurvaCache = new Map<KodeRencana, KurvaRencana>()

/** surat_master tidak pernah berubah; dibaca sekali lalu disimpan. */
async function getPetaHalaman(): Promise<PetaHalaman> {
  if (!petaCache) {
    petaCache = (async () => {
      const { data, error } = await createServerClient().from('surat_master').select('id, total_ayat')
      if (error || !data || data.length !== 114) {
        petaCache = null
        throw new Error('surat_master tidak terbaca — target tahfidz tidak bisa dihitung.')
      }
      return buatPetaHalaman(new Map((data as { id: number; total_ayat: number }[]).map(r => [r.id, r.total_ayat])))
    })()
  }
  return petaCache
}

function kurvaDari(kode: KodeRencana, peta: PetaHalaman): KurvaRencana {
  let k = kurvaCache.get(kode)
  if (!k) { k = buatKurva(RENCANA[kode], peta); kurvaCache.set(kode, k) }
  return k
}

// ─── Tabel target akhir bulan ─────────────────────────────────────────────────

export interface BarisTargetBulan {
  bulan: string
  semester: 1 | 2
  jenis: JenisSemester
  pekanEfektif: number
  /** Pekan efektif kumulatif dalam semester sampai akhir bulan ini. */
  pekanKumulatif: number
  targetTeks: string
  halaman: number
  /** Bagian materi setahun (tingkat ini) yang semestinya sudah dihafal, 0–1. */
  persenTahun: number
}

export interface TabelTargetBulanan {
  kode: KodeRencana
  tingkat: number
  /** Materi setahun, dari posisi awal ke posisi akhir. */
  awalTeks: string
  akhirTeks: string
  halamanSetahun: number
  baris: BarisTargetBulan[]
}

export async function getTabelTargetBulanan(kode: KodeRencana, tingkat: number, kalender: BulanKalender[]): Promise<TabelTargetBulanan | null> {
  const peta = await getPetaHalaman()
  const kurva = kurvaDari(kode, peta)
  const s1 = semesterKurva(kurva, tingkat, 1)
  const s2 = semesterKurva(kurva, tingkat, 2)
  if (!s1 || !s2) return null

  const setahun = s2.akhir - s1.mulai
  const pekanKum = new Map<1 | 2, number>([[1, 0], [2, 0]])
  const baris = [...kalender].sort((a, b) => a.bulan.localeCompare(b.bulan)).map(b => {
    pekanKum.set(b.semester, (pekanKum.get(b.semester) ?? 0) + b.pekan)
    const t = targetHalaman(kurva, tingkat, progresKalender(kalender, `${b.bulan}-01`, true))!
    return {
      bulan: b.bulan,
      semester: b.semester,
      jenis: t.semester.jenis,
      pekanEfektif: b.pekan,
      pekanKumulatif: pekanKum.get(b.semester) ?? 0,
      targetTeks: t.semester.jenis === 'murojaah' ? 'Murojaah & ujian' : formatPosisi(posisiPada(kurva, peta, t.halaman), peta),
      halaman: t.halaman,
      persenTahun: setahun > 0 ? (t.halaman - s1.mulai) / setahun : 1,
    }
  })

  const awal = kurva.item.find(i => i.mulai >= s1.mulai - 1e-9 && i.akhir > s1.mulai + 1e-9)
  return {
    kode, tingkat,
    // Awal materi yang jatuh di ayat 1 cukup disebut nama surahnya — "An-Nas 1"
    // terbaca seolah hafalan berhenti di ayat pertama.
    awalTeks: setahun > 0 && awal
      ? (awal.dari === 1 ? formatPosisi({ surat: awal.surat, ayat: peta.panjang(awal.surat) }, peta) : formatPosisi({ surat: awal.surat, ayat: awal.dari }, peta))
      : '—',
    akhirTeks: setahun > 0 ? formatPosisi(posisiPada(kurva, peta, s2.akhir), peta) : '—',
    halamanSetahun: setahun,
    baris,
  }
}

// ─── Posisi siswa terhadap target ─────────────────────────────────────────────

export type StatusSiswa = StatusTarget | 'belum_terukur' | 'tanpa_target'

export interface SiswaTarget {
  id: string
  nama: string
  jenjang: Jenjang
  kelas: string | null
  halaqoh: string | null
  asalSdLhi: boolean
  rencana: KodeRencana | null
  tingkat: number | null
  alasan: AlasanTanpaTarget | null
  status: StatusSiswa
  capaianTeks: string | null
  /** 'juz' = hanya dari juz tuntas (umumnya ujian) — batas bawah, bukan posisi pasti. */
  sumberCapaian: 'setoran' | 'juz' | null
  targetTeks: string | null
  /** Positif = mendahului target. null bila salah satu sisi tidak ada. */
  selisihPekan: number | null
  /** Selisih yang sama dalam halaman — lebih terbaca bila jaraknya berbulan-bulan. */
  selisihHalaman: number | null
  jenisSemester: JenisSemester | null
  /** Hanya di semester murojaah. */
  tindakLanjut: string | null
  perluDiujikan: boolean
}

export type RingkasStatus = Record<StatusSiswa, number> & { total: number; perluDiujikan: number }

const ringkasKosong = (): RingkasStatus => ({
  di_bawah: 0, sesuai: 0, di_atas: 0, belum_terukur: 0, tanpa_target: 0, total: 0, perluDiujikan: 0,
})

function tambahRingkas(r: RingkasStatus, s: SiswaTarget) {
  r[s.status]++
  r.total++
  if (s.perluDiujikan) r.perluDiujikan++
}

export interface TargetTahfidzData {
  tanggal: string
  kalender: KalenderTahfidz
  progres: ProgresKalender
  siswa: SiswaTarget[]
  perUnit: { jenjang: Jenjang; label: string; ringkas: RingkasStatus }[]
  perRencana: { kode: KodeRencana; ringkas: RingkasStatus; perTingkat: { tingkat: number; jenis: JenisSemester; ringkas: RingkasStatus }[] }[]
  /** false = migrasi 0070 belum dijalankan; semua SMP terbaca eksternal. */
  kolomAsalAda: boolean
}

/** Ambil seluruh baris melewati batas 1000 baris PostgREST. */
async function ambilSemua<T>(buat: (dari: number, ke: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buat(dari, dari + 999)
    if (error) return { rows, error: error.message }
    const potong = (data ?? []) as T[]
    rows.push(...potong)
    if (potong.length < 1000) return { rows, error: null }
  }
}

interface BarisSiswa {
  id: string
  full_name: string
  jenjang: Jenjang
  kelas: string | null
  program: string | null
  asal_sd_lhi?: boolean
  halaqoh: { name: string } | null
}

export async function getTargetTahfidz(jenjangBoleh: Jenjang[], tanggal = tanggalWIB(new Date())): Promise<TargetTahfidzData> {
  const supabase = createServerClient()
  const kalender = await getKalenderTahfidz(tahunAjaranDari(tanggal))

  const kolom = 'id, full_name, jenjang, kelas, program, halaqoh:halaqoh!students_halaqoh_id_fkey(name)'
  const ambilSiswa = (denganAsal: boolean) => ambilSemua<BarisSiswa>((dari, ke) =>
    supabase.from('students').select(denganAsal ? `${kolom}, asal_sd_lhi` : kolom)
      .eq('is_active', true).in('jenjang', jenjangBoleh).order('full_name').range(dari, ke))

  const [peta, siswaAwal, logs, juzProgress, juzUjian] = await Promise.all([
    getPetaHalaman(),
    ambilSiswa(true),
    ambilSemua<{ student_id: string; surat_id: number; ayat_ke: number }>((dari, ke) =>
      supabase.from('tahfidz_logs').select('student_id, surat_id, ayat_ke').eq('kind', 'ziyadah').range(dari, ke)),
    ambilSemua<BarisJuzProgress>((dari, ke) =>
      supabase.from('juz_progress').select('student_id, juz_number, ayat_hafal, mutqin').range(dari, ke)),
    getJuzUjianPerSiswa(),
  ])

  // Migrasi 0070 belum jalan → kolom asal_sd_lhi belum ada. Halaman tetap
  // hidup; semua siswa SMP terbaca eksternal, dan layar mengatakannya.
  let kolomAsalAda = true
  let siswaRows = siswaAwal
  if (siswaAwal.error) {
    kolomAsalAda = false
    siswaRows = await ambilSiswa(false)
    if (siswaRows.error) throw new Error(`Data siswa tidak terbaca: ${siswaRows.error}`)
  }

  const juzTuntas = juzGabunganPerSiswa(juzProgress.rows, juzUjian)
  const ziyadahPerSiswa = new Map<string, { surat_id: number; ayat_ke: number }[]>()
  for (const l of logs.rows) {
    const daftar = ziyadahPerSiswa.get(l.student_id) ?? []
    daftar.push(l)
    ziyadahPerSiswa.set(l.student_id, daftar)
  }

  const progresHariIni = progresKalender(kalender.bulan, tanggal)

  const siswa: SiswaTarget[] = siswaRows.rows.map(r => {
    const asalSdLhi = r.asal_sd_lhi === true
    const dasar = {
      id: r.id, nama: r.full_name, jenjang: r.jenjang, kelas: r.kelas, halaqoh: r.halaqoh?.name ?? null, asalSdLhi,
    }
    const pilihan = pilihRencana({ jenjang: r.jenjang, program: r.program, kelas: r.kelas, asal_sd_lhi: asalSdLhi })
    if ('alasan' in pilihan) {
      return {
        ...dasar, rencana: null, tingkat: null, alasan: pilihan.alasan, status: 'tanpa_target' as const,
        capaianTeks: null, sumberCapaian: null, targetTeks: null, selisihPekan: null, selisihHalaman: null,
        jenisSemester: null, tindakLanjut: null, perluDiujikan: false,
      }
    }

    const kurva = kurvaDari(pilihan.kode, peta)
    const target = targetHalaman(kurva, pilihan.tingkat, progresHariIni)!
    const capaian = capaianSiswa(kurva, peta, {
      juzTuntas: juzTuntas.get(r.id) ?? 0,
      ziyadah: ziyadahPerSiswa.get(r.id) ?? [],
    })
    const jenis = target.semester.jenis
    const targetTeks = jenis === 'murojaah'
      ? `Tuntas ${formatPosisi(posisiPada(kurva, peta, target.halaman), peta)} & diujikan`
      : formatPosisi(posisiPada(kurva, peta, target.halaman), peta)

    if (capaian === null) {
      return {
        ...dasar, rencana: pilihan.kode, tingkat: pilihan.tingkat, alasan: null, status: 'belum_terukur' as const,
        capaianTeks: null, sumberCapaian: null, targetTeks, selisihPekan: null, selisihHalaman: null,
        jenisSemester: jenis, tindakLanjut: null, perluDiujikan: false,
      }
    }

    const selisih = selisihPekan(capaian.halaman, target.halaman, target.semester.laju)
    const lanjut = jenis === 'murojaah' ? tindakLanjutMurojaah(kurva, peta, capaian.halaman, juzUjian.get(r.id) ?? 0) : null
    return {
      ...dasar, rencana: pilihan.kode, tingkat: pilihan.tingkat, alasan: null,
      status: statusTerhadapTarget(selisih),
      capaianTeks: formatPosisi(posisiPada(kurva, peta, capaian.halaman), peta),
      sumberCapaian: capaian.sumber,
      targetTeks, selisihPekan: selisih, selisihHalaman: capaian.halaman - target.halaman, jenisSemester: jenis,
      tindakLanjut: lanjut?.teks ?? null,
      perluDiujikan: (lanjut?.perluDiujikan.length ?? 0) > 0,
    }
  })

  const perUnit = jenjangBoleh.map(jenjang => {
    const ringkas = ringkasKosong()
    siswa.filter(s => s.jenjang === jenjang).forEach(s => tambahRingkas(ringkas, s))
    return { jenjang, label: UNIT_LABELS[jenjang], ringkas }
  }).filter(u => u.ringkas.total > 0)

  const perRencana = URUTAN_RENCANA.map(kode => {
    const ringkas = ringkasKosong()
    const anggota = siswa.filter(s => s.rencana === kode)
    anggota.forEach(s => tambahRingkas(ringkas, s))
    const kurva = kurvaDari(kode, peta)
    const perTingkat = RENCANA[kode].tingkat.map(t => {
      const rt = ringkasKosong()
      anggota.filter(s => s.tingkat === t.tingkat).forEach(s => tambahRingkas(rt, s))
      const jenis = semesterKurva(kurva, t.tingkat, progresHariIni.semester)?.jenis ?? 'hafalan'
      return { tingkat: t.tingkat, jenis, ringkas: rt }
    })
    return { kode, ringkas, perTingkat }
  }).filter(r => r.ringkas.total > 0)

  return { tanggal, kalender, progres: progresHariIni, siswa, perUnit, perRencana, kolomAsalAda }
}
