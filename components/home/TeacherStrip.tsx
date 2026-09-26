import Link from 'next/link'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import type { PublicTeacher } from '@/types'

interface Props {
  title: string
  teachers: PublicTeacher[]
  /** Ada jenis ekstra yang dibuka → setiap kartu guru punya tombol Booking. */
  bukaEkstra?: boolean
  /** Guru ekstra (0095); null = daftar belum ada, semua guru boleh dibooking. */
  guruEkstra?: ReadonlySet<string> | null
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

/**
 * Cuplikan Profil Guru di beranda. Seksi disembunyikan total kalau belum ada
 * guru yang ditandai publik — beranda tidak menampilkan blok kosong.
 */
export function TeacherStrip({ title, teachers, bukaEkstra, guruEkstra = null }: Props) {
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
          <div
            key={teacher.id}
            className="group flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <Link href={`/profil-guru/${teacher.id}`} className="flex flex-col gap-2.5">
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
              <span className="px-1">
                <span className="block font-heading text-[17px] leading-snug line-clamp-2">{teacher.full_name}</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-accent-warm line-clamp-2">{teacher.keterangan}</span>
              </span>
            </Link>
            <span className="mt-auto grid grid-cols-2 gap-1.5">
              <Link href={`/profil-guru/${teacher.id}`} className="flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary">
                Profil
              </Link>
              {bukaEkstra && (!guruEkstra || guruEkstra.has(teacher.id)) ? (
                <Link href={`/profil-guru/${teacher.id}#booking`} aria-label={`Booking ekstra bersama ${teacher.full_name}`}
                  className="flex h-9 items-center justify-center rounded-lg bg-accent-warm text-xs font-bold text-white transition-opacity hover:opacity-90">
                  Booking
                </Link>
              ) : (
                <span aria-disabled="true" className="flex h-9 items-center justify-center rounded-lg border border-dashed px-1 text-center text-[10px] leading-tight text-muted-foreground">
                  {bukaEkstra ? 'Tidak menerima ekstra' : 'Segera'}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
