import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { ROLE_LABELS, canAssignAnyTask } from '@/lib/auth/permissions'
import { getGanttRows, getGanttPeople, resolveGanttTarget } from '@/lib/data/gantt'
import { parseScale, GANTT_SCALES, today, daysBetween } from '@/lib/tasks/gantt'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { GanttChart, GanttLegend } from '@/components/tasks/GanttChart'
import { GanttNavMenu } from '@/components/tasks/GanttNavMenu'
import { NewTaskMenu } from '@/components/tasks/NewTaskMenu'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List, Eye, CalendarClock, AlertTriangle, ListChecks } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ user?: string; scale?: string; done?: string }>
}

/**
 * Garis waktu tugas — milik sendiri, atau milik orang yang papan kanbannya
 * memang boleh dipantau pemirsa ini.
 *
 * Semua pilihan tampilan (orang, skala, ikut-selesai) tinggal di query string,
 * bukan di state komponen: halaman ini sering dibagikan lewat tautan saat rapat
 * koordinasi, dan tautannya harus membuka tampilan yang sama persis.
 */
export default async function GanttPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const scale = parseScale(params.scale)
  const includeDone = params.done === '1'

  // Izin ditegakkan di sini, bukan di pengambil baris: `user` datang dari query
  // string dan tidak boleh dipercaya sebelum dicocokkan dengan izin papan.
  const target = await resolveGanttTarget(session, params.user)
  if (!target) redirect('/tasks/gantt')

  const isSelf = target.id === session.userId
  const [rows, people] = await Promise.all([
    getGanttRows({ userId: target.id, includeDone }),
    getGanttPeople(session),
  ])

  const now = today()
  const overdue = rows.filter(r => r.task.status !== 'done' && r.task.due_date && r.task.due_date < now)
  const pekanIni = rows.filter(r => {
    if (r.task.status === 'done' || !r.task.due_date) return false
    const d = daysBetween(now, r.task.due_date)
    return d >= 0 && d <= 7
  })
  const totalSubtasks = rows.reduce((n, r) => n + r.subtasks.length, 0)
  const doneSubtasks = rows.reduce((n, r) => n + r.subtasks.filter(s => s.status === 'done').length, 0)
  const tanpaTanggal = rows.reduce(
    (n, r) => n + r.subtasks.filter(s => !s.start_date && !s.due_date).length, 0,
  )

  function href(next: { scale?: string; done?: string }): string {
    const p = new URLSearchParams()
    if (!isSelf) p.set('user', target!.id)
    const s = next.scale ?? scale
    if (s !== 'hari') p.set('scale', s)
    const d = next.done ?? (includeDone ? '1' : '0')
    if (d === '1') p.set('done', '1')
    const qs = p.toString()
    return qs ? `/tasks/gantt?${qs}` : '/tasks/gantt'
  }

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Gantt Chart"
        showBack
        ownH1
        breadcrumbs={[{ label: 'Tugas', href: '/tasks' }, { label: 'Gantt Chart' }]}
      />

      <div className="flex-1 bg-muted/50 p-4 dark:bg-background md:p-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {isSelf ? 'Gantt Chart Saya' : `Gantt Chart · ${target.display_name}`}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isSelf
                  ? 'Semua tugas Anda beserta rinciannya, tersusun menurut tanggal.'
                  : `Tugas ${ROLE_LABELS[target.role]} — hanya bisa dibaca.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/tasks/board"><LayoutGrid className="mr-1 h-4 w-4" />Papan</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/tasks"><List className="mr-1 h-4 w-4" />List</Link>
              </Button>
              <GanttNavMenu
                people={people}
                selfName={session.displayName}
                activeUserId={isSelf ? undefined : target.id}
                scale={scale}
              />
              {isSelf && <NewTaskMenu canDelegate={canAssignAnyTask(session.role)} />}
            </div>
          </div>

          {!isSelf && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-info/30 bg-info-wash px-4 py-2.5 text-sm text-info">
              <Eye className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Anda melihat Gantt Chart <strong>{target.display_name}</strong> lewat izin papan
                kanban. Tampilan ini hanya baca — rincian tugas hanya bisa diubah oleh
                pelaksana dan pemberi tugasnya.
              </p>
            </div>
          )}

          {/* Ringkasan */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon={<ListChecks className="h-4 w-4" />} label="Tugas ditampilkan" value={rows.length} />
            <Stat
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              label="Lewat tenggat"
              value={overdue.length}
              tone={overdue.length > 0 ? 'danger' : undefined}
            />
            <Stat icon={<CalendarClock className="h-4 w-4 text-warning" />} label="Jatuh tempo ≤7 hari" value={pekanIni.length} />
            <Stat
              icon={<ListChecks className="h-4 w-4 text-success" />}
              label="Rincian selesai"
              value={totalSubtasks === 0 ? 0 : doneSubtasks}
              suffix={totalSubtasks === 0 ? undefined : `/${totalSubtasks}`}
            />
          </div>

          {/* Kendali tampilan */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-muted p-0.5">
              {GANTT_SCALES.map(s => (
                <Link
                  key={s.key}
                  href={href({ scale: s.key })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    scale === s.key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
            <Link
              href={href({ done: includeDone ? '0' : '1' })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                includeDone
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {includeDone ? '✓ Termasuk yang selesai' : 'Sertakan yang selesai'}
            </Link>
          </div>

          <GanttChart
            rows={rows}
            scale={scale}
            emptyLabel={
              isSelf
                ? 'Buat tugas lalu beri tanggal mulai & tenggat — atau rinci tugas yang ada — supaya batangnya muncul di sini.'
                : `${target.display_name} belum punya tugas aktif untuk digambar.`
            }
          />

          <div className="mt-3 space-y-2">
            <GanttLegend hasOverdue={overdue.length > 0} />
            {tanpaTanggal > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {tanpaTanggal} rincian belum bertanggal, jadi belum punya batang di sini.
                Buka tugasnya lalu isi tenggat rincian tersebut.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              💡 Geser kanvas ke samping untuk menelusuri tanggal. Ketuk nama tugas untuk membuka detailnya.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, label, value, suffix, tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix?: string
  tone?: 'danger'
}) {
  return (
    <div className={`rounded-lg border bg-card p-3 ${tone === 'danger' ? 'border-destructive/30 bg-destructive/5' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold leading-none tabular-nums">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  )
}
