'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

/** Satu jenis ekstra yang boleh tampil ke publik — tanpa data peserta. */
export interface KartuEkstra {
  id: string
  nama: string
  bidang: string
  /** Sudah diformat: 'Rp 150.000 / bulan' atau 'Tanpa biaya'. */
  biaya: string
  /** '45 menit · 2x sepekan · privat'. */
  waktu: string
}

const LABEL_BIDANG: Record<string, string> = {
  tahsin: 'Tahsin',
  tahfidz: 'Tahfidz',
  campuran: 'Tahsin & tahfidz',
}

/**
 * Ekstra tahsin & tahfidz di beranda. Orang tua memilih jenis di sini, lalu
 * waktu & guru pilihan di formulir. Kartunya digeser seperti Program Kami
 * (scroll-snap + tombol panah, tanpa pustaka carousel). Seperti TeacherStrip,
 * seksi ini hilang total selama belum ada jenis ekstra yang dibuka.
 */
export function EkstraStrip({ title, items }: { title: string; items: KartuEkstra[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  if (items.length === 0) return null

  function slide(dir: 'prev' | 'next') {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const amount = (card?.offsetWidth ?? 280) + 14
    el.scrollBy({ left: dir === 'next' ? amount : -amount, behavior: 'smooth' })
  }

  const tombol = 'w-8 h-8 flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'

  return (
    <section id="ekstra" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Pendaftaran dibuka</p>
          <h2
            className="m-0 text-[30px] font-normal leading-tight tracking-[-0.015em] text-foreground md:text-[40px]"
            style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
          >
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/daftar-ekstra"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent-warm px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 mr-1"
          >
            Daftar ekstra <ArrowRight className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => slide('prev')} aria-label="Ekstra sebelumnya" aria-controls="ekstra-track" className={tombol}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => slide('next')} aria-label="Ekstra berikutnya" aria-controls="ekstra-track" className={tombol}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        id="ekstra-track"
        ref={scrollRef}
        className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(j => (
          <Link
            key={j.id}
            href={`/daftar-ekstra?jenis=${j.id}`}
            className="group snap-start shrink-0 w-[calc(85%-7px)] sm:w-[calc(50%-7px)] lg:w-[calc(33.33%-9.33px)] xl:w-[calc(25%-10.5px)] flex flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-warm">
              {LABEL_BIDANG[j.bidang] ?? j.bidang}
            </span>
            <span className="mt-1.5 font-heading text-[22px] leading-snug group-hover:text-primary">{j.nama}</span>
            <span className="mt-3 font-heading text-lg leading-none text-primary">{j.biaya}</span>
            {j.waktu && (
              <span className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">{j.waktu}</span>
              </span>
            )}
            <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-primary">
              Pilih waktu &amp; guru <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
