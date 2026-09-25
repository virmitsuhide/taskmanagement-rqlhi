'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AnnouncementCard } from '@/components/home/AnnouncementCard'
import type { PublicPost } from '@/types'

interface Props {
  /** Pengumuman & tugas guru sudah digabung oleh pemanggil. */
  posts: PublicPost[]
  title?: string
  limit?: number
}

export function AnnouncementBoard({ posts, title = 'Pengumuman', limit = 5 }: Props) {
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
          className="m-0 text-[26px] font-normal leading-tight tracking-[-0.01em] text-foreground md:text-[30px]"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          {title}
        </h2>
        <div role="group" aria-label="Saring unit" className="flex gap-0.5 bg-muted rounded-[10px] p-[3px]">
          {(['semua', 'sd', 'smp'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-3.5 py-1.5 rounded-[7px] text-[13px] font-semibold transition-all ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'semua' ? 'Semua' : f === 'sd' ? 'SDIT LHI' : 'SMPIT LHI'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 py-12 text-center">
          <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map(post => <AnnouncementCard key={post.id} post={post} />)}
        </div>
      )}

      {/* Selalu ada jalan ke daftar lengkap, bukan hanya saat ada sisa: beranda
          memang hanya memuat lima yang terbaru. Saringan unit ikut terbawa. */}
      {filtered.length > 0 && (
        <Link
          href={filter === 'semua' ? '/pengumuman' : `/pengumuman?unit=${filter}`}
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl border bg-muted/40 text-sm font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary-wash"
        >
          Lihat semua pengumuman
          {filtered.length > shown.length && (
            <span className="font-medium text-muted-foreground">· {filtered.length - shown.length} lainnya</span>
          )}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </>
  )
}
