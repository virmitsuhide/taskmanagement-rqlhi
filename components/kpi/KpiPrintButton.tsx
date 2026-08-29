'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Tombol unduh rapor.
 *
 * KENAPA window.print(), BUKAN PUSTAKA PDF
 *
 * Dua jalur yang mungkin: merender ulang halaman ini ke PDF lewat pustaka
 * (jsPDF + html2canvas), atau menyerahkannya ke mesin cetak peramban yang
 * memang sudah punya tujuan "Simpan sebagai PDF".
 *
 * Jalur pustaka menempuh canvas: hasilnya gambar raster, sehingga teks rapor
 * tidak bisa disorot atau dicari, dan garis grafik radar pecah begitu dicetak
 * di atas kertas. Ia juga menggandakan tata letak — apa yang tampil di layar
 * dan apa yang masuk PDF dihasilkan dua mesin berbeda, dan keduanya akan
 * menyimpang seiring lembar ini disunting.
 *
 * Mesin cetak peramban memakai tata letak yang sama persis dengan yang sedang
 * dilihat, menghasilkan teks vektor yang tajam di 300 dpi, dan @page di
 * globals.css sudah mengunci ukurannya ke A4 potret. Satu-satunya biayanya:
 * penggunanya memilih "Simpan sebagai PDF" di kotak dialog — dan itu kami
 * sebutkan langsung di bawah tombolnya.
 */
export function KpiPrintButton({ nama }: { nama: string }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => window.print()}
      title={`Unduh rapor KPI ${nama} sebagai PDF`}
    >
      <Download className="mr-1 h-4 w-4" />Unduh PDF
    </Button>
  )
}
