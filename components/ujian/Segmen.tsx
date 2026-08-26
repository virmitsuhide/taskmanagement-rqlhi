'use client'

import { cn } from '@/lib/utils'

export interface OpsiSegmen<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  /** Angka kecil di belakang label, mis. jumlah baris pada tab itu. */
  jumlah?: number
}

interface Props<T extends string> {
  label: string
  options: OpsiSegmen<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Pemilih segmented — bentuknya menyalin TabsList/TabsTrigger dari design
 * system: alas `bg-muted`, yang aktif naik jadi `bg-background` bershadow.
 *
 * Ditulis sebagai tombol biasa, bukan memakai komponen Tabs, karena isi di
 * bawahnya bukan panel tab melainkan satu daftar yang disaring — memakai Tabs
 * akan memaksa menduplikasi seluruh daftar untuk tiap nilai.
 */
export function Segmen<T extends string>({ label, options, value, onChange, className }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('inline-flex w-full items-center rounded-lg bg-muted p-[3px]', className)}
    >
      {options.map(opsi => {
        const aktif = opsi.value === value
        return (
          <button
            key={opsi.value}
            type="button"
            role="tab"
            aria-selected={aktif}
            onClick={() => onChange(opsi.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5',
              'text-sm font-medium whitespace-nowrap transition-all',
              aktif
                ? 'bg-background text-foreground shadow-sm dark:bg-input/30'
                : 'text-foreground/60 hover:text-foreground',
            )}
          >
            {opsi.icon}
            {opsi.label}
            {opsi.jumlah !== undefined && (
              <span className="text-xs font-normal text-muted-foreground">({opsi.jumlah})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
