import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import {
  buildTimeline, barMetrics, subtaskRange, rangeLabel, today,
  SUBTASK_STATUS_LABELS,
  type GanttScale, type DayRange,
} from '@/lib/tasks/gantt'
import { TASK_PRIORITY_LABELS } from '@/lib/auth/permissions'
import type { GanttRow } from '@/lib/data/gantt'
import type { TaskStatus, SubtaskStatus } from '@/types'

/**
 * Batang waktu tugas & rinciannya.
 *
 * Komponen server murni — tidak ada state, tidak ada hook. Skala ("Harian",
 * "Mingguan", "Bulanan") dan pilihan orang datang dari query string, bukan dari
 * useState, supaya tampilan yang sedang dilihat seseorang bisa ditautkan dan
 * dibagikan apa adanya.
 *
 * TENTANG PENJAJARAN KOLOM KIRI DAN KANVAS
 *
 * Kolom nama dan kanvas batang adalah dua kolom terpisah yang digulung
 * bersama, jadi tinggi barisnya harus sama persis — kalau tidak, nama di kiri
 * lambat laun melenceng dari batang di kanan. Karena itu tinggi setiap baris
 * ditulis eksplisit dalam piksel (ROW_H / SUB_H), bukan dibiarkan mengikuti isi.
 */

const LABEL_W = 248
const ROW_H = 44
const SUB_H = 30

/** Warna batang tugas per kolom kanban — sengaja sama dengan papan. */
const TASK_TONE: Record<TaskStatus, { bar: string; track: string }> = {
  todo:        { bar: 'var(--muted-foreground)', track: 'var(--muted)' },
  in_progress: { bar: 'var(--info)',             track: 'var(--info-wash)' },
  problem:     { bar: 'var(--destructive)',      track: 'var(--destructive-wash)' },
  submitted:   { bar: 'var(--warning)',          track: 'var(--warning-wash)' },
  done:        { bar: 'var(--success)',          track: 'var(--success-wash)' },
  returned:    { bar: 'var(--destructive)',      track: 'var(--destructive-wash)' },
}

const SUB_TONE: Record<SubtaskStatus, { bar: string; track: string }> = {
  todo:        { bar: 'var(--muted-foreground)', track: 'var(--muted)' },
  in_progress: { bar: 'var(--info)',             track: 'var(--info-wash)' },
  done:        { bar: 'var(--success)',          track: 'var(--success-wash)' },
}

/** Satu baris terpasang: nama di kiri, batang di kanan, tinggi terkunci. */
interface Line {
  key: string
  height: number
  kind: 'task' | 'subtask'
  label: React.ReactNode
  range: DayRange
  tone: { bar: string; track: string }
  /** Bagian batang yang terisi (0–100). Hanya untuk tugas induk. */
  fillPercent?: number
  dashed?: boolean
  overdue: boolean
  tooltip: string
}

interface Props {
  rows: GanttRow[]
  scale: GanttScale
  /** Tampilkan rincian sebagai baris anak di bawah tugasnya. */
  showSubtasks?: boolean
  /** Sembunyikan tautan ke halaman tugas (dipakai di halaman tugas itu sendiri). */
  linkTasks?: boolean
  emptyLabel?: string
}

export function GanttChart({
  rows,
  scale,
  showSubtasks = true,
  linkTasks = true,
  emptyLabel = 'Belum ada tugas untuk digambar di Gantt Chart.',
}: Props) {
  const now = today()

  const lines: Line[] = []
  for (const row of rows) {
    const { task, range, progress } = row
    lines.push({
      key: task.id,
      height: ROW_H,
      kind: 'task',
      label: (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {linkTasks ? (
              <Link
                href={`/tasks/${task.id}`}
                className="truncate text-sm font-medium hover:underline"
                title={task.title}
              >
                {task.title}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium" title={task.title}>{task.title}</span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {TASK_PRIORITY_LABELS[task.priority]}
            {progress.fromStatus
              ? ' · tanpa rincian'
              : ` · ${progress.done}/${progress.total} rincian`}
          </p>
        </div>
      ),
      range,
      tone: TASK_TONE[task.status],
      fillPercent: progress.percent,
      dashed: range.inferred,
      overdue: task.status !== 'done' && !!task.due_date && task.due_date < now,
      tooltip: `${task.title}\n${rangeLabel(range)}\nKemajuan ${progress.percent}%`,
    })

    if (!showSubtasks) continue
    for (const sub of row.subtasks) {
      const subRange = subtaskRange(sub)
      if (!subRange) continue // rincian tanpa tanggal tidak punya tempat di sumbu waktu
      lines.push({
        key: sub.id,
        height: SUB_H,
        kind: 'subtask',
        label: (
          <div className="flex min-w-0 items-center gap-1.5 pl-4">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: SUB_TONE[sub.status].bar }}
              aria-hidden
            />
            <span
              className={`truncate text-xs ${sub.status === 'done' ? 'text-muted-foreground line-through decoration-1' : 'text-muted-foreground'}`}
              title={sub.title}
            >
              {sub.title}
            </span>
          </div>
        ),
        range: subRange,
        tone: SUB_TONE[sub.status],
        overdue: sub.status !== 'done' && !!sub.due_date && sub.due_date < now,
        tooltip: `${sub.title}\n${rangeLabel(subRange)}\n${SUBTASK_STATUS_LABELS[sub.status]}`,
      })
    }
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card py-12 text-center">
        <p className="text-sm font-medium">Gantt Chart masih kosong</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  const timeline = buildTimeline(lines.map(l => l.range), scale)

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <div style={{ minWidth: LABEL_W + timeline.widthPx }}>
        {/* ── Sumbu waktu ─────────────────────────────────────────── */}
        <div className="flex border-b bg-muted/40">
          <div
            className="sticky left-0 z-20 shrink-0 border-r bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ width: LABEL_W }}
          >
            Tugas &amp; Rincian
          </div>
          <div className="flex" style={{ width: timeline.widthPx }}>
            {timeline.ticks.map(t => (
              <div
                key={t.key}
                className={`shrink-0 border-r border-border/50 px-0.5 py-1 text-center last:border-r-0 ${
                  t.isToday ? 'bg-primary/10 font-semibold text-primary' : t.weekend ? 'bg-muted/60' : ''
                }`}
                style={{ width: t.widthPx }}
              >
                {t.sub && (
                  <div className="text-[9px] leading-tight text-muted-foreground/70">{t.sub}</div>
                )}
                <div className="truncate text-[11px] leading-tight tabular-nums">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Baris ───────────────────────────────────────────────── */}
        <div className="flex">
          {/* Kolom nama — melekat di kiri saat kanvas digulung mendatar */}
          <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LABEL_W }}>
            {lines.map(l => (
              <div
                key={l.key}
                className={`flex items-center border-b px-3 last:border-b-0 ${
                  l.kind === 'subtask' ? 'bg-muted/20' : ''
                }`}
                style={{ height: l.height }}
              >
                {l.label}
              </div>
            ))}
          </div>

          {/* Kanvas batang */}
          <div className="relative" style={{ width: timeline.widthPx }}>
            {/* Garis bantu kolom — satu lapisan untuk semua baris, bukan
                digambar ulang di tiap baris. */}
            <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
              {timeline.ticks.map(t => (
                <div
                  key={t.key}
                  className={`shrink-0 border-r border-border/40 last:border-r-0 ${t.weekend ? 'bg-muted/40' : ''}`}
                  style={{ width: t.widthPx }}
                />
              ))}
            </div>

            {/* Penanda hari ini */}
            {timeline.todayPx !== null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary/70"
                style={{ left: timeline.todayPx }}
                aria-hidden
              />
            )}

            {lines.map(l => {
              const m = barMetrics(l.range, timeline)
              return (
                <div
                  key={l.key}
                  className={`relative border-b last:border-b-0 ${l.kind === 'subtask' ? 'bg-muted/10' : ''}`}
                  style={{ height: l.height }}
                >
                  <div
                    className="absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-md"
                    style={{
                      left: m.leftPx,
                      width: m.widthPx,
                      height: l.kind === 'task' ? 18 : 12,
                      background: l.tone.track,
                      border: `1px ${l.dashed ? 'dashed' : 'solid'} ${l.tone.bar}`,
                      // Batang yang lewat tenggat diberi cincin merah tipis —
                      // warna isian sudah dipakai untuk status, jadi keterlambatan
                      // butuh sumbu visual sendiri agar keduanya bisa dibaca sekaligus.
                      boxShadow: l.overdue ? '0 0 0 2px var(--destructive)' : undefined,
                    }}
                    title={l.tooltip}
                  >
                    {l.fillPercent !== undefined && l.fillPercent > 0 && (
                      <div
                        className="h-full"
                        style={{ width: `${l.fillPercent}%`, background: l.tone.bar }}
                      />
                    )}
                    {l.fillPercent === undefined && (
                      <div className="h-full" style={{ background: l.tone.bar, opacity: 0.85 }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Keterangan warna & tanda — dipakai di bawah setiap Gantt. */
export function GanttLegend({ hasOverdue }: { hasOverdue?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <Swatch color="var(--muted-foreground)" label="Belum mulai" />
      <Swatch color="var(--info)" label="Dikerjakan" />
      <Swatch color="var(--warning)" label="Menunggu review" />
      <Swatch color="var(--destructive)" label="Bermasalah / dikembalikan" />
      <Swatch color="var(--success)" label="Selesai" />
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground" aria-hidden />
        Tanpa tanggal (perkiraan)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-px w-4 bg-primary" aria-hidden />
        Hari ini
      </span>
      {hasOverdue && (
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Cincin merah = lewat tenggat
        </span>
      )}
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-4 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}
