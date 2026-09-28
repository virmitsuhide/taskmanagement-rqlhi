import { BELUM_TERCATAT as BELUM_TERCATAT_LAPORAN } from '@/lib/data/capaian-kelas'
import {
  labelTarget, namaPeriode, nomorBab,
  type IsiLaporan, type KelompokLaporan, type KotakAnalisis, type MatriksLaporan, type NarasiLaporan, type BarisMasalah,
} from '@/lib/data/laporan-kurikulum'
import { svgBatang, type GrafikBatang } from './grafik'

/**
 * Model tampilan Bab 02 — SATU susunan yang dirender dua kali: halaman
 * pratinjau (HTML) dan berkas .docx. Semua angka sudah jadi teks di sini,
 * jadi web dan Word tidak mungkin berbeda isi.
 */

export interface TabelModel {
  judul?: string
  header: string[]
  baris: string[][]
  /** Baris terakhir adalah baris jumlah (dicetak tebal). */
  adaTotal?: boolean
  catatan?: string
}

export interface SubBabModel {
  kunci: string
  nomor: string
  judul: string
  /** Sub-bab induk (2.1 Kelas CLIL) — dicetak sebagai judul tingkat 2 sebelum sub-bab pertamanya. */
  induk?: string
  pengantar?: string
  tabel: TabelModel[]
  grafik: { judul: string; svg: string }[]
  analisis: KotakAnalisis
}

export interface LaporanModel {
  judulBab: string
  subjudul: string
  acuan: string
  kpi: { label: string; nilai: string; keterangan: string }[]
  sorotan: string[]
  perhatian: string[]
  sub: SubBabModel[]
  masalah: BarisMasalah[]
  /** Nomor bagian Identifikasi Masalah — 2.9, atau 2.10 bila ada SD Juara. */
  nomorMasalah: string
  kesimpulan: string[]
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')
const capai = (n: number, d: number) => (d > 0 ? `${pct(n, d)} (${n})` : '—')
const baris = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
const angka = (n: number) => n.toLocaleString('id-ID')

/** Selisih dengan bulan lalu untuk satu sel: '12 (+3)'. */
function denganDelta(n: number, lalu: number | undefined): string {
  if (lalu === undefined || lalu === n) return angka(n)
  const d = n - lalu
  return `${angka(n)} (${d > 0 ? '+' : '−'}${Math.abs(d)})`
}

function nilaiLalu(m: MatriksLaporan | undefined, tingkat: number | null, kolom: string): number | undefined {
  if (!m) return undefined
  const b = m.baris.find(x => x.tingkat === tingkat)
  const i = m.kolom.indexOf(kolom)
  if (!b || i < 0) return b ? 0 : undefined
  return b.sel[i]
}

function tabelMatriks(m: MatriksLaporan, lalu: MatriksLaporan | undefined, opsi: { target: boolean; judul?: string }): TabelModel {
  const header = ['Kelas', ...m.labelKolom, 'Jumlah', ...(opsi.target ? ['Target'] : []), 'Capai target']
  const isi = m.baris.map(b => [
    b.label,
    ...b.sel.map((n, i) => denganDelta(n, nilaiLalu(lalu, b.tingkat, m.kolom[i]))),
    angka(b.total),
    ...(opsi.target ? [labelTarget(b.target)] : []),
    capai(b.maju, b.bertarget),
  ])
  isi.push(['Total', ...m.jumlahKolom.map(angka), angka(m.total), ...(opsi.target ? [''] : []), capai(m.maju, m.bertarget)])
  return { judul: opsi.judul, header, baris: isi, adaTotal: true }
}

function grafikMatriks(m: MatriksLaporan, judul: string): { judul: string; svg: string } {
  const g: GrafikBatang = {
    judul,
    baris: m.baris.map(b => b.label),
    seri: m.kolom.map((k, i) => ({
      label: m.labelKolom[i],
      nilai: m.baris.map(b => b.sel[i]),
      belum: k === BELUM_TERCATAT_LAPORAN,
    })),
  }
  return { judul, svg: svgBatang(g) }
}

/** Tahsin reguler & QULS satu unit (SMP, SD Juara) dalam satu tabel, baris = kelas × program. */
function tabelGabunganTahsin(reg: KelompokLaporan | undefined, quls: KelompokLaporan | undefined, lalu: IsiLaporan | null): TabelModel | null {
  const kel = [reg, quls].filter((k): k is KelompokLaporan => !!k && k.siswa > 0)
  if (kel.length === 0) return null
  const kolom: string[] = []
  const label = new Map<string, string>()
  for (const k of kel) k.tahsin.kolom.forEach((c, i) => { if (!kolom.includes(c)) { kolom.push(c); label.set(c, k.tahsin.labelKolom[i]) } })
  // "Belum" selalu paling kanan.
  kolom.sort((a, b) => (a === BELUM_TERCATAT_LAPORAN ? 1 : 0) - (b === BELUM_TERCATAT_LAPORAN ? 1 : 0))
  const tingkat = [...new Set(kel.flatMap(k => k.tahsin.baris.map(b => b.tingkat)))].sort((a, b) => (a ?? 99) - (b ?? 99))
  const isi: string[][] = []
  const jumlah = kolom.map(() => 0)
  let total = 0, maju = 0, bertarget = 0
  for (const t of tingkat) for (const k of kel) {
    const b = k.tahsin.baris.find(x => x.tingkat === t)
    if (!b) continue
    const mLalu = lalu?.kelompok.find(x => x.kode === k.kode)?.tahsin
    const sel = kolom.map(c => { const i = k.tahsin.kolom.indexOf(c); return i < 0 ? 0 : b.sel[i] })
    sel.forEach((n, i) => { jumlah[i] += n })
    total += b.total; maju += b.maju; bertarget += b.bertarget
    isi.push([b.label, k.jalur === 'quls' ? 'QULS' : 'Reguler', ...sel.map((n, i) => denganDelta(n, nilaiLalu(mLalu, t, kolom[i]))), angka(b.total), labelTarget(b.target), capai(b.maju, b.bertarget)])
  }
  isi.push(['Total', '', ...jumlah.map(angka), angka(total), '', capai(maju, bertarget)])
  return { header: ['Kelas', 'Program', ...kolom.map(c => label.get(c)!), 'Jumlah', 'Target', 'Capai target'], baris: isi, adaTotal: true }
}

const KOSONG: KotakAnalisis = { analisis: '', masalah: '', rekomendasi: '' }

export function susunLaporan(isi: IsiLaporan, narasi: NarasiLaporan, lalu: IsiLaporan | null): LaporanModel {
  const k = (kode: string) => isi.kelompok.find(x => x.kode === kode)
  const kl = (kode: string) => lalu?.kelompok.find(x => x.kode === kode)
  const an = (kunci: string) => narasi.analisis[kunci] ?? KOSONG
  const bulan = namaPeriode(isi.periode)
  const sub: SubBabModel[] = []

  const bagianSd = (kode: string, induk: string, nomor: string, nama: string) => {
    const kel = k(kode)
    if (!kel) return
    const lalu_ = kl(kode)
    const pesanKosong = kel.siswa === 0 ? 'Belum ada siswa bertanda program ini di aplikasi.' : undefined
    sub.push({
      kunci: `${nomor}.1`, nomor: `${nomor}.1`, induk, judul: `Capaian Tahsin ${nama}`,
      pengantar: pesanKosong ?? `Berikut data capaian tahsin siswa ${nama} SDIT LHI per ${isi.sampai.split('-').reverse().join('-')}.`,
      tabel: kel.siswa ? [tabelMatriks(kel.tahsin, lalu_?.tahsin, { target: true })] : [],
      grafik: kel.siswa ? [grafikMatriks(kel.tahsin, `Persebaran capaian tahsin ${nama} — ${bulan}`)] : [],
      analisis: an(`${nomor}.1`),
    })
    sub.push({
      kunci: `${nomor}.2`, nomor: `${nomor}.2`, judul: `Capaian Tahfidz ${nama}`,
      pengantar: pesanKosong ?? `Kolom mengikuti urutan hafalan RQ; "3 juz" dan "5 juz" = sudah menuntaskan tiga/lima juz bloknya dan belum mulai juz berikutnya.`,
      tabel: kel.siswa ? kel.tahfidz.map(m => tabelMatriks(m, lalu_?.tahfidz.find(x => x.judul === m.judul), { target: false, judul: kel.tahfidz.length > 1 ? m.judul : undefined })) : [],
      grafik: kel.siswa ? [grafikMatriks(kel.tahfidz[0], `Persebaran capaian tahfidz ${nama} — ${bulan}`)] : [],
      analisis: an(`${nomor}.2`),
    })
  }
  bagianSd('sd:reguler', '2.1 Kelas CLIL', '2.1', 'Kelas CLIL')
  bagianSd('sd:quls', '2.2 Kelas QULS', '2.2', 'QULS')

  const smpReg = k('smp:reguler'), smpQuls = k('smp:quls')
  const tSmp = tabelGabunganTahsin(smpReg, smpQuls, lalu)
  sub.push({
    kunci: '2.3', nomor: '2.3', judul: 'Progres Tahsin SMP',
    pengantar: lalu ? 'Angka dalam kurung = perubahan dari laporan bulan lalu.' : undefined,
    tabel: tSmp ? [tSmp] : [],
    grafik: [smpReg, smpQuls].filter((x): x is KelompokLaporan => !!x && x.siswa > 0)
      .map(x => grafikMatriks(x.tahsin, `Tahsin SMP ${x.jalur === 'quls' ? 'QULS' : 'Reguler'} — ${bulan}`)),
    analisis: an('2.3'),
  })
  sub.push({
    kunci: '2.4', nomor: '2.4', judul: `Progres Hafalan (Tahfidz) SMP — ${bulan}`,
    tabel: [smpReg, smpQuls].filter((x): x is KelompokLaporan => !!x && x.siswa > 0).flatMap(x => x.tahfidz.map(m =>
      tabelMatriks(m, kl(x.kode)?.tahfidz.find(y => y.judul === m.judul), { target: false, judul: `${x.jalur === 'quls' ? 'QULS' : 'Reguler'} — ${m.judul}` }))),
    grafik: [smpReg, smpQuls].filter((x): x is KelompokLaporan => !!x && x.siswa > 0)
      .map(x => grafikMatriks(x.tahfidz[0], `Tahfidz SMP ${x.jalur === 'quls' ? 'QULS' : 'Reguler'} — ${bulan}`)),
    analisis: an('2.4'),
  })

  // 2.5 SD LHI Juara — unit sendiri sejak 0099. Nomor bagian sesudahnya ikut
  // bergeser (lihat nomorBab); kuncinya tidak, supaya narasi edisi lama tetap
  // menempel ke bagian yang sama. Edisi sebelum SD Juara ikut dihitung tidak
  // punya kelompoknya, jadi bagian ini dilewati dan penomorannya tetap.
  const sdjReg = k('sd_juara:reguler'), sdjQuls = k('sd_juara:quls')
  if (sdjReg || sdjQuls) {
    const sdj = [sdjReg, sdjQuls].filter((x): x is KelompokLaporan => !!x && x.siswa > 0)
    const jalur = (x: KelompokLaporan) => (x.jalur === 'quls' ? 'QULS' : 'Reguler')
    const tSdj = tabelGabunganTahsin(sdjReg, sdjQuls, lalu)
    sub.push({
      kunci: 'sdj.1', nomor: '2.5.1', induk: '2.5 SD LHI Juara', judul: 'Progres Tahsin SD LHI Juara',
      pengantar: sdj.length === 0 ? 'Belum ada siswa SD LHI Juara di aplikasi.'
        : 'Kelas 1 memakai KIBAR, kelas 2–6 memakai IQRO.' + (lalu ? ' Angka dalam kurung = perubahan dari laporan bulan lalu.' : ''),
      tabel: tSdj ? [tSdj] : [],
      grafik: sdj.map(x => grafikMatriks(x.tahsin, `Tahsin SD Juara ${jalur(x)} — ${bulan}`)),
      analisis: an('sdj.1'),
    })
    sub.push({
      kunci: 'sdj.2', nomor: '2.5.2', judul: `Progres Hafalan (Tahfidz) SD LHI Juara — ${bulan}`,
      tabel: sdj.flatMap(x => x.tahfidz.map(m =>
        tabelMatriks(m, kl(x.kode)?.tahfidz.find(y => y.judul === m.judul), { target: false, judul: `${jalur(x)} — ${m.judul}` }))),
      grafik: sdj.map(x => grafikMatriks(x.tahfidz[0], `Tahfidz SD Juara ${jalur(x)} — ${bulan}`)),
      analisis: an('sdj.2'),
    })
  }
  const no = (kunci: string) => nomorBab(isi, kunci)

  // 2.5 Keaktifan (2.6 bila ada SD Juara)
  sub.push({
    kunci: '2.5', nomor: no('2.5'), judul: 'Keaktifan Setoran',
    pengantar: `Siswa yang tercatat setor di aplikasi selama ${bulan}.`,
    tabel: [
      {
        header: ['Unit', 'Siswa aktif', 'Setor tahsin', 'Setor tahfidz', 'Setor (salah satu)', 'Jumlah setoran tahsin', 'Jumlah setoran tahfidz'],
        baris: isi.keaktifan.map(u => [u.label, angka(u.siswa), capai(u.setorTahsin, u.siswa), capai(u.setorTahfidz, u.siswa), capai(u.setorSalahSatu, u.siswa), angka(u.jumlahTahsin), angka(u.jumlahTahfidz)]),
      },
      ...isi.keaktifan.map(u => ({
        judul: `${u.label} per kelas`,
        header: ['Kelas', 'Siswa', 'Setor tahsin', 'Setor tahfidz'],
        baris: u.perKelas.map(p => [`Kelas ${p.tingkat}`, angka(p.siswa), capai(p.setorTahsin, p.siswa), capai(p.setorTahfidz, p.siswa)]),
      })),
      ...(isi.halaqohSepi.length ? [{
        judul: `Halaqoh tanpa setoran pada tujuh hari terakhir bulan (${isi.halaqohSepi.length})`,
        header: ['Halaqoh', 'Pengampu', 'Unit'],
        baris: isi.halaqohSepi.map(h => [h.halaqoh, h.pengampu, h.unit]),
      }] : []),
    ],
    grafik: [],
    analisis: an('2.5'),
  })

  // 2.6 Ujian
  sub.push({
    kunci: '2.6', nomor: no('2.6'), judul: 'Ujian Bulan Ini',
    tabel: [{
      header: ['Unit', 'Peserta ujian tahsin', "Juz'iyyah", "Tasmi' 3 juz", "Tasmi' 5 juz", 'Mengulang', 'Menunggu jadwal*'],
      baris: isi.ujian.map(u => [u.label, angka(u.tahsinPeserta), angka(u.juziyyah), angka(u.tasmi3), angka(u.tasmi5), angka(u.mengulang), angka(u.antrean)]),
      catatan: '* Pengajuan yang belum dijadwalkan saat laporan dihitung.',
    }],
    grafik: [],
    analisis: an('2.6'),
  })

  // 2.7 Target tahfidz
  sub.push({
    kunci: '2.7', nomor: no('2.7'), judul: 'Ketercapaian Target Tahfidz',
    pengantar: 'Posisi hafalan tiap siswa dibandingkan rencana target programnya.',
    tabel: isi.target.map(r => ({
      judul: r.label,
      header: ['Tingkat', 'Di bawah target', 'Sesuai', 'Di atas target', 'Belum terukur', 'Sesuai / di atas'],
      baris: r.perTingkat.map(t => [`Kelas ${t.tingkat}`, angka(t.diBawah), angka(t.sesuai), angka(t.diAtas), angka(t.belum),
        pct(t.sesuai + t.diAtas, t.diBawah + t.sesuai + t.diAtas + t.belum)]),
    })),
    grafik: [],
    analisis: an('2.7'),
  })

  // 2.8 Kelengkapan
  sub.push({
    kunci: '2.8', nomor: no('2.8'), judul: 'Kelengkapan Data',
    pengantar: 'Siswa yang posisi tahsin & tahfidznya sudah tercatat dari setoran di aplikasi.',
    tabel: [
      {
        header: ['Unit', 'Siswa', 'Tahsin tercatat', 'Tahfidz tercatat'],
        baris: isi.kelengkapan.perUnit.map(u => [u.nama, angka(u.siswa), capai(u.tahsin, u.siswa), capai(u.tahfidz, u.siswa)]),
      },
      {
        judul: 'Per guru pengampu (yang paling belum lengkap di atas)',
        header: ['Guru', 'Unit', 'Siswa', 'Tahsin tercatat', 'Tahfidz tercatat'],
        baris: isi.kelengkapan.perGuru.map(g => [g.nama, g.unit, angka(g.siswa), capai(g.tahsin, g.siswa), capai(g.tahfidz, g.siswa)]),
      },
    ],
    grafik: [],
    analisis: an('2.8'),
  })

  const [ct, dt] = isi.kpi.capaiTahsin, [cf, df] = isi.kpi.capaiTahfidz
  return {
    judulBab: "02  LAPORAN KURIKULUM & PEMBELAJARAN AL-QUR'AN",
    subjudul: `Curriculum & Qur'an Learning Report — ${bulan}`,
    acuan: `Posisi siswa per ${isi.sampai.split('-').reverse().join('-')}, dihitung dari setoran, kenaikan, dan ujian yang tercatat di aplikasi RQ LHI.`,
    kpi: [
      { label: 'Siswa SDIT, SD Juara & SMPIT', nilai: angka(isi.kpi.siswa), keterangan: 'siswa aktif' },
      { label: 'Capai target tahsin', nilai: pct(ct, dt), keterangan: `${angka(ct)} dari ${angka(dt)} siswa` },
      { label: 'Capai target tahfidz', nilai: pct(cf, df), keterangan: `${angka(cf)} dari ${angka(df)} siswa` },
      { label: 'Setor bulan ini', nilai: angka(isi.kpi.setorBulanIni), keterangan: 'siswa, tahsin atau tahfidz' },
      { label: 'Ujian selesai', nilai: angka(isi.kpi.ujianSelesai), keterangan: 'peserta tahsin & tahfidz' },
    ],
    sorotan: baris(narasi.sorotan),
    perhatian: baris(narasi.perhatian),
    sub,
    masalah: narasi.masalah.filter(m => m.area.trim() || m.masalah.trim()),
    nomorMasalah: nomorBab(isi, '2.9'),
    kesimpulan: baris(narasi.kesimpulan),
  }
}
