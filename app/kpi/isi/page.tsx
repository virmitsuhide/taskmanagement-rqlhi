import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canInputKpi } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { MONTH_NAMES } from '@/lib/data/kpi'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { KpiForm } from './KpiForm'
import type { Jenjang, KpiMonthly } from '@/types'

interface PageProps {
  searchParams: Promise<{ teacher?: string; unit?: string; year?: string; month?: string }>
}

/**
 * Angka `numeric` datang dari PostgREST sebagai string supaya ketelitiannya
 * tidak hilang di JSON. Form memerlukannya sebagai number — lihat catatan yang
 * sama di lib/data/kpi.ts.
 */
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

export default async function IsiKpiPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canInputKpi(session.role)) redirect('/dashboard')

  const p = await searchParams
  const now = new Date()
  const teacherId = p.teacher
  const unit = p.unit ?? 'sd'
  const year = Number(p.year) || now.getFullYear()
  const month = Number(p.month) || now.getMonth() + 1
  if (!teacherId || month < 1 || month > 12) notFound()

  const supabase = createServerClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, full_name, unit')
    .eq('id', teacherId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!teacher) notFound()

  const { data: raw } = await supabase
    .from('kpi_monthly')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  const existing: KpiMonthly | null = raw
    ? {
        ...(raw as KpiMonthly),
        late_minutes: num(raw.late_minutes),
        db_late_days: num(raw.db_late_days),
        hafalan_juz: num(raw.hafalan_juz),
        hafalan_pages: num(raw.hafalan_pages),
        tuhfatul_bait: num(raw.tuhfatul_bait),
        bacaan_score: num(raw.bacaan_score),
        buku_pegangan_meetings: num(raw.buku_pegangan_meetings),
        izin_wa_cases: num(raw.izin_wa_cases),
        pengganti_cases: num(raw.pengganti_cases),
        pengganti_found: num(raw.pengganti_found),
        seragam_total: raw.seragam_total == null ? null : num(raw.seragam_total),
        lapor_ortu_total: raw.lapor_ortu_total == null ? null : num(raw.lapor_ortu_total),
        halaqoh_total: raw.halaqoh_total == null ? null : num(raw.halaqoh_total),
      }
    : null

  const backHref = `/kpi?unit=${unit}&year=${year}&month=${month}`

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Isi KPI" showBack />
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke rekap KPI
        </Link>

        <KpiForm
          teacherId={teacher.id}
          teacherName={teacher.full_name}
          year={year}
          month={month}
          monthLabel={MONTH_NAMES[month - 1]}
          backHref={backHref}
          existing={existing}
          unit={(teacher.unit ?? null) as Jenjang | null}
        />
      </div>
    </div>
  )
}
