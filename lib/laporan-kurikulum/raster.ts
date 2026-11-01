import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

/**
 * SVG grafik laporan → PNG untuk .docx.
 *
 * Dulu lewat sharp (librsvg), yang mencari font lewat fontconfig sistem.
 * Server produksi (Linux tanpa font) tidak punya satu pun, jadi semua teks
 * grafik — judul, label kelas, angka, legenda — hilang/jadi kotak di Word,
 * padahal di komputer Windows tampak benar. Sekarang fontnya ikut repo
 * (Plus Jakarta Sans, OFL, sama dengan font aplikasi) dan font sistem
 * sengaja TIDAK dibaca, supaya hasil lokal dan produksi identik.
 *
 * Berkas font ikut dibundel lewat outputFileTracingIncludes di next.config.
 */
const FONT = ['PlusJakartaSans-Regular.ttf', 'PlusJakartaSans-SemiBold.ttf']
  .map(f => path.join(process.cwd(), 'lib', 'laporan-kurikulum', 'font', f))

/** Lebar piksel hasil: 680 satuan SVG × ~2,8 — tajam saat dicetak di Word. */
const LEBAR_PNG = 1900

export function svgKePng(svg: string): { png: Buffer; lebar: number; tinggi: number } {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: LEBAR_PNG },
    background: '#ffffff',
    font: { loadSystemFonts: false, fontFiles: FONT, defaultFontFamily: 'Plus Jakarta Sans', sansSerifFamily: 'Plus Jakarta Sans' },
  })
  const img = r.render()
  return { png: img.asPng(), lebar: img.width, tinggi: img.height }
}
