import { createServerClient } from '@/lib/supabase/server'
import { getCapaianKelas, BELUM_TERCATAT, type CapaianKelompok, type MatriksCapaian } from '@/lib/data/capaian-kelas'
import { getTargetTahfidz } from '@/lib/data/target-tahfidz'
import { RENCANA } from '@/lib/rq/target-tahfidz'
import { UNIT_LABELS } from '@/lib/rq/programs'
import type { Jenjang } from '@/types'

/**
 * Laporan bulanan Kurikulum & Pembelajaran Al-Qur'an — Bab 02 Laporan
 * Eksekutif BPH (format disepakati 2026-09, doc "Usulan Format Laporan
 * Pembelajaran Al-Qur'an (Bab 02)").
 *
 * Seluruh angka dihitung PER TANGGAL TERAKHIR BULAN lalu disimpan sebagai
 * snapshot (laporan_kurikulum.data). Laporan yang sudah dikirim ke BPH tidak
 * berubah hanya karena guru mengoreksi setoran belakangan. Snapshot sengaja
 * tanpa daftar nama siswa — tabel laporan hanya berisi jumlah.
 *
 * Yang tidak bisa dihitung mundur dan karena itu dibaca "saat dihitung":
 * status aktif siswa, target tahfidz (posisi dari seluruh setoran), dan
 * antrean ujian. Ketiganya ditandai di laporan.
 */

export const UNIT_LAPORAN: Jenjang[] = ['sd', 'smp']

// ─── Bentuk snapshot ─────────────────────────────────────────────────────

export interface BarisLaporan {
  tingkat: number | null
  label: string
  sel: number[]
  total: number
  maju: number
  bertarget: number
  target?: string
}

export interface MatriksLaporan {
  judul?: string
  kolom: string[]
  /** Label tampilan kolom (mis. KIBAR: Jilid 1 → Kibar A). Sejajar dengan kolom. */
  labelKolom: string[]
  baris: BarisLaporan[]
  jumlahKolom: number[]
  total: number
  maju: number
  bertarget: number
}

export interface KelompokLaporan {
  kode: string
  jenjang: Jenjang
  jalur: 'reguler' | 'quls'
  judul: string
  siswa: number
  metode: string[]
  tahsin: MatriksLaporan
  tahfidz: MatriksLaporan[]
}

export interface KeaktifanUnit {
  jenjang: Jenjang
  label: string
  siswa: number
  setorTahsin: number
  setorTahfidz: number
  setorSalahSatu: number
  jumlahTahsin: number
  jumlahTahfidz: number
  perKelas: { tingkat: number; siswa: number; setorTahsin: number; setorTahfidz: number }[]
}

export interface UjianUnit {
  jenjang: Jenjang
  label: string
  tahsinKelompok: number
  tahsinPeserta: number
  juziyyah: number
  tasmi3: number
  tasmi5: number
  mengulang: number
  antrean: number
}

export interface TargetRencana {
  kode: string
  label: string
  perTingkat: { tingkat: number; diBawah: number; sesuai: number; diAtas: number; belum: number }[]
}

export interface KelengkapanBaris {
  nama: string
  unit: string
  siswa: number
  tahsin: number
  tahfidz: number
}

export interface IsiLaporan {
  versi: 1
  /** 'YYYY-MM' */
  periode: string
  /** Tanggal acuan posisi siswa, 'YYYY-MM-DD'. */
  sampai: string
  dihitung: string
  kpi: {
    siswa: number
    capaiTahsin: [number, number]
    capaiTahfidz: [number, number]
    setorBulanIni: number
    ujianSelesai: number
  }
  kelompok: KelompokLaporan[]
  keaktifan: KeaktifanUnit[]
  halaqohSepi: { halaqoh: string; pengampu: string; unit: string }[]
  ujian: UjianUnit[]
  target: TargetRencana[]
  kelengkapan: { perUnit: KelengkapanBaris[]; perGuru: KelengkapanBaris[] }
}

export interface KotakAnalisis {
  analisis: string
  masalah: string
  rekomendasi: string
}

export interface BarisMasalah {
  area: string
  masalah: string
  rekomendasi: string
  prioritas: 'Tinggi' | 'Sedang' | 'Rendah'
}

export interface NarasiLaporan {
  /** Satu poin per baris. */
  sorotan: string
  perhatian: string
  analisis: Record<string, KotakAnalisis>
  masalah: BarisMasalah[]
  kesimpulan: string
}

export type StatusLaporan = 'draf' | 'diajukan' | 'disetujui'

export interface EdisiLaporan {
  id: string
  periode: string
  status: StatusLaporan
  data: IsiLaporan
  narasi: NarasiLaporan
  dihitung_at: string
  diajukan_at: string | null
  disetujui_at: string | null
  catatan_kepala: string
  updated_at: string
}

// ─── Periode ─────────────────────────────────────────────────────────────

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function namaPeriode(periode: string): string {
  const [y, m] = periode.split('-').map(Number)
  return `${BULAN[m - 1]} ${y}`
}

/** 'YYYY-MM' → hari terakhir bulan itu, 'YYYY-MM-DD'. */
export function akhirBulan(periode: string): string {
  const [y, m] = periode.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${periode}-${String(d).padStart(2, '0')}`
}

export function periodeSah(p: string | undefined | null): p is string {
  return !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p)
}

export function periodeSebelum(periode: string): string {
  const [y, m] = periode.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ─── Perhitungan ─────────────────────────────────────────────────────────

async function ambilSemua<T>(buat: () => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }> }): Promise<T[]> {
  const hasil: T[] = []
  for (let hal = 0; hal < 200; hal++) {
    const { data, error } = await buat().range(hal * 1000, hal * 1000 + 999)
    if (error) { console.error('[laporan-kurikulum]', error); break }
    const b = (data ?? []) as T[]
    hasil.push(...b)
    if (b.length < 1000) break
  }
  return hasil
}

const tingkatOf = (kelas: string | null) => {
  const n = Number(String(kelas ?? '').match(/\d+/)?.[0])
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
}

/** KIBAR (QULS SDIT) menamai jilidnya Kibar A/B/C di laporan BPH. */
function labelKolom(k: CapaianKelompok, kolom: string[]): string[] {
  const kibar = k.metode.length > 0 && k.metode.every(m => m.toUpperCase() === 'KIBAR')
  return kolom.map(c => {
    if (c === BELUM_TERCATAT) return 'Belum'
    if (c === 'Lulus') return 'Lulus Munaqosyah'
    const j = /^Jilid ([1-3])$/.exec(c)
    if (kibar && j) return `Kibar ${'ABC'[Number(j[1]) - 1]}`
    return c
  })
}

function ringkasMatriks(m: MatriksCapaian, label: string[]): MatriksLaporan {
  return {
    judul: m.judul,
    kolom: m.kolom,
    labelKolom: label,
    baris: m.baris.map(b => ({
      tingkat: b.tingkat, label: b.label, sel: b.sel, total: b.total,
      maju: b.maju, bertarget: b.bertarget ?? 0, target: b.target,
    })),
    jumlahKolom: m.jumlahKolom,
    total: m.total,
    maju: m.maju,
    bertarget: m.bertarget ?? 0,
  }
}

export async function hitungIsiLaporan(periode: string): Promise<IsiLaporan> {
  const sampai = akhirBulan(periode)
  const dari = `${periode}-01`
  const akhirHari = `${sampai}T23:59:59+07:00`
  const awalHari = `${dari}T00:00:00+07:00`
  // Tujuh hari terakhir bulan itu — penanda halaqoh yang berhenti setor.
  const [ys, ms, ds] = sampai.split('-').map(Number)
  const awalPekan = new Date(Date.UTC(ys, ms - 1, ds - 6)).toISOString().slice(0, 10)

  const supabase = createServerClient()
  const [capaian, siswaRows, logTahsin, logTahfidz, halaqohRows, guruRows, uTahfidz, uTahsin, antreTahfidz, antreTahsin, target] = await Promise.all([
    getCapaianKelas(UNIT_LAPORAN, { sampai }),
    ambilSemua<{ id: string; jenjang: Jenjang; kelas: string | null }>(() => supabase.from('students')
      .select('id, jenjang, kelas').eq('is_active', true).in('jenjang', UNIT_LAPORAN).order('id')),
    ambilSemua<{ student_id: string; halaqoh_id: string | null; setoran_date: string }>(() => supabase.from('tahsin_logs')
      .select('student_id, halaqoh_id, setoran_date').gte('setoran_date', dari).lte('setoran_date', sampai).order('id')),
    ambilSemua<{ student_id: string; halaqoh_id: string | null; setoran_date: string }>(() => supabase.from('tahfidz_logs')
      .select('student_id, halaqoh_id, setoran_date').gte('setoran_date', dari).lte('setoran_date', sampai).order('id')),
    supabase.from('halaqoh').select('id, name, jenjang, wali_teacher_id, term_id').eq('is_active', true).in('jenjang', UNIT_LAPORAN),
    supabase.from('teachers').select('id, full_name'),
    ambilSemua<{ unit: string; tipe: string; predikat: string | null }>(() => supabase.from('ujian_tahfidz')
      .select('unit, tipe, predikat').eq('status', 'selesai').gte('jadwal', awalHari).lte('jadwal', akhirHari).order('id')),
    ambilSemua<{ unit: string; siswa: unknown[] | null }>(() => supabase.from('ujian_tahsin')
      .select('unit, siswa').eq('status', 'selesai').gte('jadwal', awalHari).lte('jadwal', akhirHari).order('id')),
    ambilSemua<{ unit: string }>(() => supabase.from('ujian_tahfidz')
      .select('unit').eq('status', 'diajukan').lte('created_at', akhirHari).order('id')),
    ambilSemua<{ unit: string }>(() => supabase.from('ujian_tahsin')
      .select('unit').eq('status', 'diajukan').lte('created_at', akhirHari).order('id')),
    getTargetTahfidz(UNIT_LAPORAN, sampai).catch(() => null),
  ])

  // ── Capaian per kelompok + kelengkapan (dari rincian sebelum dibuang) ──
  const kelompok: KelompokLaporan[] = capaian.kelompok
    .filter(k => UNIT_LAPORAN.includes(k.jenjang))
    .map(k => ({
      kode: k.kode, jenjang: k.jenjang, jalur: k.jalur, judul: k.judul, siswa: k.siswa, metode: k.metode,
      tahsin: ringkasMatriks(k.tahsin, labelKolom(k, k.tahsin.kolom)),
      tahfidz: k.tahfidz.map(m => ringkasMatriks(m, labelKolom(k, m.kolom))),
    }))

  const perGuru = new Map<string, KelengkapanBaris>()
  const perUnitLengkap = new Map<Jenjang, KelengkapanBaris>()
  for (const k of capaian.kelompok.filter(x => UNIT_LAPORAN.includes(x.jenjang))) {
    const unit = UNIT_LABELS[k.jenjang]
    const u = perUnitLengkap.get(k.jenjang) ?? { nama: unit, unit, siswa: 0, tahsin: 0, tahfidz: 0 }
    const iBelum = k.tahsin.kolom.indexOf(BELUM_TERCATAT)
    for (const b of k.tahsin.baris) b.rincian?.forEach((sel, i) => sel.forEach(s => {
      const nama = s.pengampu ?? 'Belum ada pengampu'
      const g = perGuru.get(`${nama}|${unit}`) ?? { nama, unit, siswa: 0, tahsin: 0, tahfidz: 0 }
      g.siswa++; u.siswa++
      if (i !== iBelum) { g.tahsin++; u.tahsin++ }
      perGuru.set(`${nama}|${unit}`, g)
    }))
    for (const m of k.tahfidz) {
      const iB = m.kolom.indexOf(BELUM_TERCATAT)
      for (const b of m.baris) b.rincian?.forEach((sel, i) => sel.forEach(s => {
        if (i === iB) return
        const nama = s.pengampu ?? 'Belum ada pengampu'
        const g = perGuru.get(`${nama}|${unit}`)
        if (g) g.tahfidz++
        u.tahfidz++
      }))
    }
    perUnitLengkap.set(k.jenjang, u)
  }

  // ── Keaktifan setoran ──
  const siswaById = new Map(siswaRows.map(s => [s.id, s]))
  const keaktifan: KeaktifanUnit[] = UNIT_LAPORAN.map(j => {
    const ids = siswaRows.filter(s => s.jenjang === j)
    const tsh = logTahsin.filter(l => siswaById.get(l.student_id)?.jenjang === j)
    const tfz = logTahfidz.filter(l => siswaById.get(l.student_id)?.jenjang === j)
    const setT = new Set(tsh.map(l => l.student_id)), setF = new Set(tfz.map(l => l.student_id))
    const tingkatAda = [...new Set(ids.map(s => tingkatOf(s.kelas)).filter((t): t is number => t !== null))].sort((a, b) => a - b)
    return {
      jenjang: j, label: UNIT_LABELS[j], siswa: ids.length,
      setorTahsin: setT.size, setorTahfidz: setF.size, setorSalahSatu: new Set([...setT, ...setF]).size,
      jumlahTahsin: tsh.length, jumlahTahfidz: tfz.length,
      perKelas: tingkatAda.map(t => {
        const di = ids.filter(s => tingkatOf(s.kelas) === t)
        return { tingkat: t, siswa: di.length, setorTahsin: di.filter(s => setT.has(s.id)).length, setorTahfidz: di.filter(s => setF.has(s.id)).length }
      }),
    }
  }).filter(k => k.siswa > 0)

  const namaGuru = new Map(((guruRows.data ?? []) as { id: string; full_name: string }[]).map(g => [g.id, g.full_name]))
  const halaqohAktifPekan = new Set([...logTahsin, ...logTahfidz].filter(l => l.setoran_date >= awalPekan).map(l => l.halaqoh_id))
  // Hanya halaqoh semester berjalan: pengacakan tiap semester membuat baris baru,
  // dan halaqoh semester lalu yang masih aktif tidak boleh terhitung "sepi".
  const { data: term } = await supabase.from('academic_terms').select('id').eq('is_current', true).maybeSingle()
  const idTerm = (term as { id: string } | null)?.id
  const halaqohSepi = ((halaqohRows.data ?? []) as { id: string; name: string; jenjang: Jenjang; wali_teacher_id: string | null; term_id: string | null }[])
    .filter(h => (!idTerm || !h.term_id || h.term_id === idTerm) && !halaqohAktifPekan.has(h.id))
    .map(h => ({ halaqoh: h.name, pengampu: h.wali_teacher_id ? namaGuru.get(h.wali_teacher_id) ?? '—' : '—', unit: UNIT_LABELS[h.jenjang] }))
    .sort((a, b) => a.unit.localeCompare(b.unit) || a.halaqoh.localeCompare(b.halaqoh, 'id', { numeric: true }))

  // ── Ujian ──
  const unitUjian: Record<string, Jenjang> = { SD: 'sd', SMP: 'smp' }
  const ujian: UjianUnit[] = UNIT_LAPORAN.map(j => {
    const kode = Object.keys(unitUjian).find(k => unitUjian[k] === j)!
    const tf = uTahfidz.filter(u => u.unit === kode)
    const ts = uTahsin.filter(u => u.unit === kode)
    return {
      jenjang: j, label: UNIT_LABELS[j],
      tahsinKelompok: ts.length,
      tahsinPeserta: ts.reduce((n, u) => n + (Array.isArray(u.siswa) ? u.siswa.length : 0), 0),
      juziyyah: tf.filter(u => u.tipe === '1_juz').length,
      tasmi3: tf.filter(u => u.tipe === '3_juz').length,
      tasmi5: tf.filter(u => u.tipe === '5_juz').length,
      mengulang: tf.filter(u => u.predikat === 'mengulang').length,
      antrean: antreTahfidz.filter(u => u.unit === kode).length + antreTahsin.filter(u => u.unit === kode).length,
    }
  })

  // ── Target tahfidz ──
  const targetLaporan: TargetRencana[] = (target?.perRencana ?? []).map(r => ({
    kode: r.kode,
    label: RENCANA[r.kode].label,
    perTingkat: r.perTingkat.filter(t => t.ringkas.total > 0).map(t => ({
      tingkat: t.tingkat, diBawah: t.ringkas.di_bawah, sesuai: t.ringkas.sesuai, diAtas: t.ringkas.di_atas, belum: t.ringkas.belum_terukur,
    })),
  })).filter(r => r.perTingkat.length > 0)

  const jumlah = (f: (k: KelompokLaporan) => [number, number]) =>
    kelompok.reduce<[number, number]>((a, k) => { const [n, d] = f(k); return [a[0] + n, a[1] + d] }, [0, 0])

  return {
    versi: 1,
    periode,
    sampai,
    dihitung: new Date().toISOString(),
    kpi: {
      siswa: kelompok.reduce((n, k) => n + k.siswa, 0),
      capaiTahsin: jumlah(k => [k.tahsin.maju, k.tahsin.bertarget]),
      capaiTahfidz: jumlah(k => [k.tahfidz.reduce((a, m) => a + m.maju, 0), k.tahfidz.reduce((a, m) => a + m.bertarget, 0)]),
      setorBulanIni: keaktifan.reduce((n, k) => n + k.setorSalahSatu, 0),
      ujianSelesai: ujian.reduce((n, u) => n + u.tahsinPeserta + u.juziyyah + u.tasmi3 + u.tasmi5, 0),
    },
    kelompok,
    keaktifan,
    halaqohSepi,
    ujian,
    target: targetLaporan,
    kelengkapan: {
      perUnit: [...perUnitLengkap.values()],
      perGuru: [...perGuru.values()].sort((a, b) => a.unit.localeCompare(b.unit) || (a.tahsin / a.siswa) - (b.tahsin / b.siswa) || a.nama.localeCompare(b.nama)),
    },
  }
}

// ─── Sub-bab: satu daftar yang dipakai halaman, draf narasi, dan .docx ───

export interface SubBab {
  /** Kunci isian analisis, mis. '2.1.1'. */
  kunci: string
  nomor: string
  judul: string
}

export function susunBab(isi: IsiLaporan): { kelompok: Record<string, KelompokLaporan | undefined>; sub: SubBab[] } {
  const k = (kode: string) => isi.kelompok.find(x => x.kode === kode)
  const kel = { sdReg: k('sd:reguler'), sdQuls: k('sd:quls'), smpReg: k('smp:reguler'), smpQuls: k('smp:quls') }
  const sub: SubBab[] = [
    { kunci: '2.1.1', nomor: '2.1.1', judul: 'Capaian Tahsin Kelas CLIL' },
    { kunci: '2.1.2', nomor: '2.1.2', judul: 'Capaian Tahfidz Kelas CLIL' },
    { kunci: '2.2.1', nomor: '2.2.1', judul: 'Capaian Tahsin QULS' },
    { kunci: '2.2.2', nomor: '2.2.2', judul: 'Capaian Tahfidz QULS' },
    { kunci: '2.3', nomor: '2.3', judul: 'Progres Tahsin SMP' },
    { kunci: '2.4', nomor: '2.4', judul: 'Progres Hafalan (Tahfidz) SMP' },
    { kunci: '2.5', nomor: '2.5', judul: 'Keaktifan Setoran' },
    { kunci: '2.6', nomor: '2.6', judul: 'Ujian Bulan Ini' },
    { kunci: '2.7', nomor: '2.7', judul: 'Ketercapaian Target Tahfidz' },
    { kunci: '2.8', nomor: '2.8', judul: 'Kelengkapan Data' },
  ]
  return { kelompok: kel, sub }
}

// ─── Draf narasi otomatis ────────────────────────────────────────────────

/** Target tahsin 'Tahfidz' di kurikulum_targets berarti lulus tahsin (munaqosyah). */
export function labelTarget(t: string | undefined | null): string {
  if (!t) return '—'
  return t === 'Tahfidz' ? 'Lulus Munaqosyah' : t
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

function kalimatMatriks(m: MatriksLaporan, apa: 'tahsin' | 'tahfidz', judul: string): string {
  const baris = m.baris.filter(b => b.total > 0)
  if (baris.length === 0) return `Belum ada siswa ${judul}.`
  const iBelum = m.kolom.indexOf(BELUM_TERCATAT)
  const belum = iBelum >= 0 ? m.jumlahKolom[iBelum] : 0
  const kalimat: string[] = []
  kalimat.push(`${m.total} siswa, ${m.total - belum} sudah tercatat setorannya${belum ? ` dan ${belum} belum pernah setor` : ''}.`)
  // Kolom terbanyak per kelas, tanpa menghitung kolom "Belum".
  const puncak = baris.flatMap(b => {
    let i = -1
    b.sel.forEach((n, idx) => { if (idx !== iBelum && n > 0 && (i < 0 || n > b.sel[i])) i = idx })
    return i < 0 ? [] : [`${b.label} terbanyak di ${m.labelKolom[i]} (${b.sel[i]})`]
  })
  if (puncak.length) kalimat.push(`${puncak.join('; ')}.`)
  const bertarget = baris.filter(b => b.bertarget > 0)
  if (bertarget.length) {
    const urut = [...bertarget].sort((a, b) => pct(b.maju, b.bertarget) - pct(a.maju, a.bertarget))
    kalimat.push(`${pct(m.maju, m.bertarget)}% siswa (${m.maju} dari ${m.bertarget}) mencapai target ${apa}; tertinggi ${urut[0].label} (${pct(urut[0].maju, urut[0].bertarget)}%), terendah ${urut[urut.length - 1].label} (${pct(urut[urut.length - 1].maju, urut[urut.length - 1].bertarget)}%).`)
  }
  return kalimat.join(' ')
}

export function drafNarasi(isi: IsiLaporan): NarasiLaporan {
  const { kelompok: kel } = susunBab(isi)
  const analisis: Record<string, KotakAnalisis> = {}
  const kotak = (analisisTeks: string): KotakAnalisis => ({ analisis: analisisTeks, masalah: '', rekomendasi: '' })

  const tahfidzBlok = (k: KelompokLaporan) => k.tahfidz.map((m, i) => (i === 0 ? '' : `Blok ${m.judul}: `) + kalimatMatriks(m, 'tahfidz', k.judul)).join(' ')
  if (kel.sdReg) { analisis['2.1.1'] = kotak(kalimatMatriks(kel.sdReg.tahsin, 'tahsin', kel.sdReg.judul)); analisis['2.1.2'] = kotak(tahfidzBlok(kel.sdReg)) }
  if (kel.sdQuls) { analisis['2.2.1'] = kotak(kalimatMatriks(kel.sdQuls.tahsin, 'tahsin', kel.sdQuls.judul)); analisis['2.2.2'] = kotak(tahfidzBlok(kel.sdQuls)) }
  analisis['2.3'] = kotak([kel.smpReg, kel.smpQuls].filter(Boolean).map(k => `${k!.judul}: ${kalimatMatriks(k!.tahsin, 'tahsin', k!.judul)}`).join(' '))
  analisis['2.4'] = kotak([kel.smpReg, kel.smpQuls].filter(Boolean).map(k => `${k!.judul}: ${kalimatMatriks(k!.tahfidz[0], 'tahfidz', k!.judul)}`).join(' '))
  analisis['2.5'] = kotak(isi.keaktifan.map(k => `${k.label}: ${k.setorSalahSatu} dari ${k.siswa} siswa (${pct(k.setorSalahSatu, k.siswa)}%) setor setidaknya sekali; ${k.jumlahTahsin} setoran tahsin dan ${k.jumlahTahfidz} setoran tahfidz.`).join(' ')
    + (isi.halaqohSepi.length ? ` ${isi.halaqohSepi.length} halaqoh tanpa setoran pada pekan terakhir bulan ini.` : ''))
  analisis['2.6'] = kotak(isi.ujian.map(u => `${u.label}: ${u.tahsinPeserta} peserta ujian tahsin, ${u.juziyyah} juz'iyyah, ${u.tasmi3 + u.tasmi5} tasmi'${u.mengulang ? `, ${u.mengulang} mengulang` : ''}; ${u.antrean} pengajuan menunggu jadwal.`).join(' '))
  analisis['2.7'] = kotak(isi.target.map(r => {
    const t = r.perTingkat.reduce((a, x) => ({ b: a.b + x.diBawah, s: a.s + x.sesuai + x.diAtas, n: a.n + x.belum }), { b: 0, s: 0, n: 0 })
    return `${r.label}: ${t.s} sesuai/di atas target, ${t.b} di bawah target, ${t.n} belum terukur.`
  }).join(' '))
  analisis['2.8'] = kotak(isi.kelengkapan.perUnit.map(u => `${u.nama}: posisi tahsin tercatat ${pct(u.tahsin, u.siswa)}% (${u.tahsin}/${u.siswa}), tahfidz ${pct(u.tahfidz, u.siswa)}% (${u.tahfidz}/${u.siswa}).`).join(' '))

  // Sorotan: kelas dengan % target tertinggi; perhatian: terendah & data kosong.
  const semuaBaris = isi.kelompok.flatMap(k => [
    ...k.tahsin.baris.filter(b => b.bertarget >= 5).map(b => ({ k, b, apa: 'tahsin' })),
  ])
  const urut = [...semuaBaris].sort((a, b) => pct(b.b.maju, b.b.bertarget) - pct(a.b.maju, a.b.bertarget))
  const sorotan = urut.slice(0, 2).filter(x => x.b.maju > 0)
    .map(x => `${x.k.judul} ${x.b.label}: ${pct(x.b.maju, x.b.bertarget)}% siswa mencapai target ${x.apa} (${labelTarget(x.b.target)}).`)
  sorotan.push(`${isi.kpi.setorBulanIni} siswa setor bulan ini; ${isi.kpi.ujianSelesai} ujian tahsin & tahfidz selesai.`)

  const perhatian = urut.slice(-2).reverse().filter(x => pct(x.b.maju, x.b.bertarget) < 50)
    .map(x => `${x.k.judul} ${x.b.label}: baru ${pct(x.b.maju, x.b.bertarget)}% mencapai target ${x.apa} (${labelTarget(x.b.target)}).`)
  for (const u of isi.kelengkapan.perUnit) if (pct(u.tahsin, u.siswa) < 80) perhatian.push(`${u.nama}: ${u.siswa - u.tahsin} siswa belum punya setoran tahsin di aplikasi.`)
  if (isi.halaqohSepi.length) perhatian.push(`${isi.halaqohSepi.length} halaqoh tanpa setoran pada pekan terakhir bulan ini.`)

  const masalah: BarisMasalah[] = []
  for (const x of urut.filter(x => pct(x.b.maju, x.b.bertarget) < 25 && x.b.bertarget >= 10).slice(0, 4)) {
    masalah.push({ area: `Tahsin ${x.k.judul} ${x.b.label}`, masalah: `Baru ${pct(x.b.maju, x.b.bertarget)}% (${x.b.maju}/${x.b.bertarget}) mencapai target ${labelTarget(x.b.target)}.`, rekomendasi: '', prioritas: 'Tinggi' })
  }
  for (const u of isi.kelengkapan.perUnit) if (pct(u.tahsin, u.siswa) < 80) {
    masalah.push({ area: `Kelengkapan data ${u.nama}`, masalah: `${u.siswa - u.tahsin} dari ${u.siswa} siswa belum punya setoran tahsin di aplikasi.`, rekomendasi: 'Tagih pencatatan setoran ke guru pengampu (lihat 2.8).', prioritas: 'Tinggi' })
  }
  if (isi.halaqohSepi.length) masalah.push({ area: 'Keaktifan halaqoh', masalah: `${isi.halaqohSepi.length} halaqoh tanpa setoran pada pekan terakhir.`, rekomendasi: '', prioritas: 'Sedang' })

  return { sorotan: sorotan.join('\n'), perhatian: perhatian.join('\n'), analisis, masalah, kesimpulan: '' }
}

// ─── Baca/tulis edisi ────────────────────────────────────────────────────

const KOLOM_EDISI = 'id, periode, status, data, narasi, dihitung_at, diajukan_at, disetujui_at, catatan_kepala, updated_at'

function keEdisi(r: Record<string, unknown>): EdisiLaporan {
  return { ...(r as unknown as EdisiLaporan), periode: String(r.periode).slice(0, 7) }
}

/** null = tabel belum ada (migrasi 0092 belum dijalankan). */
export async function daftarEdisi(): Promise<Pick<EdisiLaporan, 'id' | 'periode' | 'status' | 'dihitung_at' | 'disetujui_at'>[] | null> {
  const { data, error } = await createServerClient().from('laporan_kurikulum')
    .select('id, periode, status, dihitung_at, disetujui_at').order('periode', { ascending: false })
  if (error) return null
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({ ...(r as never as EdisiLaporan), periode: String(r.periode).slice(0, 7) }))
}

export async function getEdisi(periode: string): Promise<EdisiLaporan | null> {
  const { data } = await createServerClient().from('laporan_kurikulum')
    .select(KOLOM_EDISI).eq('periode', `${periode}-01`).maybeSingle()
  return data ? keEdisi(data as Record<string, unknown>) : null
}

/** Edisi bulan sebelumnya, apa pun statusnya — pembanding kolom (+/−). */
export async function getEdisiSebelum(periode: string): Promise<EdisiLaporan | null> {
  return getEdisi(periodeSebelum(periode))
}
