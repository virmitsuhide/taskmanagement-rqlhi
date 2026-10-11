import { createServerClient } from '@/lib/supabase/server'
import { getKelompokTR, getPesertaTR, hariIniTR, type StatusHadirTR } from '@/lib/data/tahsin-rekomendasi'
import { jumatDalamRentang, tambahHari } from '@/lib/rq/tahsin-rekomendasi'

/**
 * Analitik Tahsin Rekomendasi — Koordinator SD, Kurikulum, Kepala RQ.
 * Hanya membaca: kelompok, peserta, tr_hadir, dan setoran bertanda TR.
 * Seluruh agregasi di sini; halaman menerima angka jadi.
 *
 * Status seorang anak pada satu Jum'at: izin/sakit/alfa dari presensi;
 * punya setoran TR = hadir & setor; hadir tanpa setoran = tidak setor;
 * tanpa presensi & tanpa setoran = belum dicatat.
 *
 * Jum'at "berjalan" = Jum'at yang punya catatan apa pun dari peserta mana
 * pun. Jum'at tanpa satu catatan pun dianggap libur, bukan "semua alfa" —
 * TR tidak punya tabel jadwal (lihat 0115).
 *
 * Peserta dihitung menurut daftar HARI INI; anak yang baru dimasukkan ikut
 * terhitung "belum dicatat" pada Jum'at sebelum ia masuk. Cukup untuk
 * membaca kecenderungan satu semester.
 */

export type RentangTR = 'semester' | 'bulan' | 'empat'

export interface JumatAnalitik {
  tanggal: string
  berjalan: boolean
  total: number
  hadir: number
  izin: number
  sakit: number
  alfa: number
  belum: number
  setor: number
  tidakSetor: number
}

export interface AnalitikTR {
  tabelAda: boolean
  dari: string
  sampai: string
  peserta: number
  kelompokJumlah: number
  jumat: JumatAnalitik[]
  ringkas: {
    jumatBerjalan: number
    hadirPersen: number | null
    /** Kehadiran tercatat (bukan "belum") — penyebut hadirPersen. */
    tercatat: number
    setoran: number
    persenLulus: number | null
    rataBintang: number | null
    nilaiSampel: number
    anakPernahSetor: number
  }
  kelompok: {
    id: string; username: string; nama: string; tempat: string; anak: number
    hadirPersen: number | null; setoran: number; persenLulus: number | null; rataBintang: number | null
    halamanLulus: number
    pencatatan: ('lengkap' | 'sebagian' | 'kosong')[]
  }[]
  siswa: {
    id: string; nama: string; kelas: string | null; kelompok: string; capaianAwal: string; posisi: string | null
    hadir: number; pertemuan: number; setoran: number; halamanLulus: number; terakhir: string | null
  }[]
  perhatian: { id: string; nama: string; kelas: string | null; kelompok: string; alasan: string; nada: 'bahaya' | 'waspada' | 'biasa' }[]
  kelas: { tingkat: string; anak: number; hadirPersen: number | null; setoranPerAnak: number | null }[]
}

export function rentangTR(r: RentangTR, hariIni = hariIniTR()): { dari: string; sampai: string } {
  const [y, m] = hariIni.split('-').map(Number)
  if (r === 'bulan') return { dari: `${hariIni.slice(0, 7)}-01`, sampai: hariIni }
  if (r === 'empat') return { dari: tambahHari(hariIni, -27), sampai: hariIni }
  // Semester: Juli–Desember atau Januari–Juni.
  return { dari: m >= 7 ? `${y}-07-01` : `${y}-01-01`, sampai: hariIni }
}

const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
/** Nilai 0–100 → bintang 0–5, sama dengan analitik Riyadhoh. */
const keBintang = (n: number[]) => (n.length ? Math.max(0, Math.min(5, ((rata(n) ?? 50) - 50) / 10)) : null)

export async function getAnalitikTR(opsi: { rentang: RentangTR; kelompok?: string | null }): Promise<AnalitikTR> {
  const hariIni = hariIniTR()
  const { dari, sampai } = rentangTR(opsi.rentang, hariIni)
  const [kelompokList, semua] = await Promise.all([getKelompokTR(), getPesertaTR()])
  const kosong: AnalitikTR = {
    tabelAda: kelompokList !== null, dari, sampai, peserta: 0, kelompokJumlah: kelompokList?.length ?? 0, jumat: [],
    ringkas: { jumatBerjalan: 0, hadirPersen: null, tercatat: 0, setoran: 0, persenLulus: null, rataBintang: null, nilaiSampel: 0, anakPernahSetor: 0 },
    kelompok: [], siswa: [], perhatian: [], kelas: [],
  }
  if (kelompokList === null) return kosong

  const kelompok = kelompokList.filter(k => !opsi.kelompok || k.teacher_id === opsi.kelompok)
  const peserta = semua.filter(s => !opsi.kelompok || s.teacher_id === opsi.kelompok)
  const ids = peserta.map(s => s.id)
  if (ids.length === 0) return { ...kosong, kelompokJumlah: kelompok.length }

  const supabase = createServerClient()
  const [hadirRes, tsRes] = await Promise.all([
    supabase.from('tr_hadir').select('student_id, tanggal, status').in('student_id', ids).gte('tanggal', dari).lte('tanggal', sampai),
    supabase.from('tahsin_logs').select('student_id, setoran_date, status, nilai_tahsin, drill, halaman')
      .in('student_id', ids).eq('tahsin_rekomendasi', true).gte('setoran_date', dari).lte('setoran_date', sampai),
  ])
  const hadirRows = (hadirRes.data ?? []) as { student_id: string; tanggal: string; status: StatusHadirTR }[]
  const ts = (tsRes.data ?? []) as { student_id: string; setoran_date: string; status: string | null; nilai_tahsin: number | null; drill: boolean | null; halaman: number | null }[]

  const kunci = (id: string, t: string) => `${id}|${t}`
  const presensi = new Map(hadirRows.map(r => [kunci(r.student_id, r.tanggal), r.status]))
  const setorPada = new Set(ts.map(r => kunci(r.student_id, r.setoran_date)))
  /** Halaman buku yang dinyatakan lulus lewat TR — bukan latihan drill. */
  const lulusHalaman = (r: (typeof ts)[number]) => r.status === 'lulus' && !r.drill && r.halaman !== null

  type Status = StatusHadirTR | 'belum'
  const statusAnak = (id: string, t: string): { status: Status; setor: boolean } => {
    const k = kunci(id, t)
    const p = presensi.get(k)
    const setor = setorPada.has(k)
    if (p && p !== 'hadir') return { status: p, setor: false }
    if (!p && !setor) return { status: 'belum', setor: false }
    return { status: 'hadir', setor }
  }

  const aktifTgl = new Set([...hadirRows.map(r => r.tanggal), ...ts.map(r => r.setoran_date)])
  const semuaJumat = jumatDalamRentang(dari, sampai)
  const berjalan = semuaJumat.filter(t => aktifTgl.has(t))

  const jumat: JumatAnalitik[] = semuaJumat.map(t => {
    const j: JumatAnalitik = { tanggal: t, berjalan: aktifTgl.has(t), total: peserta.length, hadir: 0, izin: 0, sakit: 0, alfa: 0, belum: 0, setor: 0, tidakSetor: 0 }
    if (!j.berjalan) return j
    for (const a of peserta) {
      const x = statusAnak(a.id, t)
      j[x.status]++
      if (x.status === 'hadir') { if (x.setor) j.setor++; else j.tidakSetor++ }
    }
    return j
  })

  const hadirSemua = jumat.reduce((n, j) => n + j.hadir, 0)
  const tercatat = jumat.reduce((n, j) => n + (j.berjalan ? j.total - j.belum : 0), 0)
  const nilai = ts.map(r => r.nilai_tahsin).filter((n): n is number => n !== null).map(Number)
  const ringkas = {
    jumatBerjalan: berjalan.length,
    hadirPersen: persen(hadirSemua, tercatat),
    tercatat,
    setoran: ts.length,
    persenLulus: persen(ts.filter(r => r.status === 'lulus').length, ts.length),
    rataBintang: keBintang(nilai),
    nilaiSampel: nilai.length,
    anakPernahSetor: new Set(ts.map(r => r.student_id)).size,
  }

  const labelKelompok = new Map(kelompokList.map(k => [k.teacher_id, `${k.username} · ${k.full_name}`]))

  // ── Per kelompok ──
  const perKelompok = kelompok.map(k => {
    const anak = peserta.filter(s => s.teacher_id === k.teacher_id)
    const idAnak = new Set(anak.map(a => a.id))
    const log = ts.filter(r => idAnak.has(r.student_id))
    let hadir = 0, catat = 0
    const pencatatan: ('lengkap' | 'sebagian' | 'kosong')[] = []
    for (const t of berjalan) {
      let belum = 0
      for (const a of anak) {
        const x = statusAnak(a.id, t)
        if (x.status === 'belum') { belum++; continue }
        catat++
        if (x.status === 'hadir') hadir++
      }
      pencatatan.push(anak.length === 0 || belum === anak.length ? 'kosong' : belum === 0 ? 'lengkap' : 'sebagian')
    }
    const n = log.map(r => r.nilai_tahsin).filter((x): x is number => x !== null).map(Number)
    return {
      id: k.teacher_id, username: k.username, nama: k.full_name, tempat: k.tempat, anak: anak.length,
      hadirPersen: persen(hadir, catat), setoran: log.length,
      persenLulus: persen(log.filter(r => r.status === 'lulus').length, log.length),
      rataBintang: keBintang(n), halamanLulus: log.filter(lulusHalaman).length,
      pencatatan: pencatatan.slice(-6),
    }
  })

  // ── Per siswa ──
  const siswa = peserta.map(a => {
    const log = ts.filter(r => r.student_id === a.id)
    const tgl = berjalan.map(t => statusAnak(a.id, t))
    return {
      id: a.id, nama: a.full_name, kelas: a.kelas, kelompok: labelKelompok.get(a.teacher_id) ?? '—',
      capaianAwal: a.capaian_awal, posisi: a.lulus_tahsin ? 'Lulus Tahsin' : a.posisi ? `${a.posisi}${a.drill ? ' · drill' : ''}` : null,
      hadir: tgl.filter(x => x.status === 'hadir').length,
      pertemuan: tgl.filter(x => x.status !== 'belum').length,
      setoran: log.length,
      halamanLulus: log.filter(lulusHalaman).length,
      terakhir: log.map(r => r.setoran_date).sort().at(-1) ?? null,
    }
  })

  // ── Perlu perhatian: pola di Jum'at-Jum'at terakhir ──
  const perhatian: AnalitikTR['perhatian'] = []
  const sudahLewat = berjalan.filter(t => t <= hariIni)
  for (const a of peserta) {
    const urut = sudahLewat.map(t => statusAnak(a.id, t)).reverse()
    const beruntun = (f: (x: ReturnType<typeof statusAnak>) => boolean) => { let n = 0; for (const x of urut) { if (f(x)) n++; else break } return n }
    const dasar = { id: a.id, nama: a.full_name, kelas: a.kelas, kelompok: labelKelompok.get(a.teacher_id) ?? '—' }
    const alfa = beruntun(x => x.status === 'alfa')
    const tanpa = beruntun(x => x.status === 'hadir' && !x.setor)
    const izin = beruntun(x => x.status === 'izin' || x.status === 'sakit')
    const pernahSetor = ts.some(r => r.student_id === a.id)
    if (alfa >= 2) perhatian.push({ ...dasar, alasan: `Alfa ${alfa} Jum'at berturut-turut`, nada: 'bahaya' })
    else if (tanpa >= 2) perhatian.push({ ...dasar, alasan: `Hadir, tidak setor ${tanpa} Jum'at`, nada: 'waspada' })
    else if (izin >= 2) perhatian.push({ ...dasar, alasan: `Izin/sakit ${izin} Jum'at berturut-turut`, nada: 'biasa' })
    else if (!pernahSetor && sudahLewat.length >= 2) perhatian.push({ ...dasar, alasan: 'Belum pernah setor di TR', nada: 'waspada' })
  }
  const bobot = { bahaya: 0, waspada: 1, biasa: 2 }
  perhatian.sort((x, y) => bobot[x.nada] - bobot[y.nada] || x.nama.localeCompare(y.nama, 'id'))

  // ── Per tingkat kelas (2, 3, …) ──
  const tingkatMap = new Map<string, typeof siswa>()
  for (const s of siswa) {
    const t = s.kelas?.match(/^\d+/)?.[0] ?? '—'
    tingkatMap.set(t, [...(tingkatMap.get(t) ?? []), s])
  }
  const kelas = [...tingkatMap].map(([tingkat, anak]) => ({
    tingkat, anak: anak.length,
    hadirPersen: persen(anak.reduce((n, a) => n + a.hadir, 0), anak.reduce((n, a) => n + a.pertemuan, 0)),
    setoranPerAnak: anak.length ? anak.reduce((n, a) => n + a.setoran, 0) / anak.length : null,
  })).sort((a, b) => a.tingkat.localeCompare(b.tingkat, 'id', { numeric: true }))

  return {
    tabelAda: true, dari, sampai, peserta: peserta.length, kelompokJumlah: kelompok.length,
    jumat, ringkas, kelompok: perKelompok, siswa, perhatian, kelas,
  }
}
