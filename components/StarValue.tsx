import { Star, StarHalf } from 'lucide-react'

interface Props {
  /** nilai 0–5 (boleh .5). null/undefined → semua bintang kosong. */
  value: number | string | null | undefined
  size?: number
  accent?: string
  showNumber?: boolean
}

/**
 * Tampilan bintang read-only (mendukung setengah bintang). Aman dipakai di
 * server component. `value` di-coerce karena Postgres numeric bisa datang
 * sebagai string lewat PostgREST.
 */
export function StarValue({ value, size = 16, accent = '#f59e0b', showNumber = true }: Props) {
  const num = value == null ? null : Number(value)
  const v = num != null && !Number.isNaN(num) ? num : 0
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map(n => {
        const fill = v >= n ? 'full' : v >= n - 0.5 ? 'half' : 'none'
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke="#d1d5db" fill="transparent" />
            {fill === 'full' && <Star className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke={accent} fill={accent} />}
            {fill === 'half' && <StarHalf className="absolute inset-0" width={size} height={size} strokeWidth={1.5} stroke={accent} fill={accent} />}
          </span>
        )
      })}
      {showNumber && (
        <span className="ml-1 text-xs font-medium tabular-nums text-muted-foreground">
          {v ? v.toFixed(1) : '—'}
        </span>
      )}
    </span>
  )
}
