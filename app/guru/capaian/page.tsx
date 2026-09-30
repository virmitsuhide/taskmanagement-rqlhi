import { redirect } from 'next/navigation'
import { getTeacherSession } from '@/lib/auth/teacher-session'
import { createServerClient } from '@/lib/supabase/server'
import { getTeacherHalaqohIds } from '@/lib/data/teacher'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PapanCapaian } from './PapanCapaian'
import { cn } from '@/lib/utils'
import { currentPeriod, formatPeriod, isValidPeriod, shiftPeriod, toPeriodDate } from '@/lib/finance/period'
import { getPetaHalaman } from '@/lib/data/target-tahfidz'
import { KIND_MUROJAAH, rekapMurojaahPerSiswa, type RekapMurojaah } from '@/lib/rq/murojaah'
import type { StudentMonthly } from '@/types'

interface PageProps {
  searchParams: Promise<{ periode?: string; halaqoh?: string }>
}

/**
 * Capaian awal & akhir bulan per siswa — pengganti lembar "DB Y1–Y6".
 *
 * Guru hanya melihat halaqoh yang diampunya; pemilihan halaqoh lewat query
 * string supaya tautannya bisa dibagikan dan halaman tetap server component.
 */
export default async function CapaianBulananPage({ searchParams }: PageProps) {
  const session = await getTeacherSession()
  if (!session) redirect('/guru/login')

  const params = await searchParams
  const period = isValidPeriod(params.periode ?? '') ? params.periode! : currentPeriod()

  const supabase = createServerClient()
  const halaqohIds = await getTeacherHalaqohIds(session.teacherId)

  const { data: halaqohRows } = halaqohIds.length
    ? await supabase.from('halaqoh').select('id, name').in('id', halaqohIds).order('name')
    : { data: [] }
  const halaqohList = (halaqohRows ?? []) as { id: string; name: string }[]

  const activeHalaqoh = halaqohList.find(h => h.id === params.halaqoh) ?? halaqohList[0] ?? null

  const { data: studentRows } = activeHalaqoh
    ? await supabase
        .from('students')
        .select('id, full_name, kelas, level_awal')
        .eq('halaqoh_id', activeHalaqoh.id)
        .eq('is_active', true)
        .order('full_name')
    : { data: [] }
  const students = (studentRows ?? []) as {
    id: string; full_name: string; kelas: string | null; level_awal: string
  }[]

  const { data: monthlyRows } = students.length
    ? await supabase
        .from('student_monthly')
        .select('*')
        .in('student_id', students.map(s => s.id))
        .eq('period', toPeriodDate(period))
    : { data: [] }

  // Muroja'ah bulan ini dalam halaman (volume baca), langsung dari setoran —
  // bukan dari rangkuman bulanan, yang hanya memuat titik awal & akhir.
  const [{ data: murojaahRows }, peta] = students.length
    ? await Promise.all([
        supabase
          .from('tahfidz_logs')
          .select('student_id, kind, surat_id, ayat_dari, surat_ke_id, ayat_ke')
          .in('student_id', students.map(s => s.id))
          .in('kind', [...KIND_MUROJAAH])
          .gte('setoran_date', toPeriodDate(period))
          .lt('setoran_date', toPeriodDate(shiftPeriod(period, 1))),
        getPetaHalaman(),
      ])
    : [{ data: [] }, null]
  const murojaah: Record<string, RekapMurojaah> = peta
    ? Object.fromEntries(rekapMurojaahPerSiswa(peta, (murojaahRows ?? []) as Parameters<typeof rekapMurojaahPerSiswa>[1]))
    : {}

  const monthly = Object.fromEntries(
    ((monthlyRows ?? []) as StudentMonthly[]).map(row => [row.student_id, row]),
  )

  const belumAkhir = students.filter(s => !monthly[s.id]?.halaman_akhir_tahsin).length
  const href = (g: { periode?: string; halaqoh?: string }) =>
    `/guru/capaian?${new URLSearchParams({ periode: g.periode ?? period, halaqoh: g.halaqoh ?? activeHalaqoh?.id ?? '' }).toString()}`

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary)' }}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-warm">Capaian bulanan</p>
            <h1 className="mt-2 font-heading text-3xl leading-tight tracking-tight md:text-[34px]">
              Awal dan akhir bulan tiap anak
              {activeHalaqoh && students.length > 0 && (
                <em className="block">
                  — {belumAkhir > 0 ? `${belumAkhir} belum punya capaian akhir.` : 'semua sudah punya capaian akhir.'}
                </em>
              )}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Pengganti lembar DB Y1–Y6. Rangkum otomatis dari setoran, lalu betulkan yang perlu — dasar rapor dan rekap semester.
            </p>
          </div>

          {halaqohList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
              {(
                <nav aria-label="Pilih halaqoh" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
                  {halaqohList.map(h => (
                    <Link
                      key={h.id}
                      href={href({ halaqoh: h.id })}
                      aria-current={h.id === activeHalaqoh?.id ? 'page' : undefined}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-bold transition-colors',
                        h.id === activeHalaqoh?.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {h.name}
                    </Link>
                  ))}
                </nav>
              )}
              <div className="flex items-center gap-1.5">
                <Link href={href({ periode: shiftPeriod(period, -1) })} aria-label="Bulan sebelumnya"
                  className="flex size-10 items-center justify-center rounded-xl border bg-card hover:bg-accent">
                  <ChevronLeft className="size-4" />
                </Link>
                <span className="flex h-10 min-w-36 items-center justify-center rounded-xl border bg-card px-3 text-sm font-bold">
                  {formatPeriod(period)}
                </span>
                <Link href={href({ periode: shiftPeriod(period, 1) })} aria-label="Bulan berikutnya"
                  className="flex size-10 items-center justify-center rounded-xl border bg-card hover:bg-accent">
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {halaqohList.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Anda belum menjadi wali atau pengampu halaqoh mana pun.
          </div>
        ) : (
          <PapanCapaian
            key={`${activeHalaqoh?.id}|${period}`}
            period={period}
            previousPeriod={shiftPeriod(period, -1)}
            activeHalaqohId={activeHalaqoh?.id ?? ''}
            students={students}
            monthly={monthly}
            murojaah={murojaah}
          />
        )}
      </div>
    </div>
  )
}
