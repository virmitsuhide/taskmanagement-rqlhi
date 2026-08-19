'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Cetak / simpan PDF laporan. Header, tab, dan tombol sudah `print:hidden`. */
export function PrintButton() {
  return (
    <Button size="sm" variant="outline" className="h-8 print:hidden" onClick={() => window.print()}>
      <Printer className="mr-1 h-3.5 w-3.5" />Cetak
    </Button>
  )
}
