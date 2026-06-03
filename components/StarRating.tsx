'use client'

import { useState } from 'react'
import { Star, StarHalf } from 'lucide-react'

const RATING_LABELS = ['', 'Kurang', 'Cukup', 'Baik', 'Bagus', 'Sangat Bagus']

interface Props {
  name: string
  defaultValue?: number
  /** warna aktif; default emas */
  accent?: string
  size?: number
}

/**
 * Penilaian bintang 0.5–5 (setengah bintang) untuk setoran (Fashohah/Tajwid/
 * Kelancaran). Klik separuh kiri bintang = .5, separuh kanan = penuh.
 * Klik nilai yang sama → reset (tidak menilai). Nilai ditulis ke hidden input.
 */
export function StarRating({ name, defaultValue = 0, accent = '#f59e0b', size = 30 }: Props) {
  const [value, setValue] = useState(defaultValue)
  const [hover, setHover] = useState(0)
  const shown = hover || value

  const setOrClear = (v: number) => setValue(prev => (prev === v ? 0 : v))

  return (
    <div>
      <input type="hidden" name={name} value={value || ''} />
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => {
          const fill = shown >= n ? 'full' : shown >= n - 0.5 ? 'half' : 'none'
          return (
            <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
              <Star className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke="#d1d5db" fill="transparent" />
              {fill === 'full' && <Star className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke={accent} fill={accent} />}
              {fill === 'half' && <StarHalf className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke={accent} fill={accent} />}
              <button
                type="button" aria-label={`${n - 0.5} bintang`}
                className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(n - 0.5)} onClick={() => setOrClear(n - 0.5)}
              />
              <button
                type="button" aria-label={`${n} bintang`}
                className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(n)} onClick={() => setOrClear(n)}
              />
            </span>
          )
        })}
        <span className="ml-2 text-sm font-semibold tabular-nums" style={{ color: value ? accent : 'var(--muted-foreground)' }}>
          {value ? value.toFixed(1) : '—'}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 h-3.5">{RATING_LABELS[Math.round(value)] ?? ''}</p>
    </div>
  )
}
