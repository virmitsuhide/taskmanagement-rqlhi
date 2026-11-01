import { BELUM_TERCATAT as BELUM_TERCATAT_LAPORAN } from '@/lib/data/capaian-kelas'
import {
  daftarUnit, kelompokSub, labelTarget, LABEL_UNIT_LAPORAN, namaPeriode, strukturBab,
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
  /** Nomor bagian Identifikasi Masalah — selalu yang terakhir (lihat strukturBab). */
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

/** Baris dicocokkan per tingkat; kelas tanpa nomor (TKA/TKB di PAUD) per label. */
const samaBaris = (a: { tingkat: number | null; label: string }, b: { tingkat: number | null; label: string }) =>
  a.tingkat !== null || b.tingkat !== null ? a.tingkat === b.tingkat : a.label === b.label

function nilaiLalu(m: MatriksLaporan | undefined, baris: { tingkat: number | null; label: string }, kolom: string): number | undefined {
  if (!m) return undefined
  const b = m.baris.find(x => samaBaris(x, baris))
  const i = m.kolom.indexOf(kolom)
  if (!b || i < 0) return b ? 0 : undefined
  return b.sel[i]
}

function tabelMatriks(m: MatriksLaporan, lalu: MatriksLaporan | undefined, opsi: { target: boolean; judul?: string }): TabelModel {
  const header = ['Kelas', ...m.labelKolom, 'Jumlah', ...(opsi.target ? ['Target'] : []), 'Capai target']
  const isi = m.baris.map(b => [
    b.label,
    ...b.sel.map((n, i) => denganDelta(n, nilaiLalu(lalu, b, m.kolom[i]))),
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
function tabelGabunganTahsin(kel: KelompokLaporan[], lalu: IsiLaporan | null): TabelModel | null {
  if (kel.length === 0) return null
  const kolom: string[] = []
  const label = new Map<string, string>()
  for (const k of kel) k.tahsin.kolom.forEach((c, i) => { if (!kolom.includes(c)) { kolom.push(c); label.set(c, k.tahsin.labelKolom[i]) } })
  // "Belum" selalu paling kanan.
  kolom.sort((a, b) => (a === BELUM_TERCATAT_LAPORAN ? 1 : 0) - (b === BELUM_TERCATAT_LAPORAN ? 1 : 0))
  // Kunci baris: nomor kelas, atau label untuk kelas tanpa nomor (TKA/TKB).
  const kunciBaris = (b: { tingkat: number | null; label: string }) => b.tingkat ?? b.label
  const urutan = kel.flatMap(k => k.tahsin.baris)
  const tingkat = [...new Set(urutan.map(kunciBaris))]
    .sort((a, b) => (typeof a === 'number' ? a : 99) - (typeof b === 'number' ? b : 99) || urutan.findIndex(x => kunciBaris(x) === a) - urutan.findIndex(x => kunciBaris(x) === b))
  const isi: string[][] = []
  const jumlah = kolom.map(() => 0)
  let total = 0, maju = 0, bertarget = 0
  for (const t of tingkat) for (const k of kel) {
    const b = k.tahsin.baris.find(x => kunciBaris(x) === t)
    if (!b) continue
    const mLalu = lalu?.kelompok.find(x => x.kode === k.kode)?.tahsin
    const sel = kolom.map(c => { const i = k.tahsin.kolom.indexOf(c); return i < 0 ? 0 : b.sel[i] })
    sel.forEach((n, i) => { jumlah[i] += n })
    total += b.total; maju += b.maju; bertarget += b.bertarget
    isi.push([b.label, k.jalur === 'quls' ? 'QULS' : 'Reguler', ...sel.map((n, i) => denganDelta(n, nilaiLalu(mLalu, b, kolom[i]))), angka(b.total), labelTarget(b.target), capai(b.maju, b.bertarget)])
  }
  isi.push(['Total', '', ...jumlah.map(angka), angka(total), '', capai(maju, bertarget)])
  return { header: ['Kelas', 'Program', ...kolom.map(c => label.get(c)!), 'Jumlah', 'Target', 'Capai target'], baris: isi, adaTotal: true }
}

const KOSONG: KotakAnalisis = { analisis: '', masalah: '', rekomendasi: '' }

export function susunLaporan(isi: IsiLaporan, narasi: NarasiLaporan, lalu: IsiLaporan | null): LaporanModel {
  const kl = (kode: string) => lalu?.kelompok.find(x => x.kode === kode)
  const an = (kunci: string) => narasi.analisis[kunci] ?? KOSONG
  const bulan = namaPeriode(isi.periode)
  const sub: SubBabModel[] = []

  const st = strukturBab(isi)
  const no = (kunci: string) => st.sub.find(s => s.kunci === kunci)?.nomor ?? kunci
  const tglAcuan = isi.sampai.split('-').reverse().join('-')
  const delta = lalu ? ' Angka dalam kurung = perubahan dari laporan bulan lalu.' : ''
  const jalurLabel = (x: KelompokLaporan) => (x.jalur === 'quls' ? 'QULS' : 'Reguler')

  // Capaian per unit, urut menurut strukturBab (TPAIT/PAUD → SDIT → SD Juara → SMPIT → SMA).
  for (const s of st.sub) {
    if (!s.unit) continue
    const u = s.unit
    const label = LABEL_UNIT_LAPORAN[u.jenjang]
    const kel = kelompokSub(isi, u)
    const banyak = kel.length > 1
    // Nama di judul grafik: SD per jalur (Kelas CLIL / QULS), unit lain per unit (+ jalur bila dua).
    const nama = (x: KelompokLaporan) => u.jenjang === 'sd'
      ? (x.jalur === 'quls' ? 'QULS' : 'Kelas CLIL')
      : banyak ? `${label} ${jalurLabel(x)}` : label
    const dasar = { kunci: s.kunci, nomor: s.nomor, induk: s.induk, judul: s.judul, analisis: an(s.kunci) }
    if (kel.length === 0) {
      sub.push({ ...dasar, pengantar: `Belum ada siswa ${u.jenjang === 'sd' ? 'bertanda program ini' : label} di aplikasi.`, tabel: [], grafik: [] })
      continue
    }
    if (u.apa === 'tahsin') {
      const gabung = banyak ? tabelGabunganTahsin(kel, lalu) : null
      sub.push({
        ...dasar,
        pengantar: (u.jenjang === 'sd' ? `Berikut data capaian tahsin siswa ${nama(kel[0])} SDIT LHI per ${tglAcuan}.`
          : u.jenjang === 'sd_juara' ? 'Kelas 1 memakai KIBAR, kelas 2–6 memakai IQRO.'
          : `Posisi tahsin siswa ${label} per ${tglAcuan}.`) + delta,
        tabel: gabung ? [gabung] : [tabelMatriks(kel[0].tahsin, kl(kel[0].kode)?.tahsin, { target: true })],
        grafik: kel.map(x => grafikMatriks(x.tahsin, `Persebaran capaian tahsin ${nama(x)} — ${bulan}`)),
      })
    } else {
      const tf = kel.filter(x => x.tahfidz.length > 0)
      sub.push({
        ...dasar,
        pengantar: u.jenjang === 'sma'
          ? 'Jumlah juz yang sudah dihafal; SMA tidak mengikuti urutan juz tertentu.' + delta
          : 'Kolom mengikuti urutan hafalan RQ; "3 juz" dan "5 juz" = sudah menuntaskan tiga/lima juz bloknya dan belum mulai juz berikutnya.' + delta,
        tabel: tf.flatMap(x => x.tahfidz.map(m => tabelMatriks(m, kl(x.kode)?.tahfidz.find(y => y.judul === m.judul), {
          target: false,
          judul: [banyak ? jalurLabel(x) : '', x.tahfidz.length > 1 || banyak ? m.judul ?? '' : ''].filter(Boolean).join(' — ') || undefined,
        }))),
        grafik: tf.map(x => grafikMatriks(x.tahfidz[0], `Persebaran capaian tahfidz ${nama(x)} — ${bulan}`)),
      })
    }
  }

  // Bagian lintas-unit — nomornya dari strukturBab.
  // Keaktifan
  sub.push({
    kunci: '2.5', nomor: no('2.5'), judul: 'Keaktifan Setoran',
    pengantar: `Siswa yang tercatat setor di aplikasi selama ${bulan}.`
      + (isi.keaktifanTanpaEkstra ? ' Setoran di halaqoh ekstra tidak dihitung di sini; lihat bagian Ekstra.' : ''),
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

  // Ujian
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

  // Target tahfidz
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

  // Kelengkapan
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

  // Ekstra — sesudah bagian lintas-unit, hanya edisi yang memuatnya.
  const e = isi.ekstra
  if (e) {
    const eLalu = lalu?.ekstra
    const d = (n: number, l: number | undefined) => denganDelta(n, l)
    const luar = e.setoranLuarTahsin + e.setoranLuarTahfidz
    sub.push({
      kunci: 'eks', nomor: no('eks'), judul: 'Ekstra Tahsin & Tahfidz',
      pengantar: 'Kelompok ekstra di luar jam sekolah, termasuk peserta dari luar LHI. Peserta & kelompok dihitung saat laporan dihitung; pertemuan, kehadiran, dan setoran sepanjang bulan.'
        + (e.capaian?.length ? ` Tabel capaian memuat peserta siswa LHI saja, posisinya per ${isi.sampai.split('-').reverse().join('-')} dari seluruh setoran (sekolah & ekstra).` : '')
        + (eLalu ? ' Angka dalam kurung = perubahan dari laporan bulan lalu.' : ''),
      tabel: [
        {
          header: ['Uraian', 'Jumlah'],
          baris: [
            ['Kelompok (halaqoh) ekstra berjalan', d(e.kelompok, eLalu?.kelompok)],
            ['Guru pengampu', d(e.guru, eLalu?.guru)],
            ['Peserta aktif', d(e.peserta, eLalu?.peserta)],
            ['— siswa LHI', d(e.pesertaLhi, eLalu?.pesertaLhi)],
            ['— dari luar LHI', d(e.pesertaNon, eLalu?.pesertaNon)],
            ['Peserta mulai / berhenti bulan ini', `${angka(e.mulai)} / ${angka(e.berhenti)}`],
            ['Pertemuan berpresensi', d(e.pertemuan, eLalu?.pertemuan)],
            ['Kehadiran', e.catatanHadir ? `${pct(e.hadir, e.catatanHadir)} (${angka(e.hadir)} dari ${angka(e.catatanHadir)} catatan)` : '—'],
            ['Jadwal tanpa presensi', angka(e.tanpaPresensi)],
            ['Setoran tahsin siswa LHI', d(e.setoranTahsin, eLalu?.setoranTahsin)],
            ['Setoran tahfidz siswa LHI', d(e.setoranTahfidz, eLalu?.setoranTahfidz)],
            ['Setoran peserta luar LHI (tahsin / tahfidz)', luar ? `${angka(e.setoranLuarTahsin)} / ${angka(e.setoranLuarTahfidz)}` : '0'],
          ],
        },
        ...(e.perJenis.length ? [{
          judul: 'Per jenis ekstra',
          header: ['Jenis', 'Kelompok', 'Peserta'],
          baris: [
            ...e.perJenis.map(j => [j.nama, angka(j.halaqoh), angka(j.peserta)]),
            ['Total', angka(e.perJenis.reduce((n, j) => n + j.halaqoh, 0)), angka(e.perJenis.reduce((n, j) => n + j.peserta, 0))],
          ],
          adaTotal: true,
        }] : []),
        // Capaian peserta LHI per unit — tahsin dengan target kelas, lalu hafalan.
        ...(e.capaian ?? []).flatMap(x => {
          const xl = eLalu?.capaian?.find(y => y.kode === x.kode)
          return [
            tabelMatriks(x.tahsin, xl?.tahsin, { target: true, judul: `Capaian tahsin peserta ekstra — ${x.judul} (${angka(x.siswa)} anak)` }),
            ...x.tahfidz.filter(m => m.total > 0).map(m => tabelMatriks(m, xl?.tahfidz.find(y => y.judul === m.judul),
              { target: false, judul: `Capaian tahfidz peserta ekstra — ${x.judul}${x.tahfidz.length > 1 ? ` · ${m.judul}` : ''}` })),
          ]
        }),
      ],
      grafik: (e.capaian ?? []).map(x => grafikMatriks(x.tahsin, `Tahsin peserta ekstra ${x.judul} — ${bulan}`)),
      analisis: an('eks'),
    })
  }

  const [ct, dt] = isi.kpi.capaiTahsin, [cf, df] = isi.kpi.capaiTahfidz
  return {
    judulBab: "02  LAPORAN KURIKULUM & PEMBELAJARAN AL-QUR'AN",
    subjudul: `Curriculum & Qur'an Learning Report — ${bulan}`,
    acuan: `Posisi siswa per ${isi.sampai.split('-').reverse().join('-')}, dihitung dari setoran, kenaikan, dan ujian yang tercatat di aplikasi RQ LHI.`,
    kpi: [
      { label: `Siswa ${daftarUnit(isi)}`, nilai: angka(isi.kpi.siswa), keterangan: 'siswa aktif' },
      { label: 'Capai target tahsin', nilai: pct(ct, dt), keterangan: `${angka(ct)} dari ${angka(dt)} siswa` },
      { label: 'Capai target tahfidz', nilai: pct(cf, df), keterangan: `${angka(cf)} dari ${angka(df)} siswa` },
      { label: 'Setor bulan ini', nilai: angka(isi.kpi.setorBulanIni), keterangan: 'siswa, tahsin atau tahfidz' },
      { label: 'Ujian selesai', nilai: angka(isi.kpi.ujianSelesai), keterangan: 'peserta tahsin & tahfidz' },
    ],
    sorotan: baris(narasi.sorotan),
    perhatian: baris(narasi.perhatian),
    sub,
    masalah: narasi.masalah.filter(m => m.area.trim() || m.masalah.trim()),
    nomorMasalah: st.nomorMasalah,
    kesimpulan: baris(narasi.kesimpulan),
  }
}
