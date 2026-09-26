import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import type { PublicTeacher } from '@/types'

interface Props {
  title: string
  teachers: PublicTeacher[]
  /** Id guru yang punya slot ekstra aktif — dihitung sekali di beranda. */
  menerimaEkstra?: ReadonlySet<string>
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

/**
 * Cuplikan Profil Guru di beranda. Seksi disembunyikan total kalau belum ada
 * guru yang ditandai publik — beranda tidak menampilkan blok kosong.
 */
export function TeacherStrip({ title, teachers, menerimaEkstra }: Props) {
  if (teachers.length === 0) return null

  return (
    <section id="profil-guru" className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
      <div className="flex items-end justify-between gap-3 mb-6">
        <h2
          className="m-0 text-[30px] font-normal leading-tight tracking-[-0.015em] text-foreground md:text-[40px]"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          {title}
        </h2>
        <Link href="/profil-guru" className="text-sm font-semibold text-primary hover:underline shrink-0">
          Lihat semua →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {teachers.map(teacher => (
          <Link
            key={teacher.id}
            href={`/profil-guru/${teacher.id}`}
            className="group flex flex-col gap-2.5 rounded-2xl border bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-primary-wash">
              {teacher.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teacher.photo_url}
                  alt=""
                  className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  style={photoStyle(parseFocus(teacher.photo_focus))}
                />
              ) : (
                <span className="flex h-full items-center justify-center font-heading text-3xl text-primary">
                  {initials(teacher.full_name)}
                </span>
              )}
            </span>
            <span className="px-1 pb-1">
              <span className="block font-heading text-[17px] leading-snug line-clamp-2">{teacher.full_name}</span>
              {teacher.public_title && (
                <span className="mt-0.5 block text-[11px] font-semibold text-accent-warm line-clamp-2">{teacher.public_title}</span>
              )}
              {menerimaEkstra?.has(teacher.id) && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-accent-warm-wash px-1.5 py-0.5 text-[10px] font-bold text-accent-warm">
                  <CalendarClock className="h-3 w-3" />Menerima ekstra
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
