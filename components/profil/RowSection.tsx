'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Kerangka seksi daftar yang bisa ditambah & dihapus barisnya.
 *
 * Diangkat keluar dari PengurusProfileForm supaya form profil guru memakai
 * kerangka yang sama persis, bukan salinannya. Dua salinan tata letak yang
 * seharusnya identik akan menyimpang pada perbaikan pertama yang hanya
 * diterapkan di salah satunya — dan yang paling mungkin menyimpang di sini
 * adalah tombol hapus, satu-satunya bagian yang menghancurkan isian orang.
 */

/**
 * Dua tampilan seksi.
 *
 * "plain" — judul telanjang di atas daftarnya, seperti form profil pengurus.
 * "card"  — dibungkus kartu berlatar terang dengan kepala bertint, supaya batas
 *           antar seksi tetap terbaca di halaman berlatar abu. Dipakai form
 *           profil guru, yang seksinya dua kali lebih banyak sehingga tanpa
 *           batas yang tegas semuanya melebur jadi satu kolom panjang.
 */
export function RowSection({
  title, desc, onAdd, children, variant = 'plain',
}: {
  title: string
  desc?: string
  onAdd: () => void
  children: React.ReactNode
  variant?: 'plain' | 'card'
}) {
  const kepala = (
    <>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {desc && <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAdd} className="shrink-0">
        <Plus className="mr-1 h-3.5 w-3.5" />Tambah
      </Button>
    </>
  )

  if (variant === 'card') {
    return (
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          {kepala}
        </div>
        <div className="space-y-2 p-4">{children}</div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">{kepala}</div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function RowShell({
  onRemove, children,
}: {
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        aria-label="Hapus baris"
        className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
