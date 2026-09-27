import { createServerClient } from '@/lib/supabase/server'
import { getJadwalRiyadhoh, getPengampuRiyadhoh, getSiswaRiyadhoh, hariIniWIB, type StatusHadir } from '@/lib/data/riyadhoh'
import type { KelompokRiyadhoh } from '@/lib/rq/riyadhoh'

/**
 * Analitik Riyadhoh Sabtu — dibaca Kurikulum dan Koordinator SMP. Hanya
 * membaca: jadwal, peserta, pengampu (0098), kehadiran, dan setoran bertanda
 * riyadhoh. Seluruh agregasi di sini; halaman menerima angka jadi.
 *
 * Status seorang anak pada satu Sabtu mengikuti Laporan Riyadhoh pengampu:
 * izin/sakit/alfa dari presensi; punya setoran = hadir; hadir tanpa setoran
 * = tidak setor; tanpa presensi & tanpa setoran = belum dicatat.
 *
 * Catatan: peserta dihitung menurut daftar peserta HARI INI (anak yang naik
 * kelas / pindah kelompok ikut tergeser ke Sabtu lampau). Cukup untuk
 * membaca kecenderungan satu semester.
 */

export type RentangRiyadhoh = 'semester' | 'bulan' | 'empat'
export type CapaianUtama = 'ziyadah' | 'murojaah_baru' | 'murojaah_lama' | 'tahsin' | 'tidak_setor'

export interface SabtuAnalitik {
  tanggal: string
  kelompok: KelompokRiyadhoh | null
  total: number
  hadir: number
  izin: number
  sakit: number
  alfa: number
  belum: number
  capaian: Record<CapaianUtama, number>
}

export interface AnalitikRiyadhoh {
  tabelAda: boolean
  dari: string
  sampai: string
  peserta: { total: number; putra: number; putri: number }
  sabtu: SabtuAnalitik[]
  /** Sabtu mendatang (±8) — null = belum diatur. */
  mendatang: { tanggal: string; kelompok: KelompokRiyadhoh | null }[]
  terakhir: null | {
    tanggal: string
    kelompok: KelompokRiyadhoh
    total: number
    hadir: number
    setor: number
    jenis: { ziyadah: number; murojaah_baru: number; murojaah_lama: number; tahsin: number }
    tidakSetor: number; izin: number; sakit: number; alfa: number; belum: number
    pengampu: { nama: string; lengkap: boolean; ket: string }[]
  }
  mutu: { rataBintang: number | null; persenUlang: number | null; ziyadahPerSabtu: { semua: number | null; putra: number | null; putri: number | null } }
  perhatian: { id: string; nama: string; kelas: string | null; pengampu: string | null; alasan: string; nada: 'bahaya' | 'waspada' | 'biasa' }[]
  pengampu: {
    id: string; nama: string; kelompok: KelompokRiyadhoh; anak: number; hadirPersen: number | null
    ziyadah: number; murojaah: number; tidakSetor: number; rataBintang: number | null
    pencatatan: ('lengkap' | 'sebagian' | 'kosong')[]
  }[]
  tanpaPengampu: number
  kelas: { kelas: string; kelompok: KelompokRiyadhoh | null; anak: number; hadirPersen: number | null; ziyadahPersen: number | null; tidakSetorPerSabtu: number | null }[]
}

const tambahHari = (t: string, n: number) => new Date(Date.parse(`${t}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

export function rentangRiyadhoh(r: RentangRiyadhoh, hariIni = hariIniWIB()): { dari: string; sampai: string } {
  const [y, m] = hariIni.split('-').map(Number)
  if (r === 'bulan') return { dari: `${hariIni.slice(0, 7)}-01`, sampai: hariIni }
  if (r === 'empat') return { dari: tambahHari(hariIni, -27), sampai: hariIni }
  // Semester: Juli–Desember atau Januari–Juni.
  return { dari: m >= 7 ? `${y}-07-01` : `${y}-01-01`, sampai: hariIni }
}

const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

export async function getAnalitikRiyadhoh(opsi: { rentang: RentangRiyadhoh; kelompok?: KelompokRiyadhoh | null; pengampu?: string | null }): Promise<AnalitikRiyadhoh> {
  const hariIni = hariIniWIB()
  const { dari, sampai } = rentangRiyadhoh(opsi.rentang, hariIni)
  const supabase = createServerClient()

  const [jadwalRentang, jadwalDepan, siswa, pengampuList] = await Promise.all([
    getJadwalRiyadhoh(dari, sampai),
    getJadwalRiyadhoh(tambahHari(hariIni, 1), tambahHari(hariIni, 60)),
    getSiswaRiyadhoh(),
    getPengampuRiyadhoh(),
  ])
  const kosong: AnalitikRiyadhoh = {
    tabelAda: false, dari, sampai, peserta: { total: 0, putra: 0, putri: 0 }, sabtu: [], mendatang: [], terakhir: null,
    mutu: { rataBintang: null, persenUlang: null, ziyadahPerSabtu: { semua: null, putra: null, putri: null } },
    perhatian: [], pengampu: [], tanpaPengampu: 0, kelas: [],
  }
  if (jadwalRentang === null) return kosong

  const namaGuru = new Map(pengampuList.map(p => [p.teacher_id, p.full_name]))
  const semuaPeserta = siswa.filter(s => s.ikut && s.gender)
  const peserta = semuaPeserta
    .filter(s => !opsi.kelompok || s.gender === opsi.kelompok)
    .filter(s => !opsi.pengampu || s.pengampu_id === opsi.pengampu)
  const ids = peserta.map(s => s.id)

  // Semua Sabtu dalam rentang (termasuk yang tidak terjadwal = libur).
  const semuaSabtu: string[] = []
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) {
    if (new Date(`${t}T00:00:00Z`).getUTCDay() === 6) semuaSabtu.push(t)
  }
  const sabtuAktif = semuaSabtu.filter(t => jadwalRentang[t] && (!opsi.kelompok || jadwalRentang[t] === opsi.kelompok))

  const [hadirRes, tfRes, tsRes] = ids.length ? await Promise.all([
    supabase.from('riyadhoh_hadir').select('student_id, tanggal, status').in('student_id', ids).gte('tanggal', dari).lte('tanggal', sampai),
    supabase.from('tahfidz_logs').select('student_id, setoran_date, kind, nilai_tahfidz').in('student_id', ids).eq('riyadhoh', true).gte('setoran_date', dari).lte('setoran_date', sampai),
    supabase.from('tahsin_logs').select('student_id, setoran_date, status, nilai_tahsin').in('student_id', ids).eq('riyadhoh', true).gte('setoran_date', dari).lte('setoran_date', sampai),
  ]) : [{ data: [] }, { data: [] }, { data: [] }]
  const hadirRows = (hadirRes.data ?? []) as { student_id: string; tanggal: string; status: StatusHadir }[]
  const tf = (tfRes.data ?? []) as { student_id: string; setoran_date: string; kind: string; nilai_tahfidz: number | null }[]
  const ts = (tsRes.data ?? []) as { student_id: string; setoran_date: string; status: string | null; nilai_tahsin: number | null }[]

  const kunci = (id: string, t: string) => `${id}|${t}`
  const presensi = new Map(hadirRows.map(r => [kunci(r.student_id, r.tanggal), r.status]))
  const jenisTf = new Map<string, Set<string>>()
  for (const r of tf) { const k = kunci(r.student_id, r.setoran_date); jenisTf.set(k, (jenisTf.get(k) ?? new Set()).add(r.kind)) }
  const adaTs = new Set(ts.map(r => kunci(r.student_id, r.setoran_date)))

  type Status = StatusHadir | 'belum'
  const statusAnak = (id: string, t: string): { status: Status; capaian: CapaianUtama | null } => {
    const k = kunci(id, t)
    const p = presensi.get(k)
    const kinds = jenisTf.get(k)
    const setor = !!kinds || adaTs.has(k)
    if (p && p !== 'hadir') return { status: p, capaian: null }
    if (!p && !setor) return { status: 'belum', capaian: null }
    // Capaian tertinggi anak itu pada Sabtu itu.
    const c: CapaianUtama = kinds?.has('ziyadah') ? 'ziyadah'
      : kinds?.has('murojaah_baru') ? 'murojaah_baru'
      : kinds && kinds.size > 0 ? 'murojaah_lama'
      : adaTs.has(k) ? 'tahsin' : 'tidak_setor'
    return { status: 'hadir', capaian: c }
  }

  const pesertaKelompok = (g: KelompokRiyadhoh) => peserta.filter(s => s.gender === g)

  const sabtu: SabtuAnalitik[] = semuaSabtu
    .filter(t => !opsi.kelompok || !jadwalRentang[t] || jadwalRentang[t] === opsi.kelompok)
    .map(t => {
      const g = jadwalRentang[t] ?? null
      const anak = g ? pesertaKelompok(g) : []
      const s: SabtuAnalitik = { tanggal: t, kelompok: g, total: anak.length, hadir: 0, izin: 0, sakit: 0, alfa: 0, belum: 0,
        capaian: { ziyadah: 0, murojaah_baru: 0, murojaah_lama: 0, tahsin: 0, tidak_setor: 0 } }
      for (const a of anak) {
        const x = statusAnak(a.id, t)
        s[x.status]++
        if (x.capaian) s.capaian[x.capaian]++
      }
      return s
    })

  // ── Sabtu terakhir (yang sudah lewat / hari ini) ──
  const tTerakhir = [...sabtuAktif].reverse().find(t => t <= hariIni)
  let terakhir: AnalitikRiyadhoh['terakhir'] = null
  if (tTerakhir) {
    const g = jadwalRentang[tTerakhir]!
    const anak = pesertaKelompok(g)
    const st = anak.map(a => ({ a, x: statusAnak(a.id, tTerakhir) }))
    const hitungTf = (kind: string) => anak.filter(a => jenisTf.get(kunci(a.id, tTerakhir))?.has(kind)).length
    const guruG = pengampuList.filter(p => p.kelompok.includes(g) && (!opsi.pengampu || p.teacher_id === opsi.pengampu))
    terakhir = {
      tanggal: tTerakhir, kelompok: g, total: anak.length,
      hadir: st.filter(y => y.x.status === 'hadir').length,
      setor: st.filter(y => y.x.capaian && y.x.capaian !== 'tidak_setor').length,
      jenis: {
        ziyadah: hitungTf('ziyadah'), murojaah_baru: hitungTf('murojaah_baru'),
        murojaah_lama: anak.filter(a => { const k = jenisTf.get(kunci(a.id, tTerakhir)); return !!k && (k.has('murojaah_lama') || k.has('murojaah') || k.has('tasmi')) }).length,
        tahsin: anak.filter(a => adaTs.has(kunci(a.id, tTerakhir))).length,
      },
      tidakSetor: st.filter(y => y.x.capaian === 'tidak_setor').length,
      izin: st.filter(y => y.x.status === 'izin').length, sakit: st.filter(y => y.x.status === 'sakit').length,
      alfa: st.filter(y => y.x.status === 'alfa').length, belum: st.filter(y => y.x.status === 'belum').length,
      pengampu: guruG.map(p => {
        const milik = st.filter(y => y.a.pengampu_id === p.teacher_id)
        const belum = milik.filter(y => y.x.status === 'belum').length
        const tanpaSetor = milik.filter(y => y.x.capaian === 'tidak_setor').length
        return {
          nama: p.full_name, lengkap: milik.length > 0 && belum === 0,
          ket: milik.length === 0 ? 'belum punya anak' : belum === 0 ? (tanpaSetor ? `lengkap · ${tanpaSetor} tidak setor` : 'lengkap') : `${belum} anak belum dicatat`,
        }
      }),
    }
  }

  // ── Mutu setoran ──
  const nilai = [...tf.map(r => r.nilai_tahfidz), ...ts.map(r => r.nilai_tahsin)].filter((n): n is number => n !== null).map(Number)
  const zPer = (g: KelompokRiyadhoh | null) => rata(sabtu.filter(s => s.kelompok && (!g || s.kelompok === g)).map(s => s.capaian.ziyadah))
  const mutu = {
    rataBintang: nilai.length ? Math.max(0, Math.min(5, ((rata(nilai) ?? 50) - 50) / 10)) : null,
    persenUlang: ts.length ? persen(ts.filter(r => r.status === 'ulang').length, ts.length) : null,
    ziyadahPerSabtu: { semua: zPer(null), putra: zPer('L'), putri: zPer('P') },
  }

  // ── Anak yang perlu perhatian: pola di Sabtu-Sabtu terakhir kelompoknya ──
  const perhatian: AnalitikRiyadhoh['perhatian'] = []
  for (const a of peserta) {
    const sabtuAnak = sabtuAktif.filter(t => jadwalRentang[t] === a.gender && t <= hariIni)
    const urut = sabtuAnak.map(t => statusAnak(a.id, t)).reverse()
    const beruntun = (f: (x: ReturnType<typeof statusAnak>) => boolean) => { let n = 0; for (const x of urut) { if (f(x)) n++; else break } return n }
    const alfa = beruntun(x => x.status === 'alfa')
    const tanpa = beruntun(x => x.capaian === 'tidak_setor')
    const izin = beruntun(x => x.status === 'izin' || x.status === 'sakit')
    const dasar = { id: a.id, nama: a.full_name, kelas: a.kelas, pengampu: a.pengampu_id ? namaGuru.get(a.pengampu_id) ?? null : null }
    if (alfa >= 2) perhatian.push({ ...dasar, alasan: `Alfa ${alfa} Sabtu berturut-turut`, nada: 'bahaya' })
    else if (tanpa >= 2) perhatian.push({ ...dasar, alasan: `Hadir, tidak setor ${tanpa} Sabtu`, nada: 'waspada' })
    else if (izin >= 2) perhatian.push({ ...dasar, alasan: `Izin/sakit ${izin} Sabtu berturut-turut`, nada: 'biasa' })
  }
  const bobot = { bahaya: 0, waspada: 1, biasa: 2 }
  perhatian.sort((x, y) => bobot[x.nada] - bobot[y.nada] || x.nama.localeCompare(y.nama, 'id'))

  // ── Per pengampu ──
  const pengampu = pengampuList
    .filter(p => !opsi.pengampu || p.teacher_id === opsi.pengampu)
    .flatMap(p => p.kelompok.filter(g => !opsi.kelompok || g === opsi.kelompok).map(g => ({ p, g })))
    .map(({ p, g }) => {
      const anak = peserta.filter(s => s.gender === g && s.pengampu_id === p.teacher_id)
      const tgl = sabtuAktif.filter(t => jadwalRentang[t] === g && t <= hariIni)
      let hadir = 0, catat = 0, z = 0, m = 0, tidak = 0
      const pencatatan: ('lengkap' | 'sebagian' | 'kosong')[] = []
      for (const t of tgl) {
        let belum = 0
        for (const a of anak) {
          const x = statusAnak(a.id, t)
          if (x.status === 'belum') { belum++; continue }
          catat++
          if (x.status === 'hadir') hadir++
          if (x.capaian === 'ziyadah') z++
          if (x.capaian === 'murojaah_baru' || x.capaian === 'murojaah_lama') m++
          if (x.capaian === 'tidak_setor') tidak++
        }
        pencatatan.push(anak.length === 0 ? 'kosong' : belum === 0 ? 'lengkap' : belum === anak.length ? 'kosong' : 'sebagian')
      }
      const idAnak = new Set(anak.map(a => a.id))
      const n = [...tf.filter(r => idAnak.has(r.student_id)).map(r => r.nilai_tahfidz), ...ts.filter(r => idAnak.has(r.student_id)).map(r => r.nilai_tahsin)]
        .filter((x): x is number => x !== null).map(Number)
      return {
        id: p.teacher_id, nama: p.full_name, kelompok: g, anak: anak.length, hadirPersen: persen(hadir, catat),
        ziyadah: z, murojaah: m, tidakSetor: tidak,
        rataBintang: n.length ? Math.max(0, Math.min(5, ((rata(n) ?? 50) - 50) / 10)) : null,
        pencatatan: pencatatan.slice(-5),
      }
    })
    .sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama, 'id'))

  // ── Per kelas ──
  const kelasMap = new Map<string, typeof peserta>()
  for (const a of peserta) kelasMap.set(a.kelas ?? '—', [...(kelasMap.get(a.kelas ?? '—') ?? []), a])
  const kelas = [...kelasMap].map(([k, anak]) => {
    let hadir = 0, catat = 0, z = 0, tidak = 0
    const tglKelas = new Set<string>()
    for (const a of anak) {
      for (const t of sabtuAktif.filter(t => jadwalRentang[t] === a.gender && t <= hariIni)) {
        tglKelas.add(t)
        const x = statusAnak(a.id, t)
        if (x.status === 'belum') continue
        catat++
        if (x.status === 'hadir') hadir++
        if (x.capaian === 'ziyadah') z++
        if (x.capaian === 'tidak_setor') tidak++
      }
    }
    const g = anak.every(a => a.gender === 'L') ? 'L' : anak.every(a => a.gender === 'P') ? 'P' : null
    return { kelas: k, kelompok: g as KelompokRiyadhoh | null, anak: anak.length, hadirPersen: persen(hadir, catat), ziyadahPersen: persen(z, hadir), tidakSetorPerSabtu: tglKelas.size ? tidak / tglKelas.size : null }
  }).sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }))

  // ── Sabtu mendatang ──
  const mendatang: AnalitikRiyadhoh['mendatang'] = []
  for (let t = tambahHari(hariIni, 1); mendatang.length < 6 && t <= tambahHari(hariIni, 60); t = tambahHari(t, 1)) {
    if (new Date(`${t}T00:00:00Z`).getUTCDay() === 6) mendatang.push({ tanggal: t, kelompok: jadwalDepan?.[t] ?? null })
  }

  return {
    tabelAda: true, dari, sampai,
    peserta: { total: peserta.length, putra: peserta.filter(s => s.gender === 'L').length, putri: peserta.filter(s => s.gender === 'P').length },
    sabtu, mendatang, terakhir, mutu, perhatian, pengampu,
    tanpaPengampu: semuaPeserta.filter(s => !s.pengampu_id && (!opsi.kelompok || s.gender === opsi.kelompok)).length,
    kelas,
  }
}
