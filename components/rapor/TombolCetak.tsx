'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Cetak lembar rapor menjadi PDF lewat dialog cetak peramban ("Simpan sebagai
 * PDF"), sama seperti rapor KPI dan Laporan Orang Tua — tanpa pustaka PDF.
 *
 * Judul dokumen diganti sementara karena peramban memakainya sebagai nama
 * berkas PDF-nya; tanpa itu, guru mendapat berkas bernama "Rapor Qur'an |
 * RQ LHI" untuk seluruh sesinya.
 */
export function TombolCetak({ namaBerkas, label = 'Cetak / simpan PDF' }: {
  namaBerkas: string
  label?: string
}) {
  function cetak() {
    const judulAsli = document.title
    document.title = namaBerkas
    const pulihkan = () => {
      document.title = judulAsli
      window.removeEventListener('afterprint', pulihkan)
    }
    window.addEventListener('afterprint', pulihkan)
    window.print()
  }

  return (
    <Button type="button" onClick={cetak}>
      <Printer /> {label}
    </Button>
  )
}
