'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { PublicPost } from '@/types'

interface Props {
  tugasSD: PublicPost[]
  tugasSMP: PublicPost[]
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
]

function displayDate(post: PublicPost): [string, string] {
  const d = new Date(post.due_date ?? post.created_at)
  return [String(d.getDate()), MONTH_SHORT[d.getMonth()]]
}
function isNew(createdAt: string) { return Date.now() - new Date(createdAt).getTime() < 3 * 86_400_000 }
function isOverdue(dueDate: string | null) { return dueDate ? new Date(dueDate) < new Date() : false }
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase()
}

export function TugasGuruList({ tugasSD, tugasSMP }: Props) {
  const [filter, setFilter] = useState<'semua' | 'sd' | 'smp'>('semua')

  const all = [...tugasSD, ...tugasSMP].sort(
    (a, b) => new Date(b.due_date ?? b.created_at).getTime() - new Date(a.due_date ?? a.created_at).getTime()
  )
  const filtered = filter === 'sd' ? tugasSD : filter === 'smp' ? tugasSMP : all
  const shown = filtered.slice(0, 6)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2
          className="m-0 text-base font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Tugas Guru
        </h2>
        <div className="flex gap-0.5 bg-muted rounded-xl p-1">
          {(['semua', 'sd', 'smp'] as const).map(f => (
            <button
              key={f}
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

      <div>
        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada tugas guru.</p>
          </div>
        ) : (
          shown.map((post, i) => {
            const [day, mon] = displayDate(post)
            const overdue = isOverdue(post.due_date)
            const fresh = isNew(post.created_at)
            const unit = post.target === 'sd' ? 'SDIT' : post.target === 'smp' ? 'SMPIT' : 'Umum'

            return (
              <div
                key={post.id}
                className="flex items-start gap-3.5 px-2.5 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors rounded-lg cursor-pointer group"
              >
                {/* Tanggal */}
                <div className="min-w-[34px] text-center shrink-0 pt-0.5">
                  <div
                    className="text-xl font-bold leading-none text-foreground"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {day}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-[0.8px] mt-0.5">{mon}</div>
                </div>

                {/* Konten */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-primary-wash text-primary">
                      {unit}
                    </span>
                    {overdue && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-destructive/10 text-destructive">
                        Terlambat
                      </span>
                    )}
                    {!overdue && fresh && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-accent-warm-wash text-accent-warm">
                        Baru
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-[1.4] mb-1 text-foreground line-clamp-2">
                    {post.title}
                  </p>
                  {post.creator && (
                    <p className="text-[11px] text-muted-foreground">oleh {post.creator.display_name}</p>
                  )}
                </div>

                {/* Avatar */}
                {post.creator && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${AVATAR_TONES[i % AVATAR_TONES.length]}`}>
                    {initials(post.creator.display_name)}
                  </div>
                )}

                {/* Panah */}
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 self-start mt-1" />
              </div>
            )
          })
        )}
      </div>

      {filtered.length > 6 && (
        <Link
          href="/login"
          className="block text-center text-xs text-muted-foreground mt-3.5 hover:text-foreground transition-colors"
        >
          ↓ lihat {filtered.length - 6} tugas lainnya
        </Link>
      )}
    </>
  )
}
