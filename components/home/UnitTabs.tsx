'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { PublicPost } from '@/types'
import { TaskGuruCard } from './TaskGuruCard'

interface Props {
  tugasSD: PublicPost[]
  tugasSMP: PublicPost[]
}

const TABS: { key: 'semua' | 'sd' | 'smp'; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'sd', label: 'SDIT LHI' },
  { key: 'smp', label: 'SMPIT LHI' },
]

export function UnitTabs({ tugasSD, tugasSMP }: Props) {
  const [tab, setTab] = useState<'semua' | 'sd' | 'smp'>('semua')

  const all = [...tugasSD, ...tugasSMP].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const filtered =
    tab === 'semua' ? all.slice(0, 4) : tab === 'sd' ? tugasSD.slice(0, 4) : tugasSMP.slice(0, 4)

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <div className="inline-flex p-1 rounded-full border bg-muted/40">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                tab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Lihat semua tugas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">Belum ada tugas dari koordinator.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((post, i) => (
            <TaskGuruCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}
    </>
  )
}
