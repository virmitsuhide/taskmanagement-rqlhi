'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight, Plus } from 'lucide-react'
import { programAccent } from '@/lib/programs/theme'
import { ProgramIcon } from '@/components/programs/ProgramIcon'
import type { Program } from '@/types'

interface Props {
  items: Program[]
  /** Humas/kepala RQ melihat pintasan tambah program. */
  canManage?: boolean
  title?: string
}

/**
 * Program di beranda tampil sebagai "artikel" bergambar yang bisa digeser.
 *
 * Kartunya sengaja memakai `scroll-snap` + tombol panah, bukan pustaka carousel:
 * daftarnya tetap satu kontainer yang bisa di-scroll biasa, jadi geser dengan
 * jari di ponsel dan navigasi keyboard tetap jalan tanpa kode tambahan.
 */
export function ProgramCarousel({ items, canManage, title = 'Program Kami' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function slide(dir: 'prev' | 'next') {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const amount = (card?.offsetWidth ?? 280) + 14
    el.scrollBy({ left: dir === 'next' ? amount : -amount, behavior: 'smooth' })
  }

  return (
    <section id="program" className="max-w-5xl mx-auto px-6 pb-9">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2
          className="m-0 text-lg font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link
              href="/humas/program/baru"
              className="flex items-center gap-1 text-xs text-primary hover:underline mr-2"
            >
              <Plus className="h-3 w-3" />Tambah
            </Link>
          )}
          <Link
            href="/program"
            className="text-xs text-muted-foreground px-2.5 py-1 border rounded-md bg-card hover:text-foreground transition-colors mr-1"
          >
            Semua
          </Link>
          <button
            type="button"
            onClick={() => slide('prev')}
            aria-label="Program sebelumnya"
            aria-controls="program-track"
            className="w-8 h-8 flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => slide('next')}
            aria-label="Program berikutnya"
            aria-controls="program-track"
            className="w-8 h-8 flex items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <p className="text-sm text-muted-foreground">Belum ada program.</p>
          {canManage && (
            <Link href="/humas/program/baru" className="text-sm text-primary hover:underline mt-2 block">
              Tambah program pertama →
            </Link>
          )}
        </div>
      ) : (
        <div
          id="program-track"
          ref={scrollRef}
          className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map(program => {
            const accent = programAccent(program.accent)
            return (
              <Link
                key={program.slug}
                href={`/program/${program.slug}`}
                className="snap-start shrink-0 w-[calc(85%-7px)] sm:w-[calc(50%-7px)] lg:w-[calc(33.33%-9.33px)] bg-card border rounded-xl overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all group flex flex-col"
              >
                {/* Gambar artikel */}
                <div className="relative h-36 border-b overflow-hidden">
                  {program.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={program.photo_url}
                      alt={program.title}
                      className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <span className={`flex h-full items-center justify-center bg-gradient-to-br ${accent.gradient}`}>
                      <ProgramIcon icon={program.icon} className={`h-8 w-8 ${accent.iconColor}`} />
                    </span>
                  )}
                </div>

                {/* Isi */}
                <div className="p-4 flex flex-col flex-1">
                  <div className={`h-1 w-8 rounded-full mb-2.5 ${accent.bar}`} />
                  <h3 className="text-sm font-semibold leading-snug mb-1.5 line-clamp-2">
                    {program.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                    {program.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Selengkapnya <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
