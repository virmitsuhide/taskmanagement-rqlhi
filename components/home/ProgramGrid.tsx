import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PROGRAMS } from '@/app/program/_data'

interface Props {
  title: string
  limit: number
}

/**
 * Ringkasan program di beranda. Sumbernya daftar statis PROGRAMS yang sama
 * dengan halaman /program, jadi tidak ada data yang perlu disinkronkan —
 * Humas hanya mengatur judul seksi dan berapa kartu yang tampil.
 */
export function ProgramGrid({ title, limit }: Props) {
  const shown = PROGRAMS.slice(0, limit)
  if (shown.length === 0) return null

  return (
    <section id="program" className="max-w-5xl mx-auto px-6 pb-9">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2
          className="m-0 text-lg font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <Link href="/program" className="text-xs text-primary hover:underline shrink-0">
          Lihat semua →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map(program => {
          const Icon = program.icon
          return (
            <Link
              key={program.slug}
              href={`/program/${program.slug}`}
              className="group rounded-xl border bg-card p-4 flex flex-col hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className={`inline-flex w-fit items-center justify-center rounded-lg p-2 mb-3 ${program.iconBg}`}>
                <Icon className={`h-4 w-4 ${program.iconColor}`} />
              </div>
              <h3 className="text-sm font-semibold leading-snug mb-1.5">{program.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {program.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Selengkapnya <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
