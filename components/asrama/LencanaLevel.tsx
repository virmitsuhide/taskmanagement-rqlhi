import { cn } from '@/lib/utils'
import { LABEL_LEVEL, WARNA_LEVEL, type LevelAsrama } from '@/lib/rq/asrama'

/**
 * Lencana level anak boarding (High / Middle / Low / Spesial). Tidak tampil
 * apa pun untuk anak tanpa level — kebanyakan siswa memang bukan anak asrama.
 */
export function LencanaLevel({ level, className }: { level: LevelAsrama | null | undefined; className?: string }) {
  if (!level) return null
  return (
    <span
      title={`Level asrama: ${LABEL_LEVEL[level]}`}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-semibold leading-tight',
        WARNA_LEVEL[level],
        className,
      )}
    >
      {LABEL_LEVEL[level]}
    </span>
  )
}
