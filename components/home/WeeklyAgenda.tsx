import { Calendar, MapPin } from 'lucide-react'
import { AbstractTile } from './Decorations'
import type { PublicPost, KaldiEvent } from '@/types'

interface Props {
  posts: PublicPost[]
  kaldiEvents?: KaldiEvent[]
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function getWeekDates(): Date[] {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Normalize kaldi event to a Date — handles "start", "date", "startDate", etc.
function kaldiEventDate(e: KaldiEvent): Date | null {
  const raw = e.start ?? e.date ?? e.startDate ?? e.dtstart ?? null
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

export function WeeklyAgenda({ posts, kaldiEvents = [] }: Props) {
  const week = getWeekDates()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Internal post events
  const postEvents = posts
    .filter((p) => p.due_date)
    .map((p) => ({ post: p, date: new Date(p.due_date!), source: 'internal' as const }))
    .filter((e) => week.some((d) => sameDay(d, e.date)))

  // External kaldi events
  const externalEvents = kaldiEvents
    .map((e) => ({ event: e, date: kaldiEventDate(e), source: 'kaldi' as const }))
    .filter((e): e is { event: KaldiEvent; date: Date; source: 'kaldi' } =>
      e.date !== null && week.some((d) => sameDay(d, e.date!))
    )

  function hasPostEvent(d: Date) {
    return postEvents.some((e) => sameDay(e.date, d))
  }

  function hasKaldiEvent(d: Date) {
    return externalEvents.some((e) => sameDay(e.date, d))
  }

  // Merge and sort upcoming for the list, max 6
  type UpcomingItem =
    | { kind: 'post'; post: PublicPost; date: Date }
    | { kind: 'kaldi'; event: KaldiEvent; date: Date }

  const upcoming: UpcomingItem[] = [
    ...postEvents.map(({ post, date }) => ({ kind: 'post' as const, post, date })),
    ...externalEvents.map(({ event, date }) => ({ kind: 'kaldi' as const, event, date })),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              2 Minggu Ini
            </p>
            <h3 className="text-lg font-semibold mt-1.5">Agenda Qur&apos;an.</h3>
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
            const hasPost = hasPostEvent(d)
            const hasKaldi = hasKaldiEvent(d)
            const hasAny = hasPost || hasKaldi
            return (
              <div
                key={d.toISOString()}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium border ${
                  isToday
                    ? 'bg-primary text-primary-foreground border-primary'
                    : hasAny
                    ? 'bg-accent-warm-wash text-foreground border-border'
                    : 'border-border'
                }`}
              >
                {d.getDate()}
                {!isToday && (hasPost || hasKaldi) && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {hasPost && <span className="h-1 w-1 rounded-full bg-accent-warm" />}
                    {hasKaldi && <span className="h-1 w-1 rounded-full bg-primary" />}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        {(postEvents.length > 0 || externalEvents.length > 0) && (
          <div className="mt-3 flex gap-4">
            {postEvents.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-warm" />
                Internal
              </span>
            )}
            {externalEvents.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Kalender RQ
              </span>
            )}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mt-5 pt-4 border-t space-y-2.5">
            {upcoming.map((item, i) =>
              item.kind === 'post' ? (
                <div key={`post-${item.post.id}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-warm shrink-0" />
                  <p className="flex-1 text-sm truncate">{item.post.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {item.date.getDate()} {MONTH_SHORT[item.date.getMonth()]}
                  </p>
                </div>
              ) : (
                <div key={`kaldi-${item.event.id ?? i}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <p className="flex-1 text-sm truncate">{item.event.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {item.date.getDate()} {MONTH_SHORT[item.date.getMonth()]}
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {upcoming.length === 0 && (
          <div className="mt-5 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center py-2">
              Tidak ada agenda 2 minggu ini.
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
