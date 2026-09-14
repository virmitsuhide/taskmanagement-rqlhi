import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Repeat, ChevronRight, CircleCheck, CircleX, CircleDashed, LayoutGrid } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canViewTasks, canViewRoutineBoard } from '@/lib/auth/permissions'
import { getRoutineChecklist } from '@/lib/data/rutin'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { RoutineChecklist } from '@/components/rutin/RoutineChecklist'

/**
 * Checklist tugas rutin milik pengurus yang sedang masuk.
 *
 * Hanya miliknya sendiri. Kepala RQ memantau milik semua orang dari halaman
 * terpisah (/tugas-rutin/papan) — dan halaman ini pun, saat dibuka kepala RQ,
 * tetap menampilkan tugas rutinnya sendiri. Memantau dan mengerjakan adalah
 * dua pekerjaan yang berbeda; mencampurnya di satu halaman membuat keduanya
 * lebih sulit.
 */
export default async function TugasRutinPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Amanah BPA & BPI tidak melewati modul tugas; tanpa baris ini alamatnya
  // tetap terbuka walau menunya sudah disembunyikan.
  if (!canViewTasks(session.role)) redirect('/rapat')

  const groups = await getRoutineChecklist(session.userId)
  const total = groups.reduce((n, g) => n + g.total, 0)
  const done = groups.reduce((n, g) => n + g.done, 0)
  const missed = groups.reduce((n, g) => n + g.missed, 0)
  const pending = groups.reduce((n, g) => n + g.pending, 0)

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader displayName={session.displayName} role={session.role} title="Tugas Rutin" />

      {/* Kanvas bertint supaya kartu (bg-card) punya kontras di mode terang. */}
      <div className="flex-1 bg-muted/50 dark:bg-background">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-bold leading-tight">Tugas Rutin</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pekerjaan yang berulang menurut kalender. Laporkan hasilnya tiap periode —
                terlaksana, atau tidak terlaksana beserta sebabnya.
              </p>
            </div>
            {canViewRoutineBoard(session.role) && (
              <Link
                href="/tugas-rutin/papan"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                Papan seluruh pengurus
              </Link>
            )}
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
                Tulis deskripsinya, pilih pekanan, bulanan, semesteran, atau tahunan.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>

          {/*
            Ringkasannya menghitung keadaan, bukan irama. Dengan empat irama,
            satu kartu per irama berarti delapan angka yang sebagian besar nol
            sepanjang tahun — sementara judul tiap kelompok di bawah sudah
            menyebutkan hitungannya sendiri.
          */}
          {total > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={<Repeat className="h-4 w-4" />} label="Tugas rutin" value={total} />
              <Stat
                icon={<CircleCheck className="h-4 w-4 text-success" />}
                label="Terlaksana"
                value={done}
              />
              <Stat
                icon={<CircleX className="h-4 w-4 text-destructive" />}
                label="Tidak terlaksana"
                value={missed}
              />
              <Stat
                icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />}
                label="Belum dilaporkan"
                value={pending}
              />
            </div>
          )}

          <RoutineChecklist groups={groups} />

          {total > 0 && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              💡 Laporannya berlaku untuk periode berjalan saja. Pekan baru dimulai tiap
              Senin, bulan baru tiap tanggal 1, dan semester baru tiap Juli &amp; Januari —
              daftarnya kosong lagi dengan sendirinya, tanpa perlu Anda bersihkan.
              {pending === 0 && missed === 0 && ' Semuanya sudah beres. 🎉'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon, label, value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</p>
    </div>
  )
}
