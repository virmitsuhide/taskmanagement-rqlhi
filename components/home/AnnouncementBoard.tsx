'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, Info, Bell } from 'lucide-react'
import { stripMarkdown } from '@/lib/markdown'
import type { PublicPost, PostPriority } from '@/types'

interface Props {
  /** Pengumuman & tugas guru sudah digabung oleh pemanggil. */
  posts: PublicPost[]
  title?: string
  limit?: number
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Tampilan tiap status prioritas.
 *
 * Warnanya dipilih dari token tema yang sudah ada, bukan warna mentah, supaya
 * ikut menyesuaikan mode terang & gelap tanpa aturan tambahan.
 */
const PRIORITY_META: Record<PostPriority, { label: string; icon: typeof Info; badge: string; iconWrap: string }> = {
  penting: {
    label: 'Penting',
    icon: AlertCircle,
    badge: 'bg-destructive/10 text-destructive',
    iconWrap: 'bg-destructive/10 text-destructive',
  },
  info: {
    label: 'Info',
    icon: Info,
    badge: 'bg-primary-wash text-primary',
    iconWrap: 'bg-primary-wash text-primary',
  },
  pengingat: {
    label: 'Pengingat',
    icon: Bell,
    badge: 'bg-accent-warm-wash text-accent-warm',
    iconWrap: 'bg-accent-warm-wash text-accent-warm',
  },
}

/** Post sebelum migrasi 0017 belum punya priority — anggap 'info'. */
function priorityOf(post: PublicPost): PostPriority {
  return post.priority ?? 'info'
}

function displayDate(post: PublicPost): [string, string, string] {
  const d = new Date(post.due_date ?? post.created_at)
  return [String(d.getDate()), MONTH_SHORT[d.getMonth()], String(d.getFullYear())]
}

export function AnnouncementBoard({ posts, title = 'Pengumuman', limit = 6 }: Props) {
  const [filter, setFilter] = useState<'semua' | 'sd' | 'smp'>('semua')

  const sorted = [...posts].sort(
    (a, b) => new Date(b.due_date ?? b.created_at).getTime() - new Date(a.due_date ?? a.created_at).getTime()
  )
  // Post bertarget 'all' selalu ikut, karena berlaku untuk semua unit.
  const filtered =
    filter === 'semua' ? sorted : sorted.filter(p => p.target === filter || p.target === 'all')
  const shown = filtered.slice(0, limit)

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2
          className="m-0 text-base font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <div className="flex gap-0.5 bg-muted rounded-xl p-1">
          {(['semua', 'sd', 'smp'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                filter === f
                  ? 'bg-foreground text-background font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'semua' ? 'Semua' : f === 'sd' ? 'SDIT LHI' : 'SMPIT LHI'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map(post => {
            const [day, mon, year] = displayDate(post)
            const meta = PRIORITY_META[priorityOf(post)]
            const Icon = meta.icon
            const unit = post.target === 'sd' ? 'SDIT' : post.target === 'smp' ? 'SMPIT' : null

            return (
              <article
                key={post.id}
                className="group relative flex items-start gap-3.5 rounded-xl border bg-background/40 px-3.5 py-3 hover:border-foreground/20 hover:bg-muted/40 transition-colors"
              >
                {/* Ikon prioritas */}
                <span className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg ${meta.iconWrap}`}>
                  <Icon className="h-4 w-4" />
                </span>

                {/* Konten */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.badge}`}>
                      {meta.label}
                    </span>
                    {unit && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-muted text-muted-foreground">
                        {unit}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                    <Link
                      href={`/pengumuman/${post.id}`}
                      className="after:absolute after:inset-0 hover:underline underline-offset-2"
                    >
                      {post.title}
                    </Link>
                  </h3>

                  <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mt-1">
                    {stripMarkdown(post.content)}
                  </p>

                  {post.creator && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      oleh {post.creator.display_name}
                    </p>
                  )}
                </div>

                {/* Tanggal */}
                <div className="shrink-0 text-center min-w-[42px] rounded-lg border bg-card px-2 py-1.5">
                  <div
                    className="text-lg font-bold leading-none text-foreground"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {day}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-[0.6px] mt-0.5">{mon}</div>
                  <div className="text-[9px] text-muted-foreground/70 leading-none">{year}</div>
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 self-center" />
              </article>
            )
          })}
        </div>
      )}

      {filtered.length > shown.length && (
        <Link
          href="/login"
          className="block text-center text-xs text-muted-foreground mt-3.5 hover:text-foreground transition-colors"
        >
          ↓ lihat {filtered.length - shown.length} pengumuman lainnya
        </Link>
      )}
    </>
  )
}
