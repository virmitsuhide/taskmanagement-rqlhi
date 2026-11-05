'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReportSheetProps } from '@/app/keuangan/laporan/ReportSheet'
import type { GambarGrafik, PetaGrafik } from '@/lib/finance/docx'

/** Lebar piksel PNG grafik — ~3× ukuran SVG, tetap tajam saat dicetak di Word. */
const LEBAR_PNG = 1860

/** SVG yang tampil di layar → PNG, lewat <img> + canvas (font = font browser). */
async function svgKePng(svg: SVGSVGElement): Promise<GambarGrafik | undefined> {
  const vb = svg.viewBox.baseVal
  if (!vb || !vb.width) return undefined
  const salin = svg.cloneNode(true) as SVGSVGElement
  salin.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  salin.setAttribute('width', String(vb.width))
  salin.setAttribute('height', String(vb.height))
  salin.removeAttribute('style')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(salin)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((ok, gagal) => { img.onload = () => ok(); img.onerror = () => gagal(new Error('svg')); img.src = url })
    const skala = LEBAR_PNG / vb.width
    const canvas = document.createElement('canvas')
    canvas.width = LEBAR_PNG
    canvas.height = Math.round(vb.height * skala)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/png'))
    if (!blob) return undefined
    return { data: new Uint8Array(await blob.arrayBuffer()), lebar: canvas.width, tinggi: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Unduh Laporan BPH sebagai .docx. Grafik diambil dari pembungkus
 * [data-docx-grafik] di ReportSheet; pustaka docx dimuat saat diklik saja.
 */
export function DocxButton(props: ReportSheetProps) {
  const [pending, setPending] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function unduh() {
    setPending(true)
    setGalat(null)
    try {
      const grafik: PetaGrafik = {}
      for (const el of document.querySelectorAll<HTMLElement>('[data-docx-grafik]')) {
        const svg = el.querySelector('svg')
        if (svg) grafik[el.dataset.docxGrafik!] = await svgKePng(svg)
      }
      const { buatDocxKeuangan } = await import('@/lib/finance/docx')
      const blob = await buatDocxKeuangan(props, grafik)
      const [th, bl] = props.period.split('-')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Bab01_Keuangan_${th}-${bl}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (e) {
      console.error(e)
      setGalat('Gagal membuat .docx. Coba lagi.')
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="flex items-center gap-2 print:hidden">
      <Button size="sm" variant="outline" className="h-8" onClick={unduh} disabled={pending}>
        <FileDown className="mr-1 h-3.5 w-3.5" />{pending ? 'Menyusun…' : 'Unduh .docx'}
      </Button>
      {galat && <span className="text-xs text-destructive">{galat}</span>}
    </span>
  )
}
