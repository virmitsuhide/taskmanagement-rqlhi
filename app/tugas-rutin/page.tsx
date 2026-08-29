import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Repeat, ChevronRight, CalendarDays, CalendarRange } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getRoutineChecklist } from '@/lib/data/rutin'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { RoutineChecklist } from '@/components/rutin/RoutineChecklist'

/**
 * Checklist tugas rutin milik pengurus yang sedang masuk.
 *
 * Hanya miliknya sendiri, dan itu bukan pembatasan yang perlu dijaga izin:
 * tidak ada satu pun tampilan yang mengambil tugas rutin orang lain, jadi
 * tidak ada yang bisa bocor. Tugas rutin adalah daftar kerja pribadi —
 * pekerjaan yang perlu dipantau orang lain tempatnya di /tasks.
 */
export default async function TugasRutinPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const groups = await getRoutineChecklist(session.userId)
  const total = groups.reduce((n, g) => n + g.total, 0)
  const done = groups.reduce((n, g) => n + g.done, 0)

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader displayName={session.displayName} role={session.role} title="Tugas Rutin" />

      {/* Kanvas bertint supaya kartu (bg-card) punya kontras di mode terang. */}
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <div className="mb-5">
            <p className="text-2xl font-bold leading-tight">Tugas Rutin</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pekerjaan yang berulang tiap pekan &amp; tiap bulan. Centang begitu dikerjakan.
            </p>
          </div>

          {/* Kotak pengantar ke form tambah — pintu masuk satu-satunya, jadi
              dibuat cukup besar untuk terlihat saat daftarnya masih kosong. */}
          <Link
            href="/tugas-rutin/baru"
            className="group mb-5 flex items-center gap-3 rounded-xl border border-dashed bg-card p-4 shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Tambah Tugas Rutin</span>
              <span className="block text-[11px] text-muted-foreground">
                Tulis deskripsinya, pilih pekanan atau bulanan.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>

          {total > 0 && (
            <div className="mb-5 grid grid-cols-3 gap-2">
              <Stat
                icon={<Repeat className="h-4 w-4" />}
                label="Tugas rutin"
                value={total}
              />
              <Stat
                icon={<CalendarDays className="h-4 w-4 text-info" />}
                label="Pekan ini"
                value={groups[0].total === 0 ? 0 : groups[0].done}
                suffix={groups[0].total === 0 ? undefined : `/${groups[0].total}`}
              />
              <Stat
                icon={<CalendarRange className="h-4 w-4 text-warning" />}
                label="Bulan ini"
                value={groups[1].total === 0 ? 0 : groups[1].done}
                suffix={groups[1].total === 0 ? undefined : `/${groups[1].total}`}
              />
            </div>
          )}

          <RoutineChecklist groups={groups} />

          {total > 0 && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              💡 Centangnya berlaku untuk periode berjalan saja. Pekan baru dimulai tiap
              Senin dan bulan baru tiap tanggal 1 — daftarnya kosong lagi dengan
              sendirinya, tanpa perlu Anda bersihkan.
              {done === total && ' Semuanya sudah beres. 🎉'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, label, value, suffix,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
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
