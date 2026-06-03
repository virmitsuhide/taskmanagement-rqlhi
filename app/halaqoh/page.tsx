import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, canViewHalaqoh, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Plus, Users, Calendar } from 'lucide-react'
import type { Halaqoh, Jenjang, Teacher } from '@/types'

type HalaqohWithStatsBase = Omit<Halaqoh, 'wali_teacher'>

interface PageProps {
  searchParams: Promise<{ jenjang?: string }>
}

interface HalaqohWithStats extends HalaqohWithStatsBase {
  wali_teacher: Pick<Teacher, 'id' | 'full_name'> | null
  student_count: number
}

export default async function HalaqohListPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewHalaqoh(session.role)) redirect('/dashboard')

  const params = await searchParams
  const jenjangFilter = params.jenjang as Jenjang | undefined
  const allowed = getManageableJenjang(session.role)
  const canCreateAny = allowed.length > 0

  const supabase = createServerClient()
  let query = supabase
    .from('halaqoh')
    .select('*, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(id, full_name)')
    .order('jenjang')
    .order('name')

  // Scope ke jenjang yang user bisa lihat
  const viewableJenjang: Jenjang[] = ['kepala_rq', 'kumik', 'sdm', 'bendahara'].includes(session.role)
    ? ['paud', 'sd', 'smp', 'sma']
    : allowed
  if (viewableJenjang.length > 0) {
    query = query.in('jenjang', viewableJenjang)
  }
  if (jenjangFilter && viewableJenjang.includes(jenjangFilter)) {
    query = query.eq('jenjang', jenjangFilter)
  }

  const { data: halaqohData } = await query
  const halaqohList = (halaqohData ?? []) as HalaqohWithStats[]

  // Hitung jumlah siswa per halaqoh
  if (halaqohList.length > 0) {
    const ids = halaqohList.map(h => h.id)
    const { data: counts } = await supabase
      .from('students')
      .select('halaqoh_id')
      .in('halaqoh_id', ids)
      .eq('is_active', true)
    const countMap = new Map<string, number>()
    for (const row of counts ?? []) {
      countMap.set(row.halaqoh_id, (countMap.get(row.halaqoh_id) ?? 0) + 1)
    }
    for (const h of halaqohList) h.student_count = countMap.get(h.id) ?? 0
  }

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Halaqoh" showBack ownH1 />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Halaqoh</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kelompok belajar tahsin &amp; tahfidz
            </p>
          </div>
          {canCreateAny && (
            <Button asChild size="sm">
              <Link href="/halaqoh/baru"><Plus className="h-4 w-4 mr-1" />Buat Halaqoh</Link>
            </Button>
          )}
        </div>

        {/* Jenjang filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <FilterChip href="/halaqoh" active={!jenjangFilter}>Semua</FilterChip>
          {viewableJenjang.map(j => (
            <FilterChip key={j} href={`/halaqoh?jenjang=${j}`} active={jenjangFilter === j}>
              {JENJANG_LABELS[j]}
            </FilterChip>
          ))}
        </div>

        {halaqohList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">Belum ada halaqoh</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canCreateAny ? "Klik 'Buat Halaqoh' untuk memulai" : 'Tidak ada halaqoh di lingkup Anda'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {halaqohList.map(h => (
              <Link
                key={h.id}
                href={`/halaqoh/${h.id}`}
                className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{h.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {JENJANG_LABELS[h.jenjang]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Wali: {h.wali_teacher?.full_name ?? <em>belum ditentukan</em>}
                </p>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {h.student_count ?? 0} siswa
                  </span>
                  {h.schedule_note && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Calendar className="h-3 w-3" /> {h.schedule_note}
                    </span>
                  )}
                  {!h.is_active && (
                    <span className="text-warning">⚠ Nonaktif</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  href, active, children,
}: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground hover:text-foreground border-border'
      }`}
    >
      {children}
    </Link>
  )
}
