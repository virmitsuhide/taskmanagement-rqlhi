import { createServerClient } from '@/lib/supabase/server'
import { shiftPeriod } from '@/lib/finance/period'
import { tanggalWIB } from '@/lib/rq/ujian'
import { halamanRentang } from '@/lib/rq/murojaah'
import { jalurSetoran } from '@/lib/rq/jalur'
import { programLabel, UNIT_LABELS } from '@/lib/rq/programs'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import { getPetaHalaman, getTargetTahfidz } from '@/lib/data/target-tahfidz'
import { getJuzDrillPerSiswa } from '@/lib/data/drill-tahfidz'
import { ambilPerPotong } from '@/lib/data/capaian-kelas'
import type { Jenjang } from '@/types'

/**
 * "Halaqoh saya" — ringkasan satu halaqoh untuk gurunya sendiri (portal guru).
 *
 * Definisi angka mengikuti Analitik Halaqoh (lib/data/analitik-halaqoh.ts):
 *   tahsin  = halaman lulus unik (bukan drill) per anak yang masih tahsin,
 *             hanya setoran jalur SEKOLAH (ekstra/TR/Riyadhoh/asrama tidak ikut)
 *   tahfidz = halaman mushaf ziyadah per anak, jalur sekolah
 * Keanggotaan = keanggotaan hari ini (students.halaqoh_id).
 *
 * Pembanding garis oranye: rata-rata halaqoh aktif dengan unit & program yang
 * sama (termasuk halaqoh ini), dihitung dengan aturan yang sama.
 *
 * Satu penyederhanaan dibanding Analitik Halaqoh: penyebut tahsin bulan lalu
 * memakai jilid HARI INI (belum Lulus Tahsin), ditambah anak yang menyetor
 * tahsin pada/sesudah bulan itu — bukan posisi jilid yang disusun ulang per
 * akhir bulan. Anak yang kini Lulus Tahsin tetapi sebulan penuh tidak setor
 * dan sesudahnya tidak pernah setor lagi tidak ikut dihitung.
 *
 * Kartu tile memakai rentang sebanding: 1..hari ini bulan berjalan vs tanggal
 * yang sama bulan lalu — bukan bulan lalu penuh.
 */

export const JENDELA_BULAN_GURU = 6

const ZIYADAH = ['ziyadah', 'hafalan_baru']
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export interface HalaqohPilihan {
  id: string
  nama: string
  jenjang: Jenjang
  program: string | null
}

export type NadaLencana = 'warm' | 'destructive' | 'success'

export interface SiswaPerluDibantu {
  id: string
  nama: string
  detail: string
  lencana: string
  nada: NadaLencana
  /** Lencana lain (lebih rendah prioritasnya) — ditampilkan kecil. */
  lain: string[]
}

export interface TitikLaju {
  bulan: string
  label: string
  /** null = belum ada data (sebelum aplikasi dipakai) atau tidak berlaku. */
  nilai: number | null
  rataRata: number | null
}

export interface HalaqohGuru {
  halaqoh: HalaqohPilihan[]
  terpilih: HalaqohPilihan | null
  hariIni: string
  /** "Oktober" */
  namaBulan: string
  /** "1–14 Sep" — rentang pembanding tile. */
  pembanding: string
  jumlahSiswa: number
  hadir: { persen: number | null; pertemuan: number }
  tahsin: { nilai: number | null; delta: number | null }
  tahfidz: { nilai: number | null; delta: number | null }
  /** Target tahfidz: sesuai = sesuai + di atas; terukur = di_bawah + sesuai + di_atas. */
  target: { sesuai: number; terukur: number; diBawah: number }
  laju: TitikLaju[]
  /** "QULS SDIT LHI" */
  labelPembanding: string
  jumlahHalaqohPembanding: number
  ringkasan: { awal: string; tegas: string }
  perluDibantu: SiswaPerluDibantu[]
}

interface BarisHalaqoh { id: string; name: string; jenjang: Jenjang; sesi: number | null; program: string | null }
interface BarisSiswa {
  id: string
  full_name: string
  halaqoh_id: string
  current_jilid_id: string | null
  current_jilid_page: number | null
  current_quran_halaman: number | null
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
interface LogTahfidz {
  student_id: string
  setoran_date: string
  kind: string
  surat_id: number
  surat_ke_id?: number | null
  ayat_dari: number | null
  ayat_ke: number | null
  ekstra_slot_id?: string | null
  tahsin_rekomendasi?: boolean | null
  riyadhoh?: boolean | null
  asrama?: boolean | null
}

const satuDesimal = (n: number) => Math.round(n * 10) / 10
const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const selisihHari = (dari: string, ke: string) =>
  Math.max(0, Math.round((new Date(ke).getTime() - new Date(dari).getTime()) / 86_400_000))

function akhirBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  return `${bulan}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Tanggal yang sama bulan lalu, dipotong ke akhir bulan itu. */
function tanggalSamaBulanLalu(iso: string): string {
  const lalu = shiftPeriod(iso.slice(0, 7), -1)
  const akhir = akhirBulan(lalu)
  const kandidat = `${lalu}-${iso.slice(8, 10)}`
  return kandidat > akhir ? akhir : kandidat
}

const ANGKA = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima']
const angkaKata = (n: number) => ANGKA[n] ?? String(n)

function kosong(halaqoh: HalaqohPilihan[], terpilih: HalaqohPilihan | null, hariIni: string): HalaqohGuru {
  const bulan = hariIni.slice(0, 7)
  return {
    halaqoh, terpilih, hariIni,
    namaBulan: NAMA_BULAN[Number(bulan.slice(5, 7)) - 1],
    pembanding: '',
    jumlahSiswa: 0,
    hadir: { persen: null, pertemuan: 0 },
    tahsin: { nilai: null, delta: null },
    tahfidz: { nilai: null, delta: null },
    target: { sesuai: 0, terukur: 0, diBawah: 0 },
    laju: [],
    labelPembanding: '',
    jumlahHalaqohPembanding: 0,
    ringkasan: { awal: 'Belum ada data setoran', tegas: 'untuk halaqoh ini.' },
    perluDibantu: [],
  }
}

/**
 * Data "Halaqoh saya" untuk satu guru. `halaqohId` yang bukan milik guru
 * diabaikan (jatuh ke halaqoh pertamanya) — guru hanya melihat halaqohnya sendiri.
 */
export async function getHalaqohGuru(teacherId: string, halaqohId?: string | null): Promise<HalaqohGuru> {
  const hariIni = tanggalWIB(new Date())
  const bulanKini = hariIni.slice(0, 7)
  const supabase = createServerClient()

  const ids = await getTeacherHalaqohIds(teacherId)
  const [halaqohRes, guruRes] = await Promise.all([
    ids.length
      ? supabase.from('halaqoh').select('id, name, jenjang, sesi, program').in('id', ids).eq('is_active', true).order('sesi')
      : Promise.resolve({ data: [] as BarisHalaqoh[] }),
    supabase.from('teachers').select('gender, sapaan').eq('id', teacherId).maybeSingle(),
  ])
  const daftar: HalaqohPilihan[] = ((halaqohRes.data ?? []) as BarisHalaqoh[])
    .map(h => ({ id: h.id, nama: h.name, jenjang: h.jenjang, program: h.program }))
  const terpilih = daftar.find(h => h.id === halaqohId) ?? daftar[0] ?? null
  if (!terpilih) return kosong(daftar, null, hariIni)

  const guru = guruRes.data as { gender: string | null; sapaan: string | null } | null
  const sapaan = guru?.gender === 'P' || guru?.sapaan === 'usth' ? 'Ustadzah'
    : guru?.gender === 'L' || guru?.sapaan === 'ust' ? 'Ustadz' : null

  // ── Halaqoh pembanding: unit & program sama, aktif ──
  let qPembanding = supabase.from('halaqoh').select('id').eq('is_active', true).eq('jenjang', terpilih.jenjang)
  qPembanding = terpilih.program ? qPembanding.eq('program', terpilih.program) : qPembanding.is('program', null)
  const { data: pembandingRows } = await qPembanding
  const idPembanding = [...new Set([terpilih.id, ...((pembandingRows ?? []) as { id: string }[]).map(r => r.id)])]

  const [siswaRows, levelRes] = await Promise.all([
    ambilPerPotong<BarisSiswa>(idPembanding, p => supabase.from('students')
      .select('id, full_name, halaqoh_id, current_jilid_id, current_jilid_page, current_quran_halaman, tahsin_drill_sejak')
      .eq('is_active', true).in('halaqoh_id', p).order('id')),
    supabase.from('jilid_levels').select('id, label, is_quran, is_terminal'),
  ])
  const level = new Map(((levelRes.data ?? []) as { id: string; label: string; is_quran: boolean; is_terminal: boolean }[])
    .map(l => [l.id, l]))
  const semuaSiswa = siswaRows
  const anak = semuaSiswa.filter(s => s.halaqoh_id === terpilih.id).sort((a, b) => a.full_name.localeCompare(b.full_name))
  if (anak.length === 0) return kosong(daftar, terpilih, hariIni)

  const daftarBulan = Array.from({ length: JENDELA_BULAN_GURU }, (_, i) => shiftPeriod(bulanKini, i - (JENDELA_BULAN_GURU - 1)))
  // Tile membandingkan dengan bulan lalu; jendela 6 bulan sudah mencakupnya.
  const awalJendela = `${daftarBulan[0]}-01`
  const semuaId = semuaSiswa.map(s => s.id)
  const idAnak = anak.map(s => s.id)
  const awalBulan = `${bulanKini}-01`

  const [logTahsin, logZiyadah, logTahfidzAnak, absensiRes, peta, targetData, drillJuz] = await Promise.all([
    // '*' supaya penanda jalur (ekstra/TR/riyadhoh/asrama) ikut bila kolomnya ada.
    ambilPerPotong<LogTahsin>(semuaId, p => supabase.from('tahsin_logs').select('*')
      .in('student_id', p).gte('setoran_date', awalJendela).lte('setoran_date', hariIni).order('id')),
    // Seluruh ziyadah sampai hari ini — juga penanda "sudah ada data" sebelum jendela.
    ambilPerPotong<LogTahfidz>(semuaId, p => supabase.from('tahfidz_logs').select('*')
      .in('student_id', p).in('kind', ZIYADAH).lte('setoran_date', hariIni).order('id')),
    // Semua jenis setoran tahfidz anak halaqoh ini — bahan "terakhir setor".
    ambilPerPotong<LogTahfidz>(idAnak, p => supabase.from('tahfidz_logs').select('*')
      .in('student_id', p).gte('setoran_date', awalJendela).lte('setoran_date', hariIni).order('id')),
    supabase.from('absensi_harian').select('student_id, status')
      .eq('halaqoh_id', terpilih.id).gte('tanggal', awalBulan).lte('tanggal', hariIni),
    getPetaHalaman().catch(() => null),
    getTargetTahfidz([terpilih.jenjang]).catch(() => null),
    getJuzDrillPerSiswa(idAnak),
  ])

  // ── Halaman tahsin lulus unik per (siswa) dalam rentang ──
  const tahsinSekolah = logTahsin.filter(l => l.status === 'lulus' && !l.drill && jalurSetoran(l) === 'sekolah')
  const kunciHal = (l: LogTahsin) =>
    l.halaman !== null ? `${l.jilid_id}|${l.halaman}` : l.quran_halaman !== null ? `Q|${l.quran_halaman}` : null
  const halTahsinRentang = (dari: string, ke: string) => {
    const per = new Map<string, Set<string>>()
    for (const l of tahsinSekolah) {
      if (l.setoran_date < dari || l.setoran_date > ke) continue
      const k = kunciHal(l)
      if (!k) continue
      per.set(l.student_id, (per.get(l.student_id) ?? new Set<string>()).add(k))
    }
    return per
  }
  // Setoran tahsin terakhir (semua jalur, dalam jendela) — penanda anak masih tahsin.
  const tahsinTerakhir = new Map<string, string>()
  for (const l of logTahsin) {
    if ((tahsinTerakhir.get(l.student_id) ?? '') < l.setoran_date) tahsinTerakhir.set(l.student_id, l.setoran_date)
  }
  const masihTahsinKini = (s: BarisSiswa) => {
    const l = s.current_jilid_id ? level.get(s.current_jilid_id) : undefined
    return Boolean(l && !l.is_terminal)
  }
  const tahsinPerAnak = (kelompok: BarisSiswa[], dari: string, ke: string): number | null => {
    const hal = halTahsinRentang(dari, ke)
    const penyebut = kelompok.filter(s => masihTahsinKini(s) || hal.has(s.id) || (tahsinTerakhir.get(s.id) ?? '') >= dari)
    const r = rata(penyebut.map(s => hal.get(s.id)?.size ?? 0))
    return r === null ? null : satuDesimal(r)
  }

  const zSekolah = logZiyadah.filter(l => jalurSetoran(l) === 'sekolah')
  const tahfidzPerAnak = (kelompok: BarisSiswa[], dari: string, ke: string): number | null => {
    if (!peta || kelompok.length === 0) return null
    const ada = new Set(kelompok.map(s => s.id))
    let total = 0
    for (const l of zSekolah) {
      if (!ada.has(l.student_id) || l.setoran_date < dari || l.setoran_date > ke) continue
      total += halamanRentang(peta, { surat_id: l.surat_id, ayat_dari: l.ayat_dari, surat_ke_id: l.surat_ke_id ?? null, ayat_ke: l.ayat_ke })
    }
    return satuDesimal(total / kelompok.length)
  }

  // Bulan pertama ada setoran (semua jalur) — sebelum itu "belum ada data".
  const bulanPertama = new Map<string, string>()
  for (const l of [...logTahsin, ...logZiyadah]) {
    const b = l.setoran_date < awalJendela ? '0000-00' : l.setoran_date.slice(0, 7)
    if ((bulanPertama.get(l.student_id) ?? '9999-99') > b) bulanPertama.set(l.student_id, b)
  }
  const anggota = new Map<string, BarisSiswa[]>()
  for (const s of semuaSiswa) anggota.set(s.halaqoh_id, [...(anggota.get(s.halaqoh_id) ?? []), s])
  const mulaiHalaqoh = (kelompok: BarisSiswa[]) => kelompok.map(s => bulanPertama.get(s.id) ?? '9999-99').sort()[0]

  const nilaiBulan = (kelompok: BarisSiswa[], bulan: string): number | null => {
    if (bulan < mulaiHalaqoh(kelompok)) return null
    return tahsinPerAnak(kelompok, `${bulan}-01`, bulan === bulanKini ? hariIni : akhirBulan(bulan))
  }
  const laju: TitikLaju[] = daftarBulan.map(bulan => {
    const nilaiPembanding = [...anggota.values()].map(k => nilaiBulan(k, bulan)).filter((n): n is number => n !== null)
    const rr = rata(nilaiPembanding)
    return {
      bulan,
      label: BULAN_PENDEK[Number(bulan.slice(5, 7)) - 1],
      nilai: nilaiBulan(anak, bulan),
      rataRata: rr === null ? null : satuDesimal(rr),
    }
  })

  // ── Tile: bulan ini s.d. hari ini vs rentang yang sama bulan lalu ──
  const laluAkhir = tanggalSamaBulanLalu(hariIni)
  const laluAwal = `${laluAkhir.slice(0, 7)}-01`
  const tahsinKini = tahsinPerAnak(anak, awalBulan, hariIni)
  const tahsinLalu = tahsinPerAnak(anak, laluAwal, laluAkhir)
  const tahfidzKini = tahfidzPerAnak(anak, awalBulan, hariIni)
  const tahfidzLalu = tahfidzPerAnak(anak, laluAwal, laluAkhir)
  const beda = (a: number | null, b: number | null) => (a === null || b === null ? null : satuDesimal(a - b))

  // ── Kehadiran bulan ini ──
  const absensi = absensiRes.error ? [] : ((absensiRes.data ?? []) as { student_id: string; status: string }[])
  const hadirPer = new Map<string, { hadir: number; total: number }>()
  for (const a of absensi) {
    const r = hadirPer.get(a.student_id) ?? { hadir: 0, total: 0 }
    r.total++
    if (a.status === 'hadir') r.hadir++
    hadirPer.set(a.student_id, r)
  }
  const totalHadir = absensi.filter(a => a.status === 'hadir').length
  const persenHadir = absensi.length ? Math.round((totalHadir / absensi.length) * 100) : null

  // ── Target tahfidz ──
  const targetPer = new Map((targetData?.siswa ?? []).filter(t => idAnak.includes(t.id)).map(t => [t.id, t]))
  let sesuai = 0, diBawah = 0
  for (const t of targetPer.values()) {
    if (t.status === 'sesuai' || t.status === 'di_atas') sesuai++
    else if (t.status === 'di_bawah') diBawah++
  }

  // ── Perlu dibantu pekan ini ──
  const setorTerakhir = new Map<string, string>()
  for (const l of [...logTahsin, ...logTahfidzAnak]) {
    if (!idAnak.includes(l.student_id) || jalurSetoran(l) !== 'sekolah') continue
    if ((setorTerakhir.get(l.student_id) ?? '') < l.setoran_date) setorTerakhir.set(l.student_id, l.setoran_date)
  }
  const posisi = (s: BarisSiswa): string | null => {
    const l = s.current_jilid_id ? level.get(s.current_jilid_id) : undefined
    if (!l) return null
    if (l.is_terminal) return 'Lulus tahsin'
    if (l.is_quran) return s.current_quran_halaman ? `Al-Qur’an hal. ${s.current_quran_halaman}` : l.label
    return s.current_jilid_page ? `${l.label} hal. ${s.current_jilid_page}` : l.label
  }

  type Tanda = { teks: string; nada: NadaLencana; prioritas: number }
  const perluDibantu: (SiswaPerluDibantu & { prioritas: number })[] = []
  for (const s of anak) {
    const tanda: Tanda[] = []
    const fakta: string[] = []
    if (s.tahsin_drill_sejak) {
      const n = selisihHari(s.tahsin_drill_sejak, hariIni)
      if (n > 14) tanda.push({ teks: `Drill ${n} hari`, nada: 'warm', prioritas: 0 })
    }
    const juz = drillJuz.get(s.id) ?? []
    const lamaJuz = Math.max(0, ...juz.map(d => selisihHari(d.sejak, hariIni)))
    if (juz.length && lamaJuz > 14) tanda.push({ teks: `Drill juz ${lamaJuz} hari`, nada: 'warm', prioritas: 1 })
    const t = targetPer.get(s.id)
    if (t?.status === 'di_bawah') tanda.push({ teks: 'Di bawah target', nada: 'destructive', prioritas: 2 })
    const terakhir = setorTerakhir.get(s.id)
    const hariSetor = terakhir ? selisihHari(terakhir, hariIni) : null
    if (hariSetor === null || hariSetor > 5) {
      tanda.push({ teks: hariSetor === null ? 'Belum setor' : `${hariSetor} hari tak setor`, nada: 'warm', prioritas: 3 })
    }
    if (t?.perluDiujikan) tanda.push({ teks: 'Siap diuji', nada: 'success', prioritas: 4 })
    if (tanda.length === 0) continue

    const pos = posisi(s)
    if (pos) fakta.push(pos)
    if (hariSetor === null) fakta.push('belum setor 6 bulan terakhir')
    else if (hariSetor > 0) fakta.push(`terakhir setor ${hariSetor} hari lalu`)
    const h = hadirPer.get(s.id)
    if (h && h.total > 0 && h.hadir < h.total) fakta.push(`hadir ${Math.round((h.hadir / h.total) * 100)}%`)
    if (t?.perluDiujikan && t.capaianTeks) fakta.push(`hafalan ${t.capaianTeks}`)

    tanda.sort((a, b) => a.prioritas - b.prioritas)
    perluDibantu.push({
      id: s.id, nama: s.full_name, detail: fakta.join(' · '),
      lencana: tanda[0].teks, nada: tanda[0].nada, lain: tanda.slice(1).map(x => x.teks),
      prioritas: tanda[0].prioritas,
    })
  }
  perluDibantu.sort((a, b) => a.prioritas - b.prioritas || a.nama.localeCompare(b.nama))

  // ── Kalimat ringkasan, dari bulan yang sudah genap ──
  const genap = laju.filter(t => t.bulan < bulanKini)
  const subjek = `Laju tahsin halaqoh ${sapaan ?? 'ini'}`
  let ringkasan: HalaqohGuru['ringkasan'] = { awal: subjek, tegas: 'belum cukup data untuk dibaca.' }
  const nilaiGenap = genap.map(t => t.nilai)
  const runtun = (arah: 1 | -1) => {
    let k = 0
    for (let i = nilaiGenap.length - 1; i > 0; i--) {
      const a = nilaiGenap[i], b = nilaiGenap[i - 1]
      if (a === null || b === null || (a - b) * arah <= 0) break
      k++
    }
    return k
  }
  const naik = runtun(1)
  const turun = runtun(-1)
  const terakhirGenap = genap.at(-1)
  const labelPembanding = `${terpilih.program ? `${programLabel(terpilih.jenjang, terpilih.program)} ` : ''}${UNIT_LABELS[terpilih.jenjang]}`
  if (naik >= 2) ringkasan = { awal: subjek, tegas: `naik ${angkaKata(naik)} bulan berturut-turut.` }
  else if (turun >= 2) ringkasan = { awal: subjek, tegas: `turun ${angkaKata(turun)} bulan berturut-turut.` }
  else if (terakhirGenap && terakhirGenap.nilai !== null && terakhirGenap.rataRata !== null && terakhirGenap.rataRata > 0) {
    const rasio = terakhirGenap.nilai / terakhirGenap.rataRata
    const bln = NAMA_BULAN[Number(terakhirGenap.bulan.slice(5, 7)) - 1]
    ringkasan = rasio >= 1.1
      ? { awal: `${subjek} bulan ${bln}`, tegas: `di atas rata-rata halaqoh ${labelPembanding}.` }
      : rasio <= 0.9
        ? { awal: `${subjek} bulan ${bln}`, tegas: `masih di bawah rata-rata halaqoh ${labelPembanding}.` }
        : { awal: `${subjek} bulan ${bln}`, tegas: `sejalan dengan rata-rata halaqoh ${labelPembanding}.` }
  }

  const tglPendek = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN_PENDEK[Number(iso.slice(5, 7)) - 1]}`
  return {
    halaqoh: daftar,
    terpilih,
    hariIni,
    namaBulan: NAMA_BULAN[Number(bulanKini.slice(5, 7)) - 1],
    pembanding: laluAwal === laluAkhir ? tglPendek(laluAkhir) : `1–${tglPendek(laluAkhir)}`,
    jumlahSiswa: anak.length,
    hadir: { persen: persenHadir, pertemuan: absensi.length },
    tahsin: { nilai: tahsinKini, delta: beda(tahsinKini, tahsinLalu) },
    tahfidz: { nilai: tahfidzKini, delta: beda(tahfidzKini, tahfidzLalu) },
    target: { sesuai, terukur: sesuai + diBawah, diBawah },
    laju,
    labelPembanding,
    jumlahHalaqohPembanding: anggota.size,
    ringkasan,
    perluDibantu: perluDibantu.map(({ prioritas: _p, ...r }) => r),
  }
}
