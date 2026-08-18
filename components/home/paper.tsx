import { cn } from '@/lib/utils'

/**
 * Permukaan "kertas note" — dipakai halaman detail pengumuman.
 *
 * Warna kertas + garis bergaris seperti buku tulis. Garisnya dipasang lewat
 * custom property --rule supaya satu repeating-linear-gradient bisa dipakai di
 * tema terang maupun gelap.
 */
export const PAPER_SURFACE = cn(
  'bg-[#fdfaf1] text-[#2c2a24] [--rule:rgba(44,42,36,0.07)] [--margin:rgba(224,122,45,0.35)]',
  'dark:bg-[oklch(0.25_0.015_92)] dark:text-foreground dark:[--rule:rgba(255,255,255,0.06)] dark:[--margin:rgba(224,122,45,0.45)]',
)

/** Overlay garis buku tulis + garis margin di kiri. */
export function PaperRules({ lineHeight = 28 }: { lineHeight?: number }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineHeight - 1}px, var(--rule) ${lineHeight - 1}px, var(--rule) ${lineHeight}px)`,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-7 w-px"
        style={{ background: 'var(--margin)' }}
      />
    </>
  )
}
