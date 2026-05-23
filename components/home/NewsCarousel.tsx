'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { NewsArticle } from '@/types'

interface Props {
  items: NewsArticle[]
  canCreate?: boolean
}

const CARD_GRADIENTS = [
  'from-green-100 to-green-50 dark:from-green-950 dark:to-green-900',
  'from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900',
  'from-amber-100 to-amber-50 dark:from-amber-950 dark:to-amber-900',
  'from-purple-100 to-purple-50 dark:from-purple-950 dark:to-purple-900',
  'from-rose-100 to-rose-50 dark:from-rose-950 dark:to-rose-900',
  'from-cyan-100 to-cyan-50 dark:from-cyan-950 dark:to-cyan-900',
]

const MONTH_S = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_S[d.getMonth()]} ${d.getFullYear()}`
}

function excerpt(text: string, max = 72) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export function NewsCarousel({ items, canCreate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function slide(dir: 'prev' | 'next') {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement
    const amount = (card?.offsetWidth ?? 260) + 14
    el.scrollBy({ left: dir === 'next' ? amount : -amount, behavior: 'smooth' })
  }

  return (
    <section id="kabar" className="max-w-5xl mx-auto px-6 pb-9">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="m-0 text-lg font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Kabar &amp; Berita
        </h2>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Link
              href="/news/baru"
              className="flex items-center gap-1 text-xs text-primary hover:underline mr-2"
            >
              <Plus className="h-3 w-3" />Buat Berita
            </Link>
          )}
          <Link
            href="/news"
            className="text-xs text-muted-foreground px-2.5 py-1 border rounded-md bg-card hover:text-foreground transition-colors mr-1"
          >
            Semua
          </Link>
          <button
            onClick={() => slide('prev')}
            aria-label="Sebelumnya"
            className="w-8 h-8 flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => slide('next')}
            aria-label="Berikutnya"
            className="w-8 h-8 flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <p className="text-sm text-muted-foreground">Belum ada berita.</p>
          {canCreate && (
            <Link href="/news/baru" className="text-sm text-primary hover:underline mt-2 block">
              Tulis berita pertama →
            </Link>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3.5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory pb-1"
        >
          {items.map((item, i) => (
            <Link
              key={item.id}
              href="/news"
              className="snap-start shrink-0 w-[calc(50%-7px)] sm:w-[calc(33.33%-9.33px)] lg:w-[calc(25%-10.5px)] bg-card border rounded-xl overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all group block"
            >
              <div className={`h-28 bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} border-b`} />
              <div className="p-3 pb-3.5">
                <div className="text-[10px] text-muted-foreground mb-1">
                  {formatDate(item.created_at)}
                  {item.author && <span className="ml-1.5">· {item.author.display_name}</span>}
                </div>
                <div className="text-[13px] font-semibold text-foreground leading-[1.3] mb-1">
                  {item.title}
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  {excerpt(item.content)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
