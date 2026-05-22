'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden"
    >
      <Printer className="h-3 w-3" />Cetak
    </button>
  )
}
