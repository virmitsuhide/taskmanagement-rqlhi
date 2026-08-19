import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import {
  canViewAnalytics, canViewUnitAnalytics, getAnalyticsJenjang, JENJANG_LABELS,
} from '@/lib/auth/permissions'
import { getUnitLearning } from '@/lib/data/analytics'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { UnitProgramAnalytics } from '@/components/dashboard/UnitProgramAnalytics'
import { BookOpen, ClipboardList } from 'lucide-react'

export default async function AnalitikUnitPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewUnitAnalytics(session.role)) redirect('/dashboard')

  // Manajemen melihat semua unit; koor SD/SMP hanya unitnya sendiri.
  const allowedJenjang = getAnalyticsJenjang(session.role)
  const isFullAccess = canViewAnalytics(session.role)

  const allUnits = await getUnitLearning()
  const units = allUnits.filter(u => allowedJenjang.includes(u.jenjang))

  const scopeLabel = isFullAccess
    ? 'Capaian Qur’ani per Unit'
    : `Unit ${allowedJenjang.map(j => JENJANG_LABELS[j]).join(' · ')}`

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Analitik per Unit & Program"
        showBack
        ownH1
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[1.8px] text-muted-foreground">{scopeLabel}</p>
          <h1 className="text-2xl font-bold leading-tight">Analitik per Unit &amp; Program</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capaian tahsin, tahfidz, ujian juz&apos;iyah &amp; tasmi&apos; tiap program
            {isFullAccess ? (
              <>
                {' · '}
                <Link href="/dashboard/analitik" className="text-primary hover:underline">
                  ← Analitik RQ umum
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <Link
          href="/dashboard/analitik/kurikulum"
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Capaian Pembelajaran per Angkatan →</p>
            <p className="text-xs text-muted-foreground">
              Ketercapaian target tahsin &amp; tahfidz tiap kelas, dibanding bulan sebelumnya
            </p>
          </div>
        </Link>

        {/* Menagih pengisian adalah tugas koordinator unit, jadi pintunya
            ditaruh di halaman yang memang mereka buka. */}
        <Link
          href="/dashboard/analitik/kelengkapan"
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-wash)', color: 'var(--primary)' }}
          >
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Kelengkapan Pengisian Capaian →</p>
            <p className="text-xs text-muted-foreground">
              Halaqoh mana yang gurunya belum mengisi capaian bulan ini
            </p>
          </div>
        </Link>

        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Belum ada data siswa untuk unit Anda.
          </p>
        ) : (
          <UnitProgramAnalytics units={units} />
        )}
      </div>
    </div>
  )
}
