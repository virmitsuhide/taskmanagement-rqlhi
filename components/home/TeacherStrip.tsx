import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { parseFocus, photoStyle } from '@/lib/profil/foto'
import type { PublicTeacher } from '@/types'

interface Props {
  title: string
  teachers: PublicTeacher[]
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

/**
 * Cuplikan Profil Guru di beranda. Seksi disembunyikan total kalau belum ada
 * guru yang ditandai publik — beranda tidak menampilkan blok kosong.
 */
export function TeacherStrip({ title, teachers }: Props) {
  if (teachers.length === 0) return null

  return (
    <section id="profil-guru" className="max-w-5xl mx-auto px-6 pb-9">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2
          className="m-0 text-lg font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        <Link href="/profil-guru" className="text-xs text-primary hover:underline shrink-0">
          Lihat semua →
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {teachers.map(teacher => (
          <Link
            key={teacher.id}
            href="/profil-guru"
            className="rounded-xl border bg-card p-4 flex flex-col items-center text-center hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <Avatar className="size-14 mb-2.5 overflow-hidden">
              {teacher.photo_url && (
                <AvatarImage src={teacher.photo_url} alt="" style={photoStyle(parseFocus(teacher.photo_focus))} />
              )}
              <AvatarFallback className="text-sm font-semibold">
                {initials(teacher.full_name)}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs font-semibold leading-snug line-clamp-2">{teacher.full_name}</p>
            {teacher.public_title && (
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{teacher.public_title}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
