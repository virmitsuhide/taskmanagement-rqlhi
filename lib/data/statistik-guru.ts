import { createServerClient } from '@/lib/supabase/server'
import { getHalaqohSesiGuru } from '@/lib/data/setoran-sesi'
import { getPetaHalaman, getTargetTahfidz } from '@/lib/data/target-tahfidz'
import { levelDariTahap, levelOrder } from '@/lib/rq/level'
import { tahunAjaranDari } from '@/lib/rq/target-tahfidz'
import { tanggalWIB } from '@/lib/rq/ujian'
import type { Jenjang } from '@/types'

/**
 * Statistik mengajar guru, menurut periode pilihan: tahun ajaran, semester,
 * 3 bulan, bulan, pekan.
 *
 * Cakupannya ANAK di halaqoh aktif yang diampu guru — bukan setoran yang
 * kebetulan diketik guru itu. Anak yang disetorkan guru pengganti tetap
 * terhitung di halaqoh pengampunya, karena yang ditanyakan halaman ini
 * "bagaimana anak-anak saya", bukan "berapa banyak yang saya ketik".
 *
 * Dua bagian memakai waktu berbeda, dan layar mengatakannya:
 *  • Ringkasan, aktivitas, dan "tercepat" → selama periode terpilih.
 *  • "Tertinggi" → capaian akhir / total hafalan saat ini.
 *  • Perhatian → posisi HARI INI terhadap target. Target itu titik, bukan
 *    rentang: "di bawah target minggu ini" dan "di bawah target TA ini"
 *    adalah pertanyaan yang sama tentang di mana anak berada sekarang.
 */

export type KodePeriode = 'ta' | 'semester' | 'tigabulan' | 'bulan' | 'minggu'

export const LABEL_PERIODE: Record<KodePeriode, string> = {
  ta: 'Tahun ini', semester: 'Semester ini', tigabulan: '3 bulan terakhir', bulan: 'Bulan ini', minggu: 'Minggu ini',
}

export interface RentangPeriode {
  kode: KodePeriode
  awal: string
  /** Hari ini (WIB) — periode berjalan tidak pernah melewati hari ini. */
  akhir: string
  keterangan: string
}

export interface TitikAktivitas {
  label: string
  /** Rentang yang diwakili, untuk tooltip. */
  judul: string
  tahsin: number
  tahfidz: number
}

export interface PeringkatSiswa {
  id: string
  nama: string
  kelas: string | null
  /** Dasar urutan dan panjang batang. */
  nilai: number
  /** Yang ditulis di kanan nama, mis. "12", "4,5", "Lulus Tahsin". */
  nilaiTeks: string
  /** Satuan di belakang nilaiTeks; kosong bila nilaiTeks sudah berupa kata. */
  satuan: string
  keterangan: string | null
}

export interface PerhatianTahsin {
  id: string
  nama: string
  kelas: string | null
  posisi: string
  target: string
  /** Berapa anak tangga di bawah target. */
  kurang: number
}

export interface PerhatianTahfidz {
  id: string
  nama: string
  kelas: string | null
  capaian: string | null
  target: string | null
  selisihPekan: number | null
}

export interface StatistikGuru {
  periode: RentangPeriode
  jumlahSiswa: number
  ringkas: {
    setoranTahsin: number
    setoranTahfidz: number
    /** Anak berbeda yang setor setidaknya sekali di periode ini. */
    siswaSetor: number
    naikJilid: number
    naikJuz: number
  }
  aktivitas: TitikAktivitas[]
  /** Capaian akhir tahsin tertinggi — posisi sekarang, tidak mengikuti periode. */
  tahsinTertinggi: PeringkatSiswa[]
  /** Total hafalan terbanyak (halaman mushaf) — tidak mengikuti periode. */
  tahfidzTertinggi: PeringkatSiswa[]
  /** Halaman tahsin lulus terbanyak selama periode. */
  tahsinTercepat: PeringkatSiswa[]
  /** Halaman hafalan baru (ziyadah) terbanyak selama periode. */
  tahfidzTercepat: PeringkatSiswa[]
  perhatianTahsin: PerhatianTahsin[]
  /** Anak yang target tahsinnya tidak bisa dinilai (posisi/target kosong). */
  tahsinTakTerukur: number
  perhatianTahfidz: PerhatianTahfidz[]
  tahfidzTakTerukur: number
}

// ─── Periode ─────────────────────────────────────────────────────────────────

function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function hariDalamPekan(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Ahad', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function tglPendek(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]}`
}

export async function rentangPeriode(kode: KodePeriode, hariIni = tanggalWIB(new Date())): Promise<RentangPeriode> {
  if (kode === 'minggu') {
    const awal = tambahHari(hariIni, -((hariDalamPekan(hariIni) + 6) % 7))
    return { kode, awal, akhir: hariIni, keterangan: `${tglPendek(awal)} – ${tglPendek(hariIni)}` }
  }
  if (kode === 'bulan') {
    const awal = `${hariIni.slice(0, 7)}-01`
    return { kode, awal, akhir: hariIni, keterangan: `${tglPendek(awal)} – ${tglPendek(hariIni)}` }
  }
  if (kode === 'tigabulan') {
    // Bulan berjalan + dua bulan sebelumnya, dari tanggal 1 — bukan mundur
    // tepat 90 hari, supaya pekan pertamanya tidak terpotong di hari acak.
    const [y, m] = hariIni.split('-').map(Number)
    const awal = m > 2 ? `${y}-${String(m - 2).padStart(2, '0')}-01` : `${y - 1}-${String(m + 10).padStart(2, '0')}-01`
    return { kode, awal, akhir: hariIni, keterangan: `${tglPendek(awal)} – ${tglPendek(hariIni)}` }
  }

  const supabase = createServerClient()
  const { data: terms } = await supabase
    .from('academic_terms')
    .select('year_label, semester, start_date, end_date, is_current')
    .order('start_date')
  const daftar = (terms ?? []) as { year_label: string; semester: string; start_date: string; end_date: string; is_current: boolean }[]
  const kini = daftar.find(t => t.is_current)
    ?? daftar.find(t => t.start_date <= hariIni && hariIni <= t.end_date)

  if (kode === 'semester') {
    // Tanpa semester tercatat: pakai pembagian bawaan Juli–Desember / Januari–Juni.
    const awal = kini?.start_date
      ?? (Number(hariIni.slice(5, 7)) >= 7 ? `${hariIni.slice(0, 4)}-07-01` : `${hariIni.slice(0, 4)}-01-01`)
    const label = kini ? `Semester ${kini.semester} ${kini.year_label}` : 'Semester berjalan'
    return { kode, awal, akhir: hariIni, keterangan: `${label} · sejak ${tglPendek(awal)}` }
  }

  // Tahun ajaran: awal semester pertama tahun ajaran yang sama; tanpa data, 1 Juli.
  const ta = kini?.year_label ?? tahunAjaranDari(hariIni)
  const awalTercatat = daftar.filter(t => t.year_label === ta).map(t => t.start_date).sort()[0]
  const awal = awalTercatat ?? `${ta.slice(0, 4)}-07-01`
  return { kode, awal, akhir: hariIni, keterangan: `Tahun ajaran ${ta} · sejak ${tglPendek(awal)}` }
}

/**
 * Wadah grafik aktivitas. Pekan & bulan per hari sekolah; 3 bulan & semester
 * per pekan; tahun ajaran per bulan — supaya batangnya tetap belasan, bukan ratusan.
 */
export function wadahAktivitas(p: RentangPeriode): { mulai: string; selesai: string; label: string; judul: string }[] {
  const hasil: { mulai: string; selesai: string; label: string; judul: string }[] = []
  if (p.kode === 'minggu' || p.kode === 'bulan') {
    // Seluruh Senin–Jumat periode itu, termasuk yang belum tiba, supaya
    // bentuk grafiknya tetap sepekan/sebulan penuh.
    const ujung = p.kode === 'minggu'
      ? tambahHari(p.awal, 4)
      : tambahHari(`${p.awal.slice(0, 7)}-01`, new Date(Date.UTC(Number(p.awal.slice(0, 4)), Number(p.awal.slice(5, 7)), 0)).getUTCDate() - 1)
    for (let d = p.awal; d <= ujung; d = tambahHari(d, 1)) {
      const h = hariDalamPekan(d)
      if (h === 0 || h === 6) continue
      hasil.push({ mulai: d, selesai: d, label: p.kode === 'minggu' ? HARI[h] : String(Number(d.slice(8, 10))), judul: `${HARI[h]}, ${tglPendek(d)}` })
    }
    return hasil
  }
  if (p.kode === 'semester' || p.kode === 'tigabulan') {
    let ke = 1
    for (let d = p.awal; d <= p.akhir; d = tambahHari(d, 7), ke++) {
      const senin = tambahHari(d, -((hariDalamPekan(d) + 6) % 7))
      const mulai = senin < p.awal ? p.awal : senin
      const selesai = tambahHari(senin, 6)
      hasil.push({ mulai, selesai, label: `P${ke}`, judul: `Pekan ${ke}: ${tglPendek(mulai)} – ${tglPendek(selesai > p.akhir ? p.akhir : selesai)}` })
      d = senin
    }
    return hasil
  }
  for (let d = `${p.awal.slice(0, 7)}-01`; d <= p.akhir; ) {
    const [y, m] = d.split('-').map(Number)
    const berikut = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    hasil.push({ mulai: d, selesai: tambahHari(berikut, -1), label: BULAN[m - 1], judul: `${BULAN[m - 1]} ${y}` })
    d = berikut
  }
  return hasil
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function ambilSemua<T>(buat: (dari: number, ke: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const hasil: T[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data } = await buat(dari, dari + 999)
    const potong = (data ?? []) as T[]
    hasil.push(...potong)
    if (potong.length < 1000) return hasil
  }
}

interface Siswa {
  id: string
  full_name: string
  kelas: string | null
  jenjang: Jenjang
  current_jilid_page: number | null
  current_quran_halaman: number | null
  jilid: { label: string; total_pages: number | null; order_num: number } | null
}

function tingkatDari(kelas: string | null): number | null {
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

const TOP = 5

export async function getStatistikGuru(teacherId: string, kode: KodePeriode): Promise<StatistikGuru> {
  const periode = await rentangPeriode(kode)
  const kosong: StatistikGuru = {
    periode, jumlahSiswa: 0,
    ringkas: { setoranTahsin: 0, setoranTahfidz: 0, siswaSetor: 0, naikJilid: 0, naikJuz: 0 },
    aktivitas: wadahAktivitas(periode).map(w => ({ label: w.label, judul: w.judul, tahsin: 0, tahfidz: 0 })),
    tahsinTertinggi: [], tahfidzTertinggi: [], tahsinTercepat: [], tahfidzTercepat: [], perhatianTahsin: [], tahsinTakTerukur: 0,
    perhatianTahfidz: [], tahfidzTakTerukur: 0,
  }

  const halaqoh = await getHalaqohSesiGuru(teacherId)
  if (halaqoh.length === 0) return kosong

  const supabase = createServerClient()
  const { data: siswaRows } = await supabase
    .from('students')
    .select('id, full_name, kelas, jenjang, current_jilid_page, current_quran_halaman, jilid:jilid_levels!students_current_jilid_id_fkey(label, total_pages, order_num)')
    .in('halaqoh_id', halaqoh.map(h => h.id))
    .eq('is_active', true)
    .order('full_name')
  const siswa = (siswaRows ?? []) as unknown as Siswa[]
  if (siswa.length === 0) return kosong
  const ids = siswa.map(s => s.id)
  const perId = new Map(siswa.map(s => [s.id, s]))
  const jenjangGuru = [...new Set(siswa.map(s => s.jenjang))]

  const { data: term } = await supabase.from('academic_terms').select('id').eq('is_current', true).maybeSingle()

  const [tahsin, tahfidz, naikJilid, naikJuz, targetRows, targetTahfidz, peta] = await Promise.all([
    ambilSemua<{ student_id: string; setoran_date: string; status: string; drill: boolean | null }>((dari, ke) =>
      supabase.from('tahsin_logs').select('student_id, setoran_date, status, drill')
        .in('student_id', ids).gte('setoran_date', periode.awal).lte('setoran_date', periode.akhir).range(dari, ke)),
    ambilSemua<{ student_id: string; setoran_date: string; kind: string; surat_id: number; ayat_dari: number | null; ayat_ke: number | null }>((dari, ke) =>
      supabase.from('tahfidz_logs').select('student_id, setoran_date, kind, surat_id, ayat_dari, ayat_ke')
        .in('student_id', ids).gte('setoran_date', periode.awal).lte('setoran_date', periode.akhir).range(dari, ke)),
    supabase.from('jilid_promotions').select('*', { count: 'exact', head: true })
      .in('student_id', ids).gte('promotion_date', periode.awal).lte('promotion_date', periode.akhir),
    supabase.from('juz_promotions').select('*', { count: 'exact', head: true })
      .in('student_id', ids).gte('promotion_date', periode.awal).lte('promotion_date', periode.akhir),
    term
      ? supabase.from('kurikulum_targets').select('jenjang, tingkat, target_tahsin').eq('term_id', (term as { id: string }).id)
      : Promise.resolve({ data: [] }),
    getTargetTahfidz(jenjangGuru),
    getPetaHalaman(),
  ])

  // ── Ringkasan & aktivitas ──
  const pernahSetor = new Set<string>([...tahsin.map(l => l.student_id), ...tahfidz.map(l => l.student_id)])
  const aktivitas = wadahAktivitas(periode).map(w => ({
    label: w.label,
    judul: w.judul,
    tahsin: tahsin.filter(l => l.setoran_date >= w.mulai && l.setoran_date <= w.selesai).length,
    tahfidz: tahfidz.filter(l => l.setoran_date >= w.mulai && l.setoran_date <= w.selesai).length,
  }))

  // Halaman hanya untuk tahap berbuku: tahap tanpa halaman (Al-Qur'an, Talaqqi,
  // Lulus Tahsin) kerap masih menyimpan nomor halaman sisa tahap sebelumnya.
  const halamanBuku = (s: Siswa) => (s.jilid?.total_pages && s.current_jilid_page ? s.current_jilid_page : null)
  const posisiTahsin = (s: Siswa) =>
    s.jilid ? `${s.jilid.label}${halamanBuku(s) ? ` halaman ${halamanBuku(s)}` : ''}` : null
  const targetPerId = new Map(targetTahfidz.siswa.map(t => [t.id, t]))
  const angka1 = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  const teratas = (daftar: PeringkatSiswa[]) =>
    daftar.sort((x, y) => y.nilai - x.nilai || x.nama.localeCompare(y.nama)).slice(0, TOP)
  const dasar = (s: Siswa) => ({ id: s.id, nama: s.full_name, kelas: s.kelas })

  // ── Tertinggi: capaian akhir, bukan periode ──
  // Tahsin diurutkan menurut tangga level (Jilid 1 … Tajwid, Lulus Tahsin =
  // Tahfidz), lalu urutan tahap di dalam metodenya (Al-Qur'an T1 < T3 <
  // Talaqqi), lalu halaman buku. Bobotnya bersusun supaya satu anak tangga
  // lebih tinggi selalu menang atas halaman berapa pun di anak tangga bawahnya.
  const tahsinTertinggi = teratas(siswa.flatMap(s => {
    const lv = levelOrder(levelDariTahap(s.jilid?.label))
    if (!lv || !s.jilid) return []
    return [{
      ...dasar(s),
      nilai: lv * 1e6 + s.jilid.order_num * 1e3 + (halamanBuku(s) ?? 0),
      nilaiTeks: posisiTahsin(s)!,
      satuan: '',
      keterangan: s.current_quran_halaman ? `mushaf halaman ${s.current_quran_halaman}` : null,
    }]
  }))
  // Tahfidz: total hafalan dalam halaman mushaf sepanjang urutan rencana
  // programnya — angka yang sama dengan modul Target Tahfidz.
  const tahfidzTertinggi = teratas(siswa.flatMap(s => {
    const t = targetPerId.get(s.id)
    if (!t?.capaianHalaman) return []
    return [{
      ...dasar(s),
      nilai: t.capaianHalaman,
      nilaiTeks: angka1(t.capaianHalaman),
      satuan: 'halaman',
      keterangan: t.capaianTeks
        ? `sampai ${t.capaianTeks}${t.sumberCapaian === 'juz' ? ' (dari juz yang diujikan)' : ''}`
        : null,
    }]
  }))

  // ── Tercepat: selama periode ──
  // Tahsin: setoran LULUS di luar drill — tiap satu memajukan satu halaman
  // (aturan posisi di actions/setoran.ts). Setoran ulang dan latihan drill
  // tidak menambah capaian.
  const tahsinPer = new Map<string, { lulus: number; setoran: number }>()
  for (const l of tahsin) {
    const e = tahsinPer.get(l.student_id) ?? { lulus: 0, setoran: 0 }
    e.setoran++
    if (l.status === 'lulus' && !l.drill) e.lulus++
    tahsinPer.set(l.student_id, e)
  }
  const tahsinTercepat = teratas([...tahsinPer.entries()].filter(([, v]) => v.lulus > 0).map(([id, v]) => {
    const s = perId.get(id)!
    return {
      ...dasar(s), nilai: v.lulus, nilaiTeks: v.lulus.toLocaleString('id-ID'), satuan: 'halaman lulus',
      keterangan: `${v.setoran} setoran${posisiTahsin(s) ? ` · kini ${posisiTahsin(s)}` : ''}`,
    }
  }))
  // Tahfidz: halaman mushaf dari ayat ZIYADAH — hafalan baru; muroja'ah
  // mengulang, bukan menambah. Halaman boleh pecahan: lima ayat Al-Baqarah
  // bukan sehalaman penuh, dan membulatkannya membuat anak yang menyetor
  // sedikit-sedikit tampak sama cepat dengan yang menyetor sehalaman.
  const tahfidzPer = new Map<string, { halaman: number; ayat: number; setoran: number }>()
  for (const l of tahfidz) {
    if (!(l.kind === 'ziyadah' || l.kind === 'hafalan_baru') || l.ayat_dari === null || l.ayat_ke === null) continue
    const e = tahfidzPer.get(l.student_id) ?? { halaman: 0, ayat: 0, setoran: 0 }
    e.setoran++
    e.ayat += l.ayat_ke - l.ayat_dari + 1
    e.halaman += peta.bobot(l.surat_id, l.ayat_dari, l.ayat_ke)
    tahfidzPer.set(l.student_id, e)
  }
  const tahfidzTercepat = teratas([...tahfidzPer.entries()].filter(([, v]) => v.halaman > 0).map(([id, v]) => {
    const s = perId.get(id)!
    return {
      ...dasar(s), nilai: v.halaman, nilaiTeks: angka1(v.halaman), satuan: 'halaman',
      keterangan: `${v.ayat.toLocaleString('id-ID')} ayat · ${v.setoran} setoran ziyadah`,
    }
  }))

  // ── Perhatian tahsin: posisi hari ini di bawah target semester kelasnya ──
  const target = new Map(
    ((targetRows.data ?? []) as { jenjang: string; tingkat: number; target_tahsin: string }[])
      .map(t => [`${t.jenjang}|${t.tingkat}`, t.target_tahsin]),
  )
  const perhatianTahsin: PerhatianTahsin[] = []
  let tahsinTakTerukur = 0
  for (const s of siswa) {
    const tingkat = tingkatDari(s.kelas)
    const t = tingkat ? target.get(`${s.jenjang}|${tingkat}`) : undefined
    const level = levelDariTahap(s.jilid?.label)
    const a = levelOrder(level)
    const b = levelOrder(t ?? null)
    if (!a || !b) { tahsinTakTerukur++; continue }
    if (a < b) {
      perhatianTahsin.push({
        id: s.id, nama: s.full_name, kelas: s.kelas,
        posisi: posisiTahsin(s) ?? level ?? '—', target: t!, kurang: b - a,
      })
    }
  }
  perhatianTahsin.sort((x, y) => y.kurang - x.kurang || x.nama.localeCompare(y.nama))

  // ── Perhatian tahfidz: status "di bawah" dari modul Target Tahfidz ──
  const perhatianTahfidz: PerhatianTahfidz[] = []
  let tahfidzTakTerukur = 0
  for (const s of siswa) {
    const t = targetPerId.get(s.id)
    if (!t || t.status === 'belum_terukur' || t.status === 'tanpa_target') { tahfidzTakTerukur++; continue }
    if (t.status === 'di_bawah') {
      perhatianTahfidz.push({
        id: s.id, nama: s.full_name, kelas: s.kelas,
        capaian: t.capaianTeks, target: t.targetTeks, selisihPekan: t.selisihPekan,
      })
    }
  }
  perhatianTahfidz.sort((x, y) => (x.selisihPekan ?? 0) - (y.selisihPekan ?? 0))

  return {
    periode,
    jumlahSiswa: siswa.length,
    ringkas: {
      setoranTahsin: tahsin.length,
      setoranTahfidz: tahfidz.length,
      siswaSetor: pernahSetor.size,
      naikJilid: naikJilid.count ?? 0,
      naikJuz: naikJuz.count ?? 0,
    },
    aktivitas,
    tahsinTertinggi,
    tahfidzTertinggi,
    tahsinTercepat,
    tahfidzTercepat,
    perhatianTahsin,
    tahsinTakTerukur,
    perhatianTahfidz,
    tahfidzTakTerukur,
  }
}
