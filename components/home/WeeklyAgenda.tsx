import { Calendar, MapPin } from 'lucide-react'
import { AbstractTile } from './Decorations'
import type { PublicPost } from '@/types'

interface Props {
  posts: PublicPost[]
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function getWeekDates(): Date[] {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function WeeklyAgenda({ posts }: Props) {
  const week = getWeekDates()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const events = posts
    .filter((p) => p.due_date)
    .map((p) => ({ post: p, date: new Date(p.due_date!) }))
    .filter((e) => week.some((d) => sameDay(d, e.date)))

  function hasEvent(d: Date) {
    return events.some((e) => sameDay(e.date, d))
  }

  const upcoming = events
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Pekan ini
            </p>
            <h3 className="text-lg font-semibold mt-1.5">Agenda halaqoh.</h3>
          </div>
          <Calendar className="h-5 w-5 text-primary" />
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
          {week.map((d) => {
            const isToday = sameDay(d, today)
            const has = hasEvent(d)
            return (
              <div
                key={d.toISOString()}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium border ${
                  isToday
                    ? 'bg-primary text-primary-foreground border-primary'
                    : has
                    ? 'bg-accent-warm-wash text-foreground border-border'
                    : 'border-border'
                }`}
              >
                {d.getDate()}
                {has && !isToday && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-accent-warm" />
                )}
              </div>
            )
          })}
        </div>

        {upcoming.length > 0 && (
          <div className="mt-5 pt-4 border-t space-y-2.5">
            {upcoming.map(({ post, date }) => (
              <div key={post.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-warm shrink-0" />
                <p className="flex-1 text-sm truncate">{post.title}</p>
                <p className="text-xs text-muted-foreground shrink-0">
                  {date.getDate()} {MONTH_SHORT[date.getMonth()]}
                </p>
              </div>
            ))}
          </div>
        )}

        {upcoming.length === 0 && (
          <div className="mt-5 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center py-2">
              Tidak ada agenda dengan deadline pekan ini.
            </p>
          </div>
        )}
      </div>

      {/* TODO: Acara mendatang — isi judul/tanggal/lokasi acara wisuda atau event besar berikutnya */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <AbstractTile height={130} variant={1} />
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-warm">
            Acara mendatang
          </p>
          <h3 className="text-lg font-semibold mt-2 leading-snug">
            Wisuda Tahfizh angkatan ke-8.
          </h3>
          <div className="flex flex-wrap gap-3 mt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> 15 Juli 2026
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Aula LHI
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
