import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { stripMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { PublicPost } from '@/types'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 3 * 86_400_000
}

/**
 * Kelas permukaan "kertas note": warna kertas + garis-garis bergaris seperti
 * buku tulis. Garisnya dipasang lewat custom property --rule supaya satu
 * repeating-linear-gradient bisa dipakai di tema terang maupun gelap.
 */
export const PAPER_SURFACE = cn(
  'bg-[#fdfaf1] text-[#2c2a24] [--rule:rgba(44,42,36,0.07)] [--margin:rgba(224,122,45,0.35)]',
  'dark:bg-[oklch(0.25_0.015_92)] dark:text-foreground dark:[--rule:rgba(255,255,255,0.06)] dark:[--margin:rgba(224,122,45,0.45)]',
)

/** Overlay garis buku tulis + garis margin merah di kiri. */
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

/** Selotip kecil di tepi atas — penanda visual bahwa ini "kertas tertempel". */
function Tape() {
  return (
    <span
      aria-hidden
      className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 rounded-[2px] bg-accent-warm/25 backdrop-blur-[1px]"
    />
  )
}

interface Props {
  post: PublicPost
  /** Label kategori kecil di atas judul. */
  kicker?: string
}

export function NotePaperCard({ post, kicker }: Props) {
  const excerpt = stripMarkdown(post.content)
  const fresh = isNew(post.created_at)
  const overdue = post.due_date ? new Date(post.due_date) < new Date() : false

  return (
    <article
      className={cn(
        'group relative rounded-sm border border-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_20px_-12px_rgba(0,0,0,0.25)]',
        'transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_14px_28px_-14px_rgba(0,0,0,0.3)]',
        'dark:border-white/10',
        PAPER_SURFACE,
      )}
    >
      <PaperRules />
      <Tape />

      <div className="relative pl-11 pr-5 py-5">
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          {kicker && (
            <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-accent-warm">
              {kicker}
            </span>
          )}
          {fresh && (
            <span className="rounded-full bg-accent-warm/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-warm">
              Baru
            </span>
          )}
          {overdue && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
              Lewat tenggat
            </span>
          )}
        </div>

        {/* Judul = tautan ke halaman detail berisi isi lengkap */}
        <h3 className="text-base font-semibold leading-snug" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
          <Link
            href={`/pengumuman/${post.id}`}
            className="after:absolute after:inset-0 hover:underline decoration-accent-warm underline-offset-4"
          >
            {post.title}
          </Link>
        </h3>

        <p className="mt-1.5 line-clamp-3 text-sm leading-[28px] opacity-80">
          {excerpt}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] opacity-70">
          <span>
            {post.creator ? `oleh ${post.creator.display_name} · ` : ''}
            {formatDate(post.created_at)}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </article>
  )
}
