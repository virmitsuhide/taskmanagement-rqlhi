'use client'

import { FileText } from 'lucide-react'

/** Cetak / simpan PDF lewat dialog cetak peramban. Disembunyikan saat mencetak. */
export function TombolCetak() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border bg-card text-sm font-bold hover:bg-muted print:hidden"
      style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
    >
      <FileText className="h-4 w-4" /> Cetak / simpan PDF
    </button>
  )
}
