'use client'

import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Isian angka dengan tombol ◀ ▶ — untuk guru yang mengisi setoran dari HP.
 *
 * Mengetik angka di ponsel berarti membuka papan ketik, menghapus, mengetik,
 * menutup — belasan kali per sesi. Padahal setoran hampir selalu "posisi
 * kemarin" atau "satu-dua lebih jauh". Maka angkanya sudah tampil, dan cukup
 * diketuk ke kanan untuk maju. Kotak angkanya tetap bisa diketik untuk
 * lompatan jauh.
 *
 * `value` kosong berarti "pakai bawaan" — ditampilkan sebagai `bawaan`, dan
 * tombol ◀ ▶ bergerak dari situ. Pola ini sama dengan isian halaman sesi
 * sebelumnya (kosong = posisi anak sekarang), sehingga data yang dikirim
 * tidak berubah maknanya.
 */
interface Props {
  label?: string
  value: string
  onChange: (v: string) => void
  /** Angka yang ditampilkan bila value kosong. */
  bawaan?: number | null
  min?: number
  max?: number
  disabled?: boolean
  /** Keterangan kecil di bawah, mis. "+2 dari posisi". */
  petunjuk?: React.ReactNode
  className?: string
  'aria-label'?: string
}

export function Stepper({ label, value, onChange, bawaan, min = 1, max, disabled, petunjuk, className, ...rest }: Props) {
  const uid = useId()
  const sekarang = value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : bawaan ?? null
  const batas = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n)
  const geser = (d: number) => onChange(String(batas((sekarang ?? min - d) + d)))
  const tombol = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-card text-foreground transition-colors active:bg-muted disabled:opacity-30'

  return (
    <div className={cn('space-y-1', className)}>
      {label && <label className="block text-xs font-medium" htmlFor={`${uid}-n`}>{label}</label>}
      <div className="flex items-center gap-1">
        <button type="button" className={tombol} onClick={() => geser(-1)}
          disabled={disabled || sekarang === null || sekarang <= min} aria-label={`Kurangi ${label ?? ''}`.trim()}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <input
          id={`${uid}-n`}
          type="number" inputMode="numeric" min={min} max={max}
          value={value}
          placeholder={bawaan != null ? String(bawaan) : '—'}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          aria-label={rest['aria-label'] ?? label}
          // Placeholder bawaan dibuat sepekat isian: bagi guru itu memang angkanya.
          className="h-11 w-16 rounded-md border bg-background text-center text-base font-semibold tabular-nums outline-none placeholder:text-foreground focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" className={tombol} onClick={() => geser(1)}
          disabled={disabled || (max !== undefined && sekarang !== null && sekarang >= max)} aria-label={`Tambah ${label ?? ''}`.trim()}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {petunjuk && <p className="text-[11px] text-muted-foreground">{petunjuk}</p>}
    </div>
  )
}
