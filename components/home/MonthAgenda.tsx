'use client'

import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PublicPost, KaldiEvent } from '@/types'

interface Props {
  posts: PublicPost[]
  kaldiEvents?: KaldiEvent[]
  /** ISO tengah malam hari ini, dihitung di server supaya render awal stabil. */
  todayIso: string
  title?: string
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const DAY_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const DEFAULT_DOT = '#94A3B8'
const INTERNAL_COLOR = '#E07A2D'

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function kaldiEventDate(e: KaldiEvent): Date | null {
  const raw = e.start ?? e.date ?? e.startDate ?? e.dtstart ?? null
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Bangun kisi 6×7 untuk satu bulan.
 *
 * Selalu 42 sel supaya tinggi kalender tidak melompat saat ganti bulan. Sel
 * dari bulan sebelum/sesudah tetap dirender (redup) agar minggu di tepi bulan
 * terlihat utuh — tanggal 1 yang jatuh di hari Jumat tidak menggantung sendiri.
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  // getDay(): 0=Minggu. Kolom pertama hari Senin, jadi Minggu digeser ke 6.
  const leading = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - leading)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function MonthAgenda({ posts, kaldiEvents = [], todayIso, title = "Agenda Qur'an." }: Props) {
  const today = useMemo(() => new Date(todayIso), [todayIso])

  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }))
  const [selectedIso, setSelectedIso] = useState<string>(todayIso)
  const selected = useMemo(() => new Date(selectedIso), [selectedIso])

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])

  const postEvents = useMemo(
    () =>
      posts
        .filter(p => p.due_date)
        .map(p => ({ post: p, date: new Date(p.due_date!) })),
    [posts]
  )

  const externalEvents = useMemo(
    () =>
      kaldiEvents
        .map(e => ({ event: e, date: kaldiEventDate(e) }))
        .filter((e): e is { event: KaldiEvent; date: Date } => e.date !== null),
    [kaldiEvents]
  )

  function dayDots(d: Date): string[] {
    const colors: string[] = []
    if (postEvents.some(e => sameDay(e.date, d))) colors.push(INTERNAL_COLOR)
    for (const e of externalEvents) {
      if (!sameDay(e.date, d)) continue
      const c = e.event.color || DEFAULT_DOT
      if (!colors.includes(c)) colors.push(c)
    }
    return colors.slice(0, 3)
  }

  /** Legenda hanya menghitung agenda yang jatuh di bulan yang sedang dibuka. */
  const legend = useMemo(() => {
    const inView = (d: Date) => d.getFullYear() === cursor.year && d.getMonth() === cursor.month
    const seen = new Map<string, string>()
    if (postEvents.some(e => inView(e.date))) seen.set('Internal', INTERNAL_COLOR)
    for (const e of externalEvents) {
      if (!inView(e.date)) continue
      const unit = e.event.unit || 'Lain'
      if (!seen.has(unit)) seen.set(unit, e.event.color || DEFAULT_DOT)
    }
    return Array.from(seen, ([label, color]) => ({ label, color }))
  }, [postEvents, externalEvents, cursor])

  type DayItem = { kind: 'post'; post: PublicPost } | { kind: 'kaldi'; event: KaldiEvent }

  const selectedItems: DayItem[] = useMemo(() => {
    const items: DayItem[] = []
    for (const { post, date } of postEvents) if (sameDay(date, selected)) items.push({ kind: 'post', post })
    for (const { event, date } of externalEvents) if (sameDay(date, selected)) items.push({ kind: 'kaldi', event })
    return items
  }, [postEvents, externalEvents, selected])

  function shiftMonth(delta: number) {
    setCursor(c => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth()
  const selectedLabel = `${DAY_FULL[selected.getDay()]}, ${selected.getDate()} ${MONTH_SHORT[selected.getMonth()]} ${selected.getFullYear()}`

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Kalender
          </p>
          <h3 className="text-lg font-semibold mt-1.5">{title}</h3>
        </div>
        <Calendar className="h-5 w-5 text-primary" />
      </div>

      {/* Navigasi bulan */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Bulan sebelumnya"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {MONTH_FULL[cursor.month]} {cursor.year}
          </p>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
              className="text-[10px] text-primary hover:underline"
            >
              kembali ke bulan ini
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Bulan berikutnya"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] uppercase tracking-wide text-muted-foreground pb-1">
            {d}
          </div>
        ))}
        {grid.map(d => {
          const inMonth = d.getMonth() === cursor.month
          const isSelected = sameDay(d, selected)
          const isToday = sameDay(d, today)
          const dots = dayDots(d)
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => setSelectedIso(d.toISOString())}
              className={`relative aspect-square rounded-lg flex items-center justify-center text-[13px] font-medium border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isToday
                  ? 'bg-accent-warm-wash text-foreground border-accent-warm/40 hover:bg-accent-warm/15'
                  : !inMonth
                  ? 'border-transparent text-muted-foreground/35 hover:bg-muted/30'
                  : dots.length > 0
                  ? 'bg-muted/50 text-foreground border-border hover:bg-muted'
                  : 'border-border hover:bg-muted/40'
              }`}
              aria-pressed={isSelected}
              aria-label={`${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}${dots.length ? ` (${dots.length === 1 ? '1 agenda' : 'beberapa agenda'})` : ''}`}
            >
              {d.getDate()}
              {!isSelected && dots.length > 0 && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dots.map((c, i) => (
                    <span key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {legend.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 pt-4 border-t">
        <div className="flex items-baseline justify-between mb-3 gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectedLabel}
            {sameDay(selected, today) && (
              <span className="ml-2 text-[9px] font-bold text-accent-warm normal-case">Hari ini</span>
            )}
          </p>
          {selectedItems.length > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">{selectedItems.length} agenda</span>
          )}
        </div>

        {selectedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Tidak ada agenda.</p>
        ) : (
          <div className="space-y-3">
            {selectedItems.map((item, i) => {
              if (item.kind === 'post') {
                return (
                  <div key={`post-${item.post.id}`} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: INTERNAL_COLOR }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{item.post.title}</p>
                      <span
                        className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${INTERNAL_COLOR}1A`, color: INTERNAL_COLOR }}
                      >
                        Internal
                      </span>
                    </div>
                  </div>
                )
              }
              const color = item.event.color || DEFAULT_DOT
              const unit = item.event.unit || 'Lain'
              const desc = item.event.description
              return (
                <div key={`kaldi-${item.event.id ?? i}`} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{item.event.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${color}1A`, color }}
                      >
                        {unit}
                      </span>
                      {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
