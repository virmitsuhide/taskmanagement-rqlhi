import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { formatAngka, formatJuta, formatJuta1, formatPeriod, lastDayOf, monthName, percentOf, percentOf1 } from './period'
import { KPI_STATUS_LABEL, type KpiStatus } from './kpi'
import type { BagianNarasi } from './narasi'
import type { BudgetRow, ReportRow } from './report'
import type { ReportSheetProps } from '@/app/keuangan/laporan/ReportSheet'

/**
 * Laporan Keuangan BPH (bab 01) sebagai .docx — isi & urutan sama dengan
 * lembar cetak (ReportSheet). Dibangun di browser: grafik diambil dari SVG
 * yang sudah tampil di layar lalu dirasterisasi (lihat DocxButton), jadi
 * font & bentuknya identik dengan pratinjau.
 *
 * Gaya mengikuti bab 02 (lib/laporan-kurikulum/docx.ts) supaya dua bab
 * menyatu saat ditempel ke Laporan Eksekutif gabungan.
 */

export interface GambarGrafik { data: Uint8Array; lebar: number; tinggi: number }
/** Kunci = nomor subbab grafik ('1.2.2', '1.8.1', …). */
export type PetaGrafik = Record<string, GambarGrafik | undefined>

const NAVY = '1F3864'
const NAVY2 = '2E4E7E'
const EMAS = 'C9A227'
const ABU_SELANG = 'F2F2F2'
const GARIS = 'D9D9D9'
const GARIS_LUAR = 'BFBFBF'
const KETERANGAN = '595959'
const MERAH = 'C0392B'
// A4 dengan margin 2 cm: 11906 − 2 × 1134 = 9638 DXA.
const LEBAR = 9638

const KOTAK: Record<'hijau' | 'emas' | 'biru', { isi: string; garis: string }> = {
  hijau: { isi: 'E8F5EE', garis: '2A7D65' },
  emas: { isi: 'FDF6E3', garis: EMAS },
  biru: { isi: 'EAF1FB', garis: NAVY },
}
const BADGE: Record<KpiStatus, string> = {
  info: '1F3864', aman: '166534', membaik: '166534', pantau: '92400E', perlu_naik: '1A5276', kritis: 'A3341A',
}

type Blok = Paragraph | Table

const teks = (t: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text: t, bold: o.bold, size: o.size, color: o.color, italics: o.italics })

function para(t: string, o: { bold?: boolean; size?: number; after?: number; italics?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 120 }, children: [teks(t, o)] })
}

const h1 = (no: string, judul: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [teks(`${no}  ${judul}`)] })
const h2 = (no: string, judul: string) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [teks(`${no}  ${judul}`)] })
const jarak = (after = 160) => new Paragraph({ spacing: { after }, children: [] })

const garis = { style: BorderStyle.SINGLE, size: 2, color: GARIS }
const luar = { style: BorderStyle.SINGLE, size: 4, color: GARIS_LUAR }
const tepi = { top: luar, bottom: luar, left: luar, right: luar, insideHorizontal: garis, insideVertical: garis }

type Rata = 'kiri' | 'kanan' | 'tengah'
interface Kolom { judul: string; lebar: number; rata?: Rata }
interface Baris { sel: string[]; total?: boolean; tebal?: boolean; warna?: (string | undefined)[] }

/** Tabel laporan: kepala & total navy, baris selang abu, angka rata kanan. */
function tabel(kolom: Kolom[], baris: Baris[]): Blok[] {
  const jumlah = kolom.reduce((n, k) => n + k.lebar, 0)
  const lebar = kolom.map(k => Math.floor((k.lebar / jumlah) * LEBAR))
  lebar[lebar.length - 1] += LEBAR - lebar.reduce((a, b) => a + b, 0)
  const ukuran = kolom.length > 6 ? 16 : 18
  const rata = (r?: Rata) => (r === 'kanan' ? AlignmentType.RIGHT : r === 'tengah' ? AlignmentType.CENTER : AlignmentType.LEFT)

  const sel = (isi: string, i: number, o: { kepala?: boolean; total?: boolean; selang?: boolean; tebal?: boolean; warna?: string }) => new TableCell({
    width: { size: lebar[i], type: WidthType.DXA },
    shading: o.kepala || o.total ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : o.selang ? { type: ShadingType.CLEAR, color: 'auto', fill: ABU_SELANG } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: 'center',
    children: isi.split('\n').map(line => new Paragraph({
      alignment: o.kepala ? (kolom[i].rata === 'kanan' ? AlignmentType.RIGHT : rata(kolom[i].rata)) : rata(kolom[i].rata),
      children: [teks(line, {
        bold: o.kepala || o.total || o.tebal || !!o.warna,
        size: ukuran,
        color: o.kepala || o.total ? 'FFFFFF' : o.warna ?? '000000',
      })],
    })),
  })

  return [
    new Table({
      width: { size: LEBAR, type: WidthType.DXA },
      columnWidths: lebar,
      borders: tepi,
      rows: [
        new TableRow({ tableHeader: true, children: kolom.map((k, i) => sel(k.judul, i, { kepala: true })) }),
        ...baris.map((b, r) => new TableRow({
          cantSplit: true,
          children: b.sel.map((c, i) => sel(c, i, { total: b.total, selang: r % 2 === 1, tebal: b.tebal || i === 0, warna: b.warna?.[i] })),
        })),
      ],
    }),
    jarak(),
  ]
}

/** Kotak berwarna dengan garis kiri tebal — sorotan, evaluasi, catatan. */
function kotak(judul: string, baris: string[], varian: 'hijau' | 'emas' | 'biru'): Blok[] {
  const w = KOTAK[varian]
  const isi = [
    para(judul, { bold: true, color: NAVY, after: 80 }),
    ...(baris.length ? baris.map(b => new Paragraph({ numbering: { reference: 'butir', level: 0 }, spacing: { after: 60 }, children: [teks(b)] })) : [para('Belum ditulis.', { italics: true, color: KETERANGAN })]),
  ]
  return [
    new Table({
      width: { size: LEBAR, type: WidthType.DXA },
      columnWidths: [LEBAR],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: w.garis }, left: { style: BorderStyle.SINGLE, size: 24, color: w.garis },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: GARIS }, right: { style: BorderStyle.SINGLE, size: 4, color: GARIS },
        insideHorizontal: garis, insideVertical: garis,
      },
      rows: [new TableRow({ children: [new TableCell({
        width: { size: LEBAR, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: w.isi },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: isi,
      })] })],
    }),
    jarak(240),
  ]
}

/** Paragraf analisis (varian polos): baris pertama boleh berawalan tebal. */
function prosa(baris: string[], awalan?: string): Blok[] {
  if (!baris.length) return []
  return [
    ...baris.map((b, i) => new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100 },
      children: i === 0 && awalan ? [teks(`${awalan} `, { bold: true }), teks(b)] : [teks(b)],
    })),
    jarak(120),
  ]
}

function gambar(g: GambarGrafik | undefined, keterangan: string): Blok[] {
  if (!g) return [para('Belum ada data untuk diagram ini.', { italics: true, color: KETERANGAN })]
  const w = 600
  const h = Math.round((g.tinggi / g.lebar) * w)
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: 'png', data: g.data, transformation: { width: w, height: h } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [teks(keterangan, { italics: true, size: 18, color: KETERANGAN })] }),
  ]
}

const tgl = (iso: string) => iso.split('-').reverse().join('/')
const selisihTeks = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '-'}${formatAngka(Math.abs(n))}`)
const persenId = (n: number) => `${n.toLocaleString('id-ID')}%`

function tabelArus(rows: ReportRow[], total: number, head: string, totalLabel: string, ket: (slug: string) => string): Blok[] {
  return tabel(
    [{ judul: head, lebar: 24 }, { judul: 'Keterangan', lebar: 51 }, { judul: 'Jumlah (Rp)', lebar: 17, rata: 'kanan' }, { judul: '%', lebar: 8, rata: 'kanan' }],
    [
      ...rows.map(r => ({ sel: [r.name, ket(r.slug), formatAngka(r.amount), String(r.percent)] })),
      { sel: [totalLabel, '', formatAngka(total), '100'], total: true },
    ],
  )
}

function tabelAnggaran(rows: BudgetRow[], head: string, totalBudget: number, totalActual: number): Blok[] {
  const persen = (a: number, b: number) => (b ? persenId(percentOf1(a, b)) : '-')
  const k = (judul: string): Kolom => ({ judul, lebar: 16, rata: 'kanan' })
  return tabel(
    [{ judul: head, lebar: 36 }, k('Anggaran (Rp)'), k('Realisasi (Rp)'), k('Selisih (Rp)'), k('% Realisasi')],
    [
      ...rows.map(r => ({ sel: [r.name, formatAngka(r.budget), formatAngka(r.actual), selisihTeks(r.actual - r.budget), persen(r.actual, r.budget)] })),
      { sel: ['TOTAL', formatAngka(totalBudget), formatAngka(totalActual), selisihTeks(totalActual - totalBudget), persen(totalActual, totalBudget)], total: true },
    ],
  )
}

function sampul(bulan: string, akhir: string): Blok[] {
  const baris = [
    ['Disampaikan Kepada', 'Badan Pengurus Harian (BPH)'],
    ['Disampaikan Oleh', "Kepala Rumah Qur'an"],
    ['Isi Laporan', 'Laporan Keuangan'],
    ['Periode Pelaporan', `${bulan} (1—${Number(akhir.slice(8))} ${bulan})`],
    ['Tanggal Laporan', bulan],
    ['Klasifikasi', 'TERBATAS'],
  ]
  const lebar = [3200, LEBAR - 3200]
  return [
    jarak(1200),
    para('YAYASAN PIONIR PENDIDIKAN INDONESIA', { bold: true, size: 22, color: NAVY2, align: AlignmentType.CENTER, after: 60 }),
    para("Rumah Qur'an LHI", { bold: true, size: 40, color: NAVY, align: AlignmentType.CENTER, after: 60 }),
    para("Membumikan Al-Qur'an, Menanamkan Adab, Membangun Peradaban", { italics: true, size: 20, color: KETERANGAN, align: AlignmentType.CENTER, after: 1400 }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: EMAS, space: 6 } },
      children: [teks('EXECUTIVE MANAGEMENT REPORT', { bold: true, size: 44, color: NAVY })],
    }),
    para(`Periode: ${bulan}`, { size: 26, color: NAVY2, align: AlignmentType.CENTER, after: 1000 }),
    new Table({
      width: { size: LEBAR, type: WidthType.DXA },
      columnWidths: lebar,
      borders: tepi,
      rows: baris.map(([a, b], r) => new TableRow({
        children: [a, b].map((isi, i) => new TableCell({
          width: { size: lebar[i], type: WidthType.DXA },
          shading: i === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : r % 2 ? { type: ShadingType.CLEAR, color: 'auto', fill: ABU_SELANG } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [teks(isi, { bold: true, size: 20, color: i === 0 ? 'FFFFFF' : '000000' })] })],
        })),
      })),
    }),
    jarak(1600),
    para("— Membumikan Al-Qur'an, Menanamkan Adab, Membangun Peradaban —", { italics: true, size: 18, color: KETERANGAN, align: AlignmentType.CENTER }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

export async function buatDocxKeuangan(p: ReportSheetProps, grafik: PetaGrafik): Promise<Blob> {
  const { period, nextPeriod, notes, draf, income, expense, budgetIncome, budgetExpense, trust, trend, kpi, plans, incomeAccounts } = p
  const bulan = formatPeriod(period)
  const akhir = lastDayOf(period)
  const balance = income.total - expense.total
  const ket = (kind: 'pemasukan' | 'pengeluaran', slug: string) => notes[`ket_${kind}_${slug}`]?.trim() || '-'
  // Sama dengan NarrativeEditor: narasi tersimpan menang, kosong = draf otomatis.
  const narasi = (s: BagianNarasi) => (notes[s] || draf[s] || '').split('\n').map(x => x.trim()).filter(Boolean)
  const rentang = trend.length ? `${monthName(trend[0].period)} – ${monthName(trend[trend.length - 1].period)} ${period.slice(0, 4)}` : bulan
  const sumberAktif = incomeAccounts.filter(a => budgetExpense.rows.some(r => (r.funding[a.slug] ?? 0) > 0))
  const belumTerdanai = budgetExpense.rows.reduce((n, r) => n + r.unallocated, 0)
  const singkat = (nama: string) => nama.replace('Subsidi Yayasan', 'Subsidi YYS')
  let nomorDiagram = 0
  const diagram = (kunci: string, judul: string) => gambar(grafik[kunci], `Diagram ${++nomorDiagram}. ${judul}`)

  const isi: Blok[] = [...sampul(bulan, akhir)]

  isi.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [teks('01  LAPORAN KEUANGAN')] }))
  isi.push(para(`Financial Performance Report — ${bulan}`, { italics: true, size: 19, color: KETERANGAN, after: 200 }))

  // 1.1
  isi.push(h1('1.1', `Ringkasan Keuangan Bulan ${bulan}`))
  const lebar3 = Math.floor(LEBAR / 3)
  const stat = (angka: string, label: string, catatan: string, warna: string) => new TableCell({
    width: { size: lebar3, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: warna },
    margins: { top: 160, bottom: 160, left: 120, right: 120 },
    children: [
      para(angka, { bold: true, size: 32, color: 'FFFFFF', align: AlignmentType.CENTER, after: 40 }),
      para(label, { bold: true, size: 18, color: 'FFFFFF', align: AlignmentType.CENTER, after: 40 }),
      para(catatan, { italics: true, size: 16, color: 'FFFFFF', align: AlignmentType.CENTER, after: 0 }),
    ],
  })
  isi.push(new Table({
    width: { size: lebar3 * 3, type: WidthType.DXA },
    columnWidths: [lebar3, lebar3, lebar3],
    borders: { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.SINGLE, size: 24, color: 'FFFFFF' } },
    rows: [new TableRow({ children: [
      stat(formatJuta1(income.total), 'Total Pemasukan', budgetIncome.totalBudget ? `${percentOf(income.total, budgetIncome.totalBudget)}% dari Anggaran` : 'Anggaran belum diisi', 'B8901F'),
      stat(formatJuta1(expense.total), 'Total Pengeluaran', budgetExpense.totalBudget ? `Anggaran: ${formatJuta(budgetExpense.totalBudget)}` : 'Anggaran belum diisi', NAVY2),
      stat(
        balance === 0 ? 'BALANCE' : formatJuta1(Math.abs(balance)),
        'Surplus / Defisit',
        balance === 0 ? 'Pengeluaran = Pemasukan' : balance > 0 ? 'Pemasukan > Pengeluaran' : 'Pengeluaran > Pemasukan',
        balance < 0 ? MERAH : '2A7D65',
      ),
    ] })],
  }))
  isi.push(jarak(200))
  isi.push(...kotak(`Sorotan Utama ${bulan}`, narasi('sorotan'), 'hijau'))

  // 1.2
  isi.push(h1('1.2', 'Pemasukan'))
  isi.push(h2('1.2.1', 'Tabel Pemasukan'))
  isi.push(...tabelArus(income.rows, income.total, 'Sumber Pemasukan', 'TOTAL PEMASUKAN', s => ket('pemasukan', s)))
  isi.push(h2('1.2.2', 'Diagram Pemasukan'))
  isi.push(...diagram('1.2.2', `Komposisi Pemasukan ${bulan}`))
  isi.push(...prosa(narasi('catatan_pemasukan')))

  // 1.3
  isi.push(h1('1.3', 'Pengeluaran'))
  isi.push(h2('1.3.1', 'Tabel Pengeluaran'))
  isi.push(...tabelArus(expense.rows, expense.total, 'Sumber Pengeluaran', 'TOTAL PENGELUARAN', s => ket('pengeluaran', s)))
  isi.push(h2('1.3.2', 'Diagram Pengeluaran'))
  isi.push(...diagram('1.3.2', `Komposisi Pengeluaran ${bulan}`))
  isi.push(...prosa(narasi('catatan_pengeluaran')))

  // 1.4
  isi.push(h1('1.4', 'Dana Titipan'))
  isi.push(new Paragraph({ spacing: { after: 120 }, children: [teks('Dana titipan '), teks('dicatat terpisah', { bold: true }), teks(' dari arus kas operasional.')] }))
  trust.forEach((fund, i) => {
    isi.push(h2(`1.4.${i + 1}`, fund.name))
    isi.push(...tabel(
      [{ judul: 'Keterangan', lebar: 75 }, { judul: 'Jumlah (Rp)', lebar: 25, rata: 'kanan' }],
      [
        { sel: [`Saldo Awal ${tgl(`${period}-01`)}`, formatAngka(fund.opening)], tebal: true },
        ...(fund.entries.length === 0
          ? [{ sel: [`Tidak ada transaksi pada bulan ${bulan}.`, '0'] }]
          : fund.entries.map(e => ({ sel: [`(${e.amount < 0 ? '-' : '+'}) ${e.description}`, e.amount < 0 ? `(${formatAngka(-e.amount)})` : formatAngka(e.amount)] }))),
        { sel: [`Saldo Akhir ${tgl(akhir)}`, formatAngka(fund.closing)], total: true },
      ],
    ))
  })
  if (trust.length > 0) isi.push(...kotak('Catatan Dana Titipan', narasi('catatan_titipan'), 'biru'))

  // 1.5
  isi.push(h1('1.5', 'Anggaran VS Realisasi'))
  isi.push(h2('1.5.1', 'Anggaran VS Realisasi Pemasukan'))
  isi.push(...tabelAnggaran(budgetIncome.rows, 'Sumber Pemasukan', budgetIncome.totalBudget, budgetIncome.totalActual))
  isi.push(h2('1.5.2', 'Anggaran VS Realisasi Pengeluaran'))
  isi.push(...tabelAnggaran(budgetExpense.rows, 'Sumber Pengeluaran', budgetExpense.totalBudget, budgetExpense.totalActual))
  isi.push(h2('1.5.3', 'Sumber Dana Pengeluaran'))
  {
    const kolomDana: Kolom[] = [
      { judul: 'Sumber Pengeluaran', lebar: 30 },
      ...sumberAktif.map(s => ({ judul: singkat(s.name), lebar: 14, rata: 'kanan' as const })),
      ...(belumTerdanai > 0 ? [{ judul: 'Belum terdanai', lebar: 14, rata: 'kanan' as const }] : []),
    ]
    isi.push(...tabel(kolomDana, [
      ...budgetExpense.rows.map(r => ({
        sel: [
          r.name,
          ...sumberAktif.map(s => (r.funding[s.slug] ? formatAngka(r.funding[s.slug]) : '-')),
          ...(belumTerdanai > 0 ? [r.unallocated ? formatAngka(r.unallocated) : '-'] : []),
        ],
      })),
      {
        sel: [
          'TOTAL',
          ...sumberAktif.map(s => formatAngka(budgetExpense.rows.reduce((n, r) => n + (r.funding[s.slug] ?? 0), 0))),
          ...(belumTerdanai > 0 ? [formatAngka(belumTerdanai)] : []),
        ],
        total: true,
      },
    ]))
  }
  if (belumTerdanai > 0) {
    isi.push(para(`Rp${formatAngka(belumTerdanai)} pengeluaran tidak tertutup pemasukan bulan ini — laporan belum balance. Periksa angka Subsidi Yayasan di Isian Bulanan.`, { bold: true, color: MERAH }))
  }
  isi.push(...kotak(`Evaluasi Anggaran ${bulan}`, narasi('evaluasi_anggaran'), 'emas'))

  // 1.6
  isi.push(h1('1.6', `Analisis Keuangan Key Performance Indicator (KPI) — ${bulan}`))
  isi.push(...tabel(
    [{ judul: 'Indikator', lebar: 30 }, { judul: 'Nilai', lebar: 14, rata: 'kanan' }, { judul: 'Keterangan', lebar: 38 }, { judul: 'Status', lebar: 18, rata: 'tengah' }],
    kpi.map(m => ({ sel: [m.label, m.display, m.note, KPI_STATUS_LABEL[m.status]], tebal: m.tebal, warna: [undefined, undefined, undefined, BADGE[m.status]] })),
  ))
  isi.push(...kotak('Ringkasan KPI', narasi('ringkasan_kpi'), 'hijau'))

  // 1.7
  isi.push(h1('1.7', `Tren Bulanan ${rentang} (Detail Breakdown)`))
  if (trend.length === 0) {
    isi.push(para('Belum ada isian bulan ini.'))
  } else {
    const k = (judul: string): Kolom => ({ judul, lebar: 15, rata: 'kanan' })
    const baris: Baris[] = trend.map(t => ({
      sel: [monthName(t.period), formatAngka(t.income), formatAngka(t.mandiri), formatAngka(t.subsidi), persenId(t.subsidiPercent), persenId(t.kemandirian)],
    }))
    if (trend.length > 1) {
      const inc = trend.reduce((n, t) => n + t.income, 0), man = trend.reduce((n, t) => n + t.mandiri, 0), sub = trend.reduce((n, t) => n + t.subsidi, 0)
      baris.push({ sel: ['TOTAL / RATA-RATA', formatAngka(inc), formatAngka(man), formatAngka(sub), persenId(percentOf1(sub, inc)), persenId(percentOf1(man, inc))], total: true })
    }
    isi.push(...tabel([{ judul: 'Bulan', lebar: 22 }, k('Total Pemasukan'), k('Pendapatan Mandiri'), k('Subsidi Yayasan'), k('% Subsidi'), k('Kemandirian')], baris))
  }
  isi.push(...prosa(narasi('analisis_tren')))

  // 1.8
  isi.push(h1('1.8', `Diagram Tren ${rentang}`))
  const grafikTren: [string, string, BagianNarasi][] = [
    ['1.8.1', 'Komposisi Pemasukan per Bulan', 'analisis_komposisi'],
    ['1.8.2', 'Mandiri vs Subsidi', 'analisis_mandiri'],
    ['1.8.3', 'Tren Pemasukan per Sumber', 'analisis_sumber'],
    ['1.8.4', 'Komposisi Pengeluaran per Bulan', 'analisis_pengeluaran_tren'],
    ['1.8.5', 'Tren KPI Kemandirian', 'analisis_kpi_tren'],
  ]
  for (const [no, judul, bagian] of grafikTren) {
    isi.push(h2(no, judul))
    isi.push(...diagram(no, judul))
    isi.push(...prosa(narasi(bagian), 'Analisis:'))
  }

  // 1.9
  isi.push(h1('1.9', `Rencana Pengeluaran Program ${formatPeriod(nextPeriod)}`))
  if (plans.length === 0) {
    isi.push(para(`Bulan ${monthName(nextPeriod)} tidak ada rencana program khusus.`))
  } else {
    isi.push(...tabel(
      [{ judul: 'Program', lebar: 50 }, { judul: 'Sumber Dana', lebar: 28 }, { judul: 'Jumlah (Rp)', lebar: 22, rata: 'kanan' }],
      [
        ...plans.map(pl => ({ sel: [pl.name, pl.funding_source || '-', formatAngka(pl.amount)] })),
        { sel: ['TOTAL PROGRAM', '', formatAngka(plans.reduce((n, pl) => n + pl.amount, 0))], total: true },
      ],
    ))
  }

  isi.push(jarak(400))
  isi.push(para(`© Yayasan Pionir Pendidikan Indonesia | Rumah Qur'an LHI — Laporan Keuangan ${bulan}`, { size: 16, color: KETERANGAN, align: AlignmentType.CENTER }))

  const doc = new Document({
    creator: "Rumah Qur'an LHI",
    title: `Laporan Keuangan ${bulan}`,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 21 }, paragraph: { spacing: { after: 160 } } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, color: NAVY },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: EMAS, space: 4 } } },
        },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: NAVY }, paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: NAVY2 }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: {
      config: [{ reference: 'butir', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: isi,
    }],
  })
  return Packer.toBlob(doc)
}
