import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import sharp from 'sharp'
import type { LaporanModel, TabelModel } from './susun'

/**
 * Bab 02 sebagai .docx — siap ditempel ke berkas Laporan Eksekutif gabungan.
 * Isi diambil dari LaporanModel yang sama dengan halaman pratinjau.
 */

const TEAL = '1E5A51'
const WASH = 'E8F0EE'
const GARIS = 'C9D6D2'
// A4 dengan margin 2 cm: 11906 − 2 × 1134 = 9638 DXA.
const LEBAR = 9638

const teks = (t: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text: t, bold: o.bold, size: o.size, color: o.color, italics: o.italics })

function para(t: string, o: { bold?: boolean; size?: number; after?: number; italics?: boolean; color?: string } = {}) {
  return new Paragraph({ spacing: { after: o.after ?? 120 }, children: [teks(t, o)] })
}

function butir(t: string) {
  return new Paragraph({ numbering: { reference: 'butir', level: 0 }, spacing: { after: 60 }, children: [teks(t)] })
}

const garis = { style: BorderStyle.SINGLE, size: 4, color: GARIS }
const tepi = { top: garis, bottom: garis, left: garis, right: garis, insideHorizontal: garis, insideVertical: garis }

function tabel(t: TabelModel): (Paragraph | Table)[] {
  const n = t.header.length
  // Kolom pertama (nama kelas/unit/guru) lebih lebar; sisanya dibagi rata.
  const pertama = n > 8 ? 1150 : n > 5 ? 2000 : 2600
  const sisa = Math.floor((LEBAR - pertama) / (n - 1))
  const lebar = [pertama, ...Array(n - 1).fill(sisa)]
  lebar[n - 1] += LEBAR - lebar.reduce((a, b) => a + b, 0)
  const ukuran = n > 12 ? 14 : n > 8 ? 16 : 18

  const sel = (isi: string, i: number, o: { kepala?: boolean; tebal?: boolean }) => new TableCell({
    width: { size: lebar[i], type: WidthType.DXA },
    shading: o.kepala ? { type: ShadingType.CLEAR, color: 'auto', fill: TEAL } : o.tebal ? { type: ShadingType.CLEAR, color: 'auto', fill: WASH } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [teks(isi, { bold: o.kepala || o.tebal, size: ukuran, color: o.kepala ? 'FFFFFF' : undefined })],
    })],
  })

  const hasil: (Paragraph | Table)[] = []
  if (t.judul) hasil.push(para(t.judul, { bold: true, size: 20, after: 80 }))
  hasil.push(new Table({
    width: { size: LEBAR, type: WidthType.DXA },
    columnWidths: lebar,
    borders: tepi,
    rows: [
      new TableRow({ tableHeader: true, children: t.header.map((h, i) => sel(h, i, { kepala: true })) }),
      ...t.baris.map((b, r) => new TableRow({
        children: b.map((c, i) => sel(c, i, { tebal: !!t.adaTotal && r === t.baris.length - 1 })),
      })),
    ],
  }))
  if (t.catatan) hasil.push(para(t.catatan, { size: 16, italics: true, after: 60 }))
  hasil.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
  return hasil
}

async function gambar(svg: string, keterangan: string): Promise<Paragraph[]> {
  const png = await sharp(Buffer.from(svg.replaceAll('currentColor', '#1f2a28')), { density: 200 }).png().toBuffer()
  const meta = await sharp(png).metadata()
  const w = 600
  const h = Math.round(((meta.height ?? 300) / (meta.width ?? 600)) * w)
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: png, transformation: { width: w, height: h } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [teks(keterangan, { italics: true, size: 18 })] }),
  ]
}

function kotakAnalisis(a: { analisis: string; masalah: string; rekomendasi: string }): (Paragraph | Table)[] {
  const baris = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  const isi: Paragraph[] = [para('ANALISIS & REKOMENDASI', { bold: true, color: TEAL, after: 80 })]
  if (a.analisis.trim()) isi.push(new Paragraph({ spacing: { after: 100 }, children: [teks('Analisis: ', { bold: true }), teks(a.analisis.trim())] }))
  if (baris(a.masalah).length) { isi.push(para('Identifikasi Masalah', { bold: true, after: 60 })); isi.push(...baris(a.masalah).map(butir)) }
  if (baris(a.rekomendasi).length) { isi.push(para('Rekomendasi Tindak Lanjut', { bold: true, after: 60 })); isi.push(...baris(a.rekomendasi).map(butir)) }
  if (isi.length === 1) return []
  return [
    new Table({
      width: { size: LEBAR, type: WidthType.DXA },
      columnWidths: [LEBAR],
      borders: { top: garis, bottom: garis, left: { style: BorderStyle.SINGLE, size: 24, color: TEAL }, right: garis, insideHorizontal: garis, insideVertical: garis },
      rows: [new TableRow({ children: [new TableCell({
        width: { size: LEBAR, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: WASH },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: isi,
      })] })],
    }),
    new Paragraph({ spacing: { after: 240 }, children: [] }),
  ]
}

export async function buatDocx(m: LaporanModel): Promise<Buffer> {
  const isi: (Paragraph | Table)[] = []
  let nomorDiagram = 0

  isi.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [teks(m.judulBab)] }))
  isi.push(para(m.subjudul, { italics: true }))
  isi.push(para(m.acuan, { size: 18, color: '555555' }))

  isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [teks('Ringkasan Eksekutif')] }))
  isi.push(...tabel({ header: m.kpi.map(k => k.label), baris: [m.kpi.map(k => k.nilai), m.kpi.map(k => k.keterangan)] }))
  if (m.sorotan.length) { isi.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [teks('Sorotan Capaian')] })); isi.push(...m.sorotan.map(butir)) }
  if (m.perhatian.length) { isi.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [teks('Perhatian Utama')] })); isi.push(...m.perhatian.map(butir)) }

  for (const s of m.sub) {
    if (s.induk) isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [teks(s.induk)] }))
    const tingkat = s.nomor.split('.').length > 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2
    isi.push(new Paragraph({ heading: tingkat, children: [teks(`${s.nomor}  ${s.judul}`)] }))
    if (s.pengantar) isi.push(para(s.pengantar))
    for (const t of s.tabel) isi.push(...tabel(t))
    for (const g of s.grafik) isi.push(...await gambar(g.svg, `Diagram ${++nomorDiagram}. ${g.judul}`))
    isi.push(...kotakAnalisis(s.analisis))
  }

  isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [teks('2.9  Identifikasi Masalah & Rekomendasi Tindak Lanjut')] }))
  if (m.masalah.length) {
    isi.push(...tabel({
      header: ['No', 'Area Fokus', 'Masalah Utama', 'Rekomendasi Tindak Lanjut', 'Prioritas'],
      baris: m.masalah.map((r, i) => [String(i + 1), r.area, r.masalah, r.rekomendasi, r.prioritas]),
    }))
  } else {
    isi.push(para('Tidak ada masalah yang dicatat bulan ini.', { italics: true }))
  }

  if (m.kesimpulan.length) {
    isi.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [teks('Kesimpulan')] }))
    isi.push(...m.kesimpulan.map(k => para(k)))
  }

  const doc = new Document({
    creator: "Rumah Qur'an LHI",
    title: m.subjudul,
    styles: {
      default: { document: { run: { font: 'Arial', size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: TEAL }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: TEAL }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
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
  return Packer.toBuffer(doc)
}
