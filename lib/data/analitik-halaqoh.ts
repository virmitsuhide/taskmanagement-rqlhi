import { createServerClient } from '@/lib/supabase/server'
import { shiftPeriod } from '@/lib/finance/period'
import { tanggalWIB } from '@/lib/rq/ujian'
import { cocokProgram } from '@/lib/rq/programs'
import { ayatPerJuz } from '@/lib/rq/batas-juz'
import { halamanRentang } from '@/lib/rq/murojaah'
import { hitungJuzHafalan, posisiJuz } from '@/lib/rq/hafalan'
import { jalurSetoran } from '@/lib/rq/jalur'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { getInfoSurat } from '@/lib/data/nama-surat'
import { getSiswaUrutanBebas, juzBerjalanPerSiswa } from '@/lib/data/hafalan'
import { getHariKosong } from '@/lib/data/kalender-quran'
import { hitungTM, type HariKosong, type JadwalProgram } from '@/lib/rq/kalender-quran'
import { tingkatOf } from '@/lib/rq/sesi'
import {
  URUTAN_TAHSIN, ambilPerPotongSejajar, kolomTahsin, pembacaTahfidz, progresDariZiyadah,
} from '@/lib/data/capaian-kelas'
import type { Jenjang } from '@/types'

/**
 * Analitik per halaqoh — satu kartu per halaqoh aktif, dibandingkan
 * bulan demi bulan.
 *
 * Keanggotaannya keanggotaan HARI INI (students.halaqoh_id): yang dibaca
 * adalah perjalanan kelompok anak yang sama dari bulan ke bulan, bukan
 * susunan halaqoh di bulan itu. Anak yang pindah halaqoh membawa riwayatnya.
 *
 * Dua jenis angka, dengan aturan berbeda:
 *
 *   ALIRAN (per bulan) — capaian tahsin & tahfidz. Hanya setoran jalur
 *   SEKOLAH: ekstra, TR, Riyadhoh, dan asrama tidak ikut, supaya peringkat
 *   antar-guru tidak ditentukan oleh siapa yang anaknya ikut ekstra.
 *     tahsin  = halaman lulus (unik, bukan drill) per anak yang masih tahsin
 *     tahfidz = halaman mushaf ziyadah per anak
 *
 *   POSISI (per akhir bulan) — rata-rata jilid & hafalan. Disusun ulang dari
 *   riwayat bertanggal dengan aturan yang sama dengan Capaian per Kelas
 *   (kolomTahsin, pembacaTahfidz), supaya bulan lalu terbaca sebagaimana
 *   adanya saat itu, bukan posisi hari ini.
 *
 * Drill mengikuti definisi Analitik BTHCQ: jumlah anak sedang drill dan
 * rata-rata lamanya (hari).
 */

export type MetrikHalaqoh = 'tahsin' | 'tahfidz' | 'jilid' | 'hafalan'

export interface DrillBulan {
  anak: number
  /** null = lamanya tidak tercatat untuk bulan itu. */
  rataHari: number | null
}

export interface TitikHalaqoh {
  bulan: string
  /**
   * Sudah ada setoran anak halaqoh ini pada atau sebelum bulan ini. false =
   * sebelum aplikasi dipakai: seluruh angka null — "belum ada data", bukan nol.
   */
  adaData: boolean
  /** Rata-rata halaman tahsin lulus per anak; null = tidak berlaku (semua sudah Lulus Tahsin). */
  tahsin: number | null
  /** Rata-rata halaman mushaf ziyadah per anak. */
  tahfidz: number | null
  /** Rata-rata indeks tahap (URUTAN_TAHSIN); null = belum ada posisi tercatat. */
  jilid: number | null
  /** Rata-rata juz hafalan (tuntas + bagian juz yang sedang dihafal). */
  hafalan: number | null
  /** Banyak anak yang menjadi penyebut tahsin & jilid. */
  nTahsin: number
  nJilid: number
  drillJilid: DrillBulan
  drillJuz: DrillBulan
  /**
   * Pertemuan (TM) bulan itu — keterangan di samping capaian per anak.
   * Dari Kalender Qur'an bila koor sudah mengatur jadwal programnya atau
   * menandai hari kosong angkatannya di bulan itu; selain itu 16.
   * Anak satu halaqoh bisa berbeda TM (QULS + Jum'at): yang ditampilkan
   * TM terbanyak anggotanya.
   */
  pertemuan: { tm: number; dariKalender: boolean } | null
  /**
   * Kelengkapan isian Capaian Bulanan (student_monthly) per anak, berupa nama
   * anak: lengkap = awal & akhir terisi (sebelum RUMUS_AWAL_AKHIR_SEJAK:
   * tahsin & tahfidz terisi), sebagian = salah satunya, kosong = keduanya
   * belum. null = bulan sebelum MULAI_LAPORAN_BULANAN.
   */
  isian: IsianBulan | null
}

export interface IsianBulan {
  lengkap: string[]
  sebagian: string[]
  kosong: string[]
}

/** Pertemuan sebulan bila koor belum mengatur Kalender Qur'an. */
export const PERTEMUAN_BAWAAN = 16
/** Laporan per bulan di kartu dimulai September 2026. */
export const MULAI_LAPORAN_BULANAN = '2026-09'
/**
 * Sejak bulan ini isian bulanan dianggap lengkap bila awal & akhir bulan
 * terisi. Bulan sebelumnya (September 2026) cukup tahsin & tahfidz terisi —
 * kebijakan Kumik, karena kewajiban isian awal bulan baru berlaku Oktober.
 */
export const RUMUS_AWAL_AKHIR_SEJAK = '2026-10'

export interface GuruKartu {
  id: string
  nama: string
  /** L berpeci, P berkerudung; null = belum diketahui. */
  gender: 'L' | 'P' | null
}

export interface KartuHalaqoh {
  id: string
  nama: string
  jenjang: Jenjang
  /** Program halaqoh (mis. 'quls'); null = reguler. */
  program: string | null
  sesi: number | null
  guru: GuruKartu | null
  siswa: number
  /** Lama → baru; yang terakhir = bulan terpilih. */
  titik: TitikHalaqoh[]
}

export interface AnalitikHalaqoh {
  /** Bulan-bulan pembanding, lama → baru. */
  bulan: string[]
  /** Bulan terpilih masih berjalan — angka alirannya belum genap sebulan. */
  berjalan: boolean
  kartu: KartuHalaqoh[]
}

/** Jumlah bulan yang dibandingkan di tiap kartu. */
export const JENDELA_BULAN = 6

const ZIYADAH = ['ziyadah', 'hafalan_baru']

function akhirBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  return `${bulan}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

const satuDesimal = (n: number) => Math.round(n * 10) / 10
const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const selisihHari = (dari: string, ke: string) =>
  Math.max(0, Math.round((new Date(ke).getTime() - new Date(dari).getTime()) / 86_400_000))

/**
 * Jenis kelamin guru untuk avatar: kolom gender, lalu sapaan akun, lalu
 * panggilan di nama halaqoh ("Sesi 1 — Ustadzah Ani"). Banyak akun lama
 * belum mengisi gender, dan nama halaqoh-lah yang paling konsisten.
 */
function tebakGender(gender: string | null, sapaan: string | null, namaHalaqoh: string): 'L' | 'P' | null {
  if (gender === 'L' || gender === 'P') return gender
  if (sapaan === 'usth') return 'P'
  if (sapaan === 'ust') return 'L'
  if (/\bustadzah\b|\busth\b/i.test(namaHalaqoh)) return 'P'
  if (/\bustadz\b|\bust\b/i.test(namaHalaqoh)) return 'L'
  return null
}

interface BarisBulanan {
  student_id: string
  period: string
  halaman_awal_tahsin: string
  tahfidz_awal: string
  halaman_akhir_tahsin: string
  tahfidz_akhir: string
}

interface Siswa {
  id: string
  halaqoh_id: string
  full_name: string
  jenjang: Jenjang
  kelas: string | null
  program: string | null
  current_jilid_id: string | null
  tahsin_drill_sejak: string | null
}

interface LogTahsin {
  student_id: string
  setoran_date: string
  jilid_id: string | null
  halaman: number | null
  quran_halaman: number | null
  status: string | null
  drill: boolean | null
  ekstra_slot_id?: string | null
  tahsin_rekomendasi?: boolean | null
  riyadhoh?: boolean | null
  asrama?: boolean | null
}

interface LogZiyadah {
  student_id: string
  setoran_date: string
  surat_id: number
  surat_ke_id?: number | null
  ayat_dari: number | null
  ayat_ke: number | null
  ekstra_slot_id?: string | null
  tahsin_rekomendasi?: boolean | null
  riyadhoh?: boolean | null
  asrama?: boolean | null
}

export async function getAnalitikHalaqoh(opsi: {
  jenjang: Jenjang[]
  bulan: string
  program?: readonly string[] | null
}): Promise<AnalitikHalaqoh> {
  const hariIni = tanggalWIB(new Date())
  const bulanKini = hariIni.slice(0, 7)
  const daftarBulan = Array.from({ length: JENDELA_BULAN }, (_, i) => shiftPeriod(opsi.bulan, i - (JENDELA_BULAN - 1)))
  const kosong: AnalitikHalaqoh = { bulan: daftarBulan, berjalan: opsi.bulan === bulanKini, kartu: [] }
  if (opsi.jenjang.length === 0) return kosong

  const supabase = createServerClient()
  const [halaqohRes, siswaRes, levelRes] = await Promise.all([
    supabase.from('halaqoh')
      .select('id, name, jenjang, sesi, program, wali:teachers!halaqoh_wali_teacher_id_fkey(id, full_name, gender, sapaan)')
      .eq('is_active', true).in('jenjang', opsi.jenjang),
    supabase.from('students')
      .select('id, halaqoh_id, full_name, jenjang, kelas, program, current_jilid_id, tahsin_drill_sejak')
      .eq('is_active', true).in('jenjang', opsi.jenjang).not('halaqoh_id', 'is', null)
      .limit(5000),
    supabase.from('jilid_levels').select('id, label, is_quran, is_terminal'),
  ])

  type BarisHalaqoh = {
    id: string; name: string; jenjang: Jenjang; sesi: number | null; program: string | null
    wali: { id: string; full_name: string; gender: string | null; sapaan: string | null } | null
  }
  const halaqoh = (halaqohRes.data ?? []) as unknown as BarisHalaqoh[]
  const programHalaqoh = new Map(halaqoh.map(h => [h.id, h.program]))
  const siswa = ((siswaRes.data ?? []) as Siswa[])
    .filter(s => programHalaqoh.has(s.halaqoh_id))
    // Koor QULS SD: hanya anak QULS (program anak, atau program halaqohnya).
    .filter(s => !opsi.program || cocokProgram(opsi.program, s.program ?? programHalaqoh.get(s.halaqoh_id)))
  if (siswa.length === 0) return kosong

  const ids = siswa.map(s => s.id)
  const awalJendela = `${daftarBulan[0]}-01`
  const akhirJendela = akhirBulan(opsi.bulan)

  const [logTahsinJendela, logTahsinPosisi, promosiJilid, logZiyadah, promosiJuz, ujian, drillJuz, peta, infoSurat, bebas, kalender, bulanan] = await Promise.all([
    // '*' supaya penanda jalur (ekstra/TR/riyadhoh/asrama) ikut bila kolomnya ada.
    ambilPerPotongSejajar<LogTahsin>(ids, p => supabase.from('tahsin_logs').select('*')
      .in('student_id', p).gte('setoran_date', awalJendela).lte('setoran_date', akhirJendela).order('id')),
    // Untuk posisi jilid: seluruh riwayat, kolom seperlunya.
    ambilPerPotongSejajar<{ student_id: string; setoran_date: string; jilid_id: string | null }>(ids, p => supabase.from('tahsin_logs')
      .select('student_id, setoran_date, jilid_id').in('student_id', p).order('id')),
    ambilPerPotongSejajar<{ student_id: string; to_jilid_id: string; promotion_date: string }>(ids, p => supabase.from('jilid_promotions')
      .select('student_id, to_jilid_id, promotion_date').in('student_id', p).order('id')),
    ambilPerPotongSejajar<LogZiyadah>(ids, p => supabase.from('tahfidz_logs').select('*')
      .in('student_id', p).in('kind', ZIYADAH).lte('setoran_date', akhirJendela).order('id')),
    ambilPerPotongSejajar<{ student_id: string; juz_number: number; promotion_date: string }>(ids, p => supabase.from('juz_promotions')
      .select('student_id, juz_number, promotion_date').in('student_id', p).order('id')),
    // Selesai & tidak mengulang — aturan yang sama dengan riwayatSampai.
    ambilPerPotongSejajar<{ student_id: string; juz: string; jadwal: string | null }>(ids, p => supabase.from('ujian_tahfidz')
      .select('student_id, juz, jadwal').in('student_id', p).eq('status', 'selesai')
      .or('predikat.is.null,predikat.neq.mengulang').order('id')),
    ambilPerPotongSejajar<{ student_id: string; selesai_ziyadah: string; ujian: { created_at: string } | null }>(ids, p => supabase
      .from('tahfidz_juz_drill').select('student_id, selesai_ziyadah, ujian:ujian_tahfidz(created_at)')
      .in('student_id', p).order('id')),
    getPetaHalaman().catch(() => null),
    getInfoSurat(),
    getSiswaUrutanBebas(),
    kalenderJendela(supabase, opsi.jenjang, awalJendela, akhirJendela),
    opsi.bulan < MULAI_LAPORAN_BULANAN
      ? Promise.resolve([] as BarisBulanan[])
      : ambilPerPotongSejajar<BarisBulanan>(ids, p => supabase.from('student_monthly')
          .select('student_id, period, halaman_awal_tahsin, tahfidz_awal, halaman_akhir_tahsin, tahfidz_akhir')
          .in('student_id', p).gte('period', `${MULAI_LAPORAN_BULANAN}-01`).lte('period', `${opsi.bulan}-01`).order('id')),
  ])

  // Isian Capaian Bulanan per `bulan|student_id`, dibaca dua sumbu:
  //   awal/akhir    — kolom tahsin ATAU tahfidz-nya terisi (anak tahfidz tak punya tahsin)
  //   tahsin/tahfidz — kolom awal ATAU akhir-nya terisi
  const terisi = (...xs: (string | null)[]) => xs.some(x => !!x?.trim())
  const isianAnak = new Map(bulanan.map(b => [`${b.period.slice(0, 7)}|${b.student_id}`, {
    awal: terisi(b.halaman_awal_tahsin, b.tahfidz_awal),
    akhir: terisi(b.halaman_akhir_tahsin, b.tahfidz_akhir),
    tahsin: terisi(b.halaman_awal_tahsin, b.halaman_akhir_tahsin),
    tahfidz: terisi(b.tahfidz_awal, b.tahfidz_akhir),
  }]))
  const isianBulan = (anak: Siswa[], bulan: string, lulusTahsin: (s: Siswa) => boolean): IsianBulan | null => {
    if (bulan < MULAI_LAPORAN_BULANAN) return null
    // Sebelum RUMUS_AWAL_AKHIR_SEJAK patokannya tahsin & tahfidz terisi —
    // anak yang sudah Lulus Tahsin cukup tahfidz; sejak itu harus awal & akhir bulan.
    const rumusLama = bulan < RUMUS_AWAL_AKHIR_SEJAK
    const hasil: IsianBulan = { lengkap: [], sebagian: [], kosong: [] }
    for (const s of anak) {
      const i = isianAnak.get(`${bulan}|${s.id}`)
      const syarat = !i ? [false]
        : !rumusLama ? [i.awal, i.akhir]
        : lulusTahsin(s) ? [i.tahfidz]
        : [i.tahsin, i.tahfidz]
      hasil[syarat.every(Boolean) ? 'lengkap' : syarat.some(Boolean) ? 'sebagian' : 'kosong'].push(s.full_name)
    }
    return hasil
  }

  const level = new Map(((levelRes.data ?? []) as { id: string; label: string; is_quran: boolean; is_terminal: boolean }[])
    .map(l => [l.id, l]))
  const indeksJilid = (jilidId: string | null): number | null => {
    const l = jilidId ? level.get(jilidId) : undefined
    if (!l) return null
    const i = (URUTAN_TAHSIN as readonly string[]).indexOf(kolomTahsin(l))
    return i >= 0 ? i : null
  }
  const iLulus = URUTAN_TAHSIN.length - 1

  // Jumlah ayat tiap juz — penyebut bagian juz yang sedang dihafal.
  const ayatJuz = new Map<number, number>()
  for (const [surat, info] of infoSurat) {
    for (const [juz, n] of ayatPerJuz(surat, 1, info.total_ayat)) ayatJuz.set(juz, (ayatJuz.get(juz) ?? 0) + n)
  }

  // Riwayat per siswa, terurut tanggal — dibaca berulang untuk tiap akhir bulan.
  const kelompokkan = <T extends { student_id: string }>(rows: T[], tgl: (r: T) => string) => {
    const peta = new Map<string, T[]>()
    for (const r of rows) peta.set(r.student_id, [...(peta.get(r.student_id) ?? []), r])
    for (const d of peta.values()) d.sort((a, b) => tgl(a).localeCompare(tgl(b)))
    return peta
  }
  const posisiPer = kelompokkan(logTahsinPosisi, r => r.setoran_date)
  const promosiPer = kelompokkan(promosiJilid, r => r.promotion_date)

  /** Jilid siswa di akhir hari `e` — cermin jilidSiswa di capaian-kelas. */
  const jilidPada = (s: Siswa, e: string): string | null => {
    const log = posisiPer.get(s.id) ?? []
    const naik = promosiPer.get(s.id) ?? []
    const bergerakSesudah = log.some(l => l.setoran_date > e) || naik.some(n => n.promotion_date > e)
    if (!bergerakSesudah) return s.current_jilid_id
    const l = log.filter(x => x.setoran_date <= e && x.jilid_id).at(-1)
    const n = naik.filter(x => x.promotion_date <= e).at(-1)
    if (n && (!l || n.promotion_date >= l.setoran_date)) return n.to_jilid_id
    return l?.jilid_id ?? null
  }

  /** Juz hafalan semua siswa di akhir hari `e`. */
  const hafalanPada = (e: string): Map<string, number> => {
    const juzNaik = new Map<string, Set<number>>()
    for (const r of promosiJuz) {
      if (r.promotion_date > e) continue
      juzNaik.set(r.student_id, (juzNaik.get(r.student_id) ?? new Set<number>()).add(r.juz_number))
    }
    const teks = new Map<string, string[]>()
    for (const u of ujian) {
      if (u.jadwal && tanggalWIB(u.jadwal) > e) continue
      teks.set(u.student_id, [...(teks.get(u.student_id) ?? []), String(u.juz)])
    }
    const juzUjian = new Map<string, number>()
    for (const [id, d] of teks) juzUjian.set(id, hitungJuzHafalan(d, bebas.has(id)))

    const progres = progresDariZiyadah(logZiyadah.filter(l => l.setoran_date <= e), juzNaik)
    const baca = pembacaTahfidz(progres, juzUjian, bebas)
    const berjalan = juzBerjalanPerSiswa(progres)
    const ayatDi = new Map(progres.map(r => [`${r.student_id}|${r.juz_number}`, r.ayat_hafal]))

    const hasil = new Map<string, number>()
    for (const id of ids) {
      const { tuntas } = baca(id)
      let nilai = tuntas
      // Bagian juz yang sedang dihafal, bila juz itu belum terhitung tuntas.
      const j = berjalan.get(id)
      if (j !== undefined && !bebas.has(id) && (posisiJuz(j) ?? 0) > tuntas) {
        const total = ayatJuz.get(j) ?? 0
        if (total > 0) nilai += Math.min(0.99, (ayatDi.get(`${id}|${j}`) ?? 0) / total)
      }
      hasil.set(id, nilai)
    }
    return hasil
  }

  // ── Aliran per bulan: halaman tahsin lulus & halaman ziyadah, jalur sekolah ──
  const halTahsin = new Map<string, Set<string>>() // `${bulan}|${id}` → halaman unik
  const drillTahsinBulan = new Map<string, Set<string>>() // bulan → siswa yang setor drill
  for (const l of logTahsinJendela) {
    const b = l.setoran_date.slice(0, 7)
    if (l.drill) drillTahsinBulan.set(b, (drillTahsinBulan.get(b) ?? new Set<string>()).add(l.student_id))
    if (l.status !== 'lulus' || l.drill || jalurSetoran(l) !== 'sekolah') continue
    const kunci = l.halaman !== null ? `${l.jilid_id}|${l.halaman}` : l.quran_halaman !== null ? `Q|${l.quran_halaman}` : null
    if (!kunci) continue
    const k = `${b}|${l.student_id}`
    halTahsin.set(k, (halTahsin.get(k) ?? new Set<string>()).add(kunci))
  }
  const halTahfidz = new Map<string, number>()
  if (peta) {
    for (const l of logZiyadah) {
      if (l.setoran_date < awalJendela || jalurSetoran(l) !== 'sekolah') continue
      const k = `${l.setoran_date.slice(0, 7)}|${l.student_id}`
      halTahfidz.set(k, (halTahfidz.get(k) ?? 0) + halamanRentang(peta, {
        surat_id: l.surat_id, ayat_dari: l.ayat_dari, surat_ke_id: l.surat_ke_id ?? null, ayat_ke: l.ayat_ke,
      }))
    }
  }

  // Bulan pertama tiap siswa punya setoran apa pun (semua jalur, dalam jendela).
  const bulanPertama = new Map<string, string>()
  for (const l of [...logTahsinJendela, ...logZiyadah]) {
    if (l.setoran_date < awalJendela) { bulanPertama.set(l.student_id, '0000-00'); continue }
    const b = l.setoran_date.slice(0, 7)
    if ((bulanPertama.get(l.student_id) ?? '9999-99') > b) bulanPertama.set(l.student_id, b)
  }

  // ── Posisi per akhir bulan ──
  const perBulan = daftarBulan.map(bulan => {
    // Bulan berjalan dibaca sampai hari ini, bukan akhir bulan.
    const e = bulan === bulanKini ? hariIni : akhirBulan(bulan)
    const jilid = new Map(siswa.map(s => [s.id, indeksJilid(jilidPada(s, e))]))
    // Drill juz: juz yang ziyadahnya tuntas s.d. e dan belum diajukan ujian s.d. e.
    const lamaJuz = new Map<string, number>()
    for (const d of drillJuz) {
      if (d.selesai_ziyadah > e) continue
      if (d.ujian && tanggalWIB(d.ujian.created_at) <= e) continue
      lamaJuz.set(d.student_id, Math.max(lamaJuz.get(d.student_id) ?? 0, selisihHari(d.selesai_ziyadah, e)))
    }
    return { bulan, e, jilid, hafalan: hafalanPada(e), lamaJuz }
  })

  const anggota = new Map<string, Siswa[]>()
  for (const s of siswa) anggota.set(s.halaqoh_id, [...(anggota.get(s.halaqoh_id) ?? []), s])

  const kartu: KartuHalaqoh[] = halaqoh
    .filter(h => anggota.has(h.id))
    .map(h => {
      const anak = anggota.get(h.id)!
      const mulai = anak.map(s => bulanPertama.get(s.id) ?? '9999-99').sort()[0]
      const titik = perBulan.map(({ bulan, jilid, hafalan, lamaJuz }): TitikHalaqoh => {
        // Posisi akhir bulan itu sudah di tahap terakhir URUTAN_TAHSIN (Lulus Tahsin).
        const lulusTahsin = (s: Siswa) => (jilid.get(s.id) ?? -1) >= iLulus
        if (bulan < mulai) {
          const nol = { anak: 0, rataHari: null }
          return { bulan, adaData: false, tahsin: null, tahfidz: null, jilid: null, hafalan: null, nTahsin: 0, nJilid: 0, drillJilid: nol, drillJuz: nol, pertemuan: null, isian: isianBulan(anak, bulan, lulusTahsin) }
        }
        // Penyebut tahsin: anak yang masih tahsin di akhir bulan itu, ditambah
        // yang bulan itu masih menyetor halaman (lulus tahsin di tengah bulan).
        const masihTahsin = anak.filter(s => {
          const i = jilid.get(s.id)
          return (i !== null && i !== undefined && i < iLulus) || halTahsin.has(`${bulan}|${s.id}`)
        })
        const posisiJilid = anak.map(s => jilid.get(s.id)).filter((i): i is number => i !== null && i !== undefined)

        const drillT = new Set(drillTahsinBulan.get(bulan) ?? [])
        // Bulan berjalan: anak yang sedang drill (penanda di data siswa) ikut,
        // walau bulan ini belum sempat setor drill.
        if (bulan === bulanKini) for (const s of anak) if (s.tahsin_drill_sejak) drillT.add(s.id)
        const anakDrillT = anak.filter(s => drillT.has(s.id))
        const hariDrillT = bulan === bulanKini
          ? anakDrillT.filter(s => s.tahsin_drill_sejak).map(s => selisihHari(s.tahsin_drill_sejak!, hariIni))
          : []
        const hariDrillJ = anak.map(s => lamaJuz.get(s.id)).filter((n): n is number => n !== undefined)

        const r = rata(masihTahsin.map(s => halTahsin.get(`${bulan}|${s.id}`)?.size ?? 0))
        const f = rata(anak.map(s => halTahfidz.get(`${bulan}|${s.id}`) ?? 0))
        const j = rata(posisiJilid)
        const hf = rata(anak.map(s => hafalan.get(s.id) ?? 0))
        const rh = rata(hariDrillT)
        const rj = rata(hariDrillJ)
        return {
          bulan,
          adaData: true,
          tahsin: r === null ? null : satuDesimal(r),
          tahfidz: f === null ? null : satuDesimal(f),
          jilid: j === null ? null : satuDesimal(j),
          // Dua desimal: anak juz 30 bergerak per surat, sepersepuluh juz terlalu kasar.
          hafalan: hf === null ? null : Math.round(hf * 100) / 100,
          nTahsin: masihTahsin.length,
          nJilid: posisiJilid.length,
          drillJilid: { anak: anakDrillT.length, rataHari: rh === null ? null : Math.round(rh) },
          drillJuz: { anak: hariDrillJ.length, rataHari: rj === null ? null : Math.round(rj) },
          pertemuan: pertemuanBulan(kalender, anak, bulan),
          isian: isianBulan(anak, bulan, lulusTahsin),
        }
      })
      return {
        id: h.id,
        nama: h.name,
        jenjang: h.jenjang,
        program: h.program,
        sesi: h.sesi,
        guru: h.wali ? { id: h.wali.id, nama: h.wali.full_name, gender: tebakGender(h.wali.gender, h.wali.sapaan, h.name) } : null,
        siswa: anak.length,
        titik,
      }
    })

  return { ...kosong, kartu }
}

// ─── Pertemuan per bulan (Kalender Qur'an, 0084) ────────────────────────────

interface KalenderJendela {
  terms: { id: string; start_date: string; end_date: string }[]
  /** term_id → jadwal yang disimpan koor. */
  jadwal: Map<string, JadwalProgram[]>
  kosong: HariKosong[]
}

/** Term, jadwal, dan hari kosong sepanjang jendela. Tahan tabel yang belum ada. */
async function kalenderJendela(
  supabase: ReturnType<typeof createServerClient>, jenjang: Jenjang[], dari: string, sampai: string,
): Promise<KalenderJendela> {
  const { data: termRows } = await supabase.from('academic_terms')
    .select('id, start_date, end_date').lte('start_date', sampai).gte('end_date', dari)
  const terms = (termRows ?? []) as KalenderJendela['terms']
  const [jadwalRes, kosongRes] = await Promise.all([
    terms.length
      ? supabase.from('kalender_jadwal').select('term_id, jenjang, program, hari').in('term_id', terms.map(t => t.id))
      : Promise.resolve({ data: [], error: null }),
    getHariKosong(jenjang, dari, sampai),
  ])
  const jadwal = new Map<string, JadwalProgram[]>()
  if (!jadwalRes.error) {
    for (const j of (jadwalRes.data ?? []) as { term_id: string; jenjang: Jenjang; program: string | null; hari: number[] | null }[]) {
      jadwal.set(j.term_id, [...(jadwal.get(j.term_id) ?? []), { jenjang: j.jenjang, program: j.program ?? '', hari: j.hari ?? [] }])
    }
  }
  return { terms, jadwal, kosong: kosongRes.kosong }
}

/**
 * TM satu halaqoh di satu bulan. Seorang anak memakai Kalender Qur'an bila
 * koor sudah menyimpan jadwal programnya di term itu atau menandai hari kosong
 * angkatannya di bulan itu; selain itu PERTEMUAN_BAWAAN.
 */
function pertemuanBulan(k: KalenderJendela, anak: Siswa[], bulan: string): { tm: number; dariKalender: boolean } | null {
  if (anak.length === 0) return null
  const dari = `${bulan}-01`
  const sampai = akhirBulan(bulan)
  const term = k.terms.find(t => t.start_date <= sampai && t.end_date >= dari)
  const jadwal = term ? k.jadwal.get(term.id) ?? [] : []
  const hitung = new Map<string, { tm: number; dariKalender: boolean; n: number }>()
  for (const s of anak) {
    const sasaran = { jenjang: s.jenjang, tingkat: tingkatOf(s.kelas) ?? 0, kelas: s.kelas, program: s.program }
    const diatur = jadwal.some(j => j.jenjang === s.jenjang && j.program === (s.program ?? ''))
      || k.kosong.some(x => x.jenjang === s.jenjang && x.tingkat === sasaran.tingkat && x.tanggal >= dari && x.tanggal <= sampai)
    const tm = diatur ? hitungTM(dari, sampai, jadwal, k.kosong, sasaran) : PERTEMUAN_BAWAAN
    const kunci = `${tm}|${diatur}`
    const e = hitung.get(kunci) ?? { tm, dariKalender: diatur, n: 0 }
    e.n++
    hitung.set(kunci, e)
  }
  const terbanyak = [...hitung.values()].sort((a, b) => b.n - a.n || b.tm - a.tm)[0]
  return { tm: terbanyak.tm, dariKalender: terbanyak.dariKalender }
}

/** Indeks rata-rata tahap → label terdekat, mis. 3,4 → 'Jilid 3'. */
export function labelTahap(indeks: number): string {
  return URUTAN_TAHSIN[Math.min(URUTAN_TAHSIN.length - 1, Math.max(0, Math.floor(indeks)))]
}
