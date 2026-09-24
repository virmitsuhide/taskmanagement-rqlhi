'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * <select> bawaan browser, dibentuk serupa Input shadcn.
 *
 * Sengaja tetap native: daftar medan rapor memakai <optgroup>, dan di HP
 * pemilih bawaan sistem jauh lebih nyaman daripada popover yang harus
 * digulir di dalam layar kecil.
 */
export const SELECT_NATIF =
  'h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'md:h-9 dark:bg-input/30 [&_option]:bg-popover [&_option]:text-popover-foreground [&_optgroup]:bg-popover'

/**
 * Pengganti tampilan <input type="file"> yang teksnya ("Choose File / No file
 * chosen") ikut bahasa browser dan tak bisa diberi warna tema. Inputnya tetap
 * ada (sr-only) sehingga `name`, `required`, dan FormData tetap berjalan.
 */
export function PilihBerkas({
  name, accept, required, disabled, onPilih, ikon, judul, keterangan, className, id,
}: {
  name?: string
  accept: string
  required?: boolean
  disabled?: boolean
  onPilih: (berkas: File | null, input: HTMLInputElement) => void
  ikon: ReactNode
  judul: ReactNode
  keterangan?: ReactNode
  className?: string
  id?: string
}) {
  const auto = useId()
  const inputId = id ?? auto
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input px-3 py-2.5 transition-colors',
        'hover:border-primary/50 hover:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 dark:bg-input/20',
        className,
      )}
    >
      <input
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={e => onPilih(e.target.files?.[0] ?? null, e.target)}
        className="sr-only"
      />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {ikon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{judul}</span>
        {keterangan && <span className="block truncate text-xs text-muted-foreground">{keterangan}</span>}
      </span>
    </label>
  )
}
