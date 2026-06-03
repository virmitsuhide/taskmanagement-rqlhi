import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, canViewHalaqoh, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, Users, Calendar, UserCog } from 'lucide-react'
import type { Jenjang } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function HalaqohDetailPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerClient()

  const { data: halaqoh } = await supabase
    .from('halaqoh')
    .select('*, wali_teacher:teachers!halaqoh_wali_teacher_id_fkey(id, full_name, phone, email)')
    .eq('id', id)
    .maybeSingle()

  if (!halaqoh) notFound()
  if (!canViewHalaqoh(session.role, halaqoh.jenjang as Jenjang)) redirect('/halaqoh')

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, nis, kelas, gender, is_active')
    .eq('halaqoh_id', id)
    .order('full_name')

  const canEdit = canManageHalaqoh(session.role, halaqoh.jenjang as Jenjang)
  const activeStudents = (students ?? []).filter(s => s.is_active)
  const inactiveStudents = (students ?? []).filter(s => !s.is_active)

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Halaqoh', href: '/halaqoh' }, { label: halaqoh.name }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{halaqoh.name}</h1>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted">
                  {JENJANG_LABELS[halaqoh.jenjang as Jenjang]}
                </span>
                {!halaqoh.is_active && (
                  <span className="text-xs text-warning">⚠ Nonaktif</span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserCog className="h-4 w-4" />
                  Wali: {halaqoh.wali_teacher?.full_name ?? <em>belum ditentukan</em>}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {activeStudents.length} siswa aktif
                </span>
                {halaqoh.schedule_note && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {halaqoh.schedule_note}
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/halaqoh/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Siswa */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-base font-semibold">Daftar Siswa</h2>
            {canEdit && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/siswa/baru?halaqoh_id=${id}`}>+ Tambah Siswa</Link>
              </Button>
            )}
          </div>

          {activeStudents.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Belum ada siswa di halaqoh ini.
            </div>
          ) : (
            <div className="rounded-lg border divide-y bg-card">
              {activeStudents.map(s => (
                <Link
                  key={s.id}
                  href={`/siswa/${s.id}`}
                  className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.kelas ? `Kelas ${s.kelas}` : '—'} {s.nis && `· NIS ${s.nis}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {s.gender === 'L' ? '👦' : s.gender === 'P' ? '👧' : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {inactiveStudents.length > 0 && (
            <details className="mt-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                {inactiveStudents.length} siswa nonaktif
              </summary>
              <ul className="mt-2 pl-4 list-disc space-y-1">
                {inactiveStudents.map(s => (
                  <li key={s.id}>
                    <Link href={`/siswa/${s.id}`} className="hover:underline">
                      {s.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  )
}
