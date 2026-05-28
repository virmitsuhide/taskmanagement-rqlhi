'use client'

import { useState } from 'react'

const RATING_LABELS = ['', 'Kurang', 'Cukup', 'Baik', 'Bagus', 'Sangat Bagus']

interface Props {
  name: string
  defaultValue?: number
  /** warna aktif; default emas RQ */
  accent?: string
}

/**
 * Star rating 1-5 untuk penilaian setoran (makhraj/tajwid/kelancaran).
 * Menulis nilai ke hidden input `name` agar terbawa di FormData.
 * Klik bintang yang sama untuk reset ke 0 (tidak menilai).
 */
export function StarRating({ name, defaultValue = 0, accent = 'var(--primary)' }: Props) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div>
      <input type="hidden" name={name} value={value || ''} />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n === value ? 0 : n)}
            className="w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors"
            style={n <= value
              ? { background: accent, borderColor: accent, color: 'white' }
              : { background: 'white', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            aria-label={`${n} bintang`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 h-3.5">{RATING_LABELS[value]}</p>
    </div>
  )
}
