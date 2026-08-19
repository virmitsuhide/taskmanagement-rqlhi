import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers, canViewTeachers, getManageableJenjang, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resetTeacherPasswordAction } from '@/app/actions/teachers'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, KeyRound, Mail, Phone, BookOpen } from 'lucide-react'
import { DeleteTeacherButton, RestoreTeacherButton } from '../TeacherActions'
import { PasswordBanner } from './PasswordBanner'
import { contractDaysLeft } from '@/lib/auth/contract'
import { getCurrentTerm, getTeacherSessionLoad } from '@/lib/data/terms'
import { TEACHER_EMPLOYMENT_LABELS, type Jenjang, type TeacherEmployment } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new_password?: string }>
}

export default async function TeacherDetailPage({ params, searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewTeachers(session.role)) redirect('/dashboard')

  const { id } = await params
  const { new_password } = await searchParams

  const supabase = createServerClient()
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, username, full_name, nip, email, phone, is_active, deleted_at, joined_at, created_at, employment_type, unit, contract_start, contract_end')
    .eq('id', id)
    .maybeSingle()

  if (!teacher) notFound()

  // Akun terhapus hanya boleh dibuka oleh yang bisa memulihkannya. Bagi yang
  // lain guru itu memang sudah tidak ada — termasuk lewat tautan langsung.
  if (teacher.deleted_at && !canManageTeachers(session.role)) notFound()

  const { data: halaqohRows } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, is_active')
    .eq('wali_teacher_id', id)
    .order('name')

  // Koor hanya boleh membuka guru di unitnya — cegah akses lintas unit via URL.
  if (session.role === 'koor_sd' || session.role === 'koor_smp') {
    const unitScope = getManageableJenjang(session.role)
    const { data: unitHalaqoh } = await supabase
      .from('halaqoh')
      .select('id, wali_teacher_id')
      .in('jenjang', unitScope)

    const isWali = (unitHalaqoh ?? []).some(h => h.wali_teacher_id === id)
    let isPengampu = false
    const halaqohIds = (unitHalaqoh ?? []).map(h => h.id as string)
    if (!isWali && halaqohIds.length > 0) {
      const { data: rel } = await supabase
        .from('halaqoh_teachers')
        .select('teacher_id')
        .in('halaqoh_id', halaqohIds)
        .eq('teacher_id', id)
        .limit(1)
      isPengampu = (rel ?? []).length > 0
    }
    if (!isWali && !isPengampu) redirect('/ustadz')
  }

  const canEdit = canManageTeachers(session.role)

  // Beban sesi semester berjalan — dasar angka "2 sesi"/"3 sesi" pada MPP.
  const currentTerm = await getCurrentTerm()
  const sessionCount = currentTerm
    ? (await getTeacherSessionLoad(currentTerm.id)).get(id) ?? 0
    : 0

  const initials = teacher.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  async function resetPasswordFormAction() {
    'use server'
    await resetTeacherPasswordAction(id)
  }

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Ustadz', href: '/ustadz' }, { label: teacher.full_name }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {new_password && (
          <PasswordBanner password={new_password} username={teacher.username} />
        )}

        {teacher.deleted_at && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p className="font-medium text-destructive">Akun ini sudah dihapus</p>
            <p className="text-muted-foreground mt-0.5">
              Dihapus {new Date(teacher.deleted_at).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}. Guru tidak bisa login dan tidak muncul di daftar mana pun.
              Riwayat setoran serta penugasan halaqoh-nya masih tersimpan.
            </p>
          </div>
        )}

        {/* Hero */}
        <div className="rounded-xl border bg-card p-5 mb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{teacher.full_name}</h1>
                {!teacher.is_active && <span className="text-xs text-warning">⚠ Nonaktif</span>}
              </div>
              <code className="text-xs bg-muted px-2 py-0.5 rounded">@{teacher.username}</code>
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                {teacher.nip && <span>NIP {teacher.nip}</span>}
                {teacher.email && (
                  <a href={`mailto:${teacher.email}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Mail className="h-4 w-4" />{teacher.email}
                  </a>
                )}
                {teacher.phone && (
                  <a
                    href={`https://wa.me/${teacher.phone.replace(/^0/, '62').replace(/\D/g, '')}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="h-4 w-4" />{teacher.phone}
                  </a>
                )}
                <span>Bergabung {new Date(teacher.joined_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}</span>
              </div>

              {/* Kepegawaian: jenis guru, unit, beban sesi, dan masa kontrak. */}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                {teacher.employment_type && (
                  <span className="rounded bg-muted px-2 py-1 font-medium">
                    {TEACHER_EMPLOYMENT_LABELS[teacher.employment_type as TeacherEmployment]}
                  </span>
                )}
                {teacher.unit && (
                  <span className="rounded bg-muted px-2 py-1">{JENJANG_LABELS[teacher.unit as Jenjang]}</span>
                )}
                <span className="rounded bg-muted px-2 py-1 tabular-nums">
                  {sessionCount} sesi / pekan
                </span>
                {teacher.contract_end && (
                  <span
                    className={`rounded px-2 py-1 font-medium ${
                      (contractDaysLeft(teacher.contract_end) ?? 0) < 0
                        ? 'bg-destructive/10 text-destructive'
                        : (contractDaysLeft(teacher.contract_end) ?? 999) <= 60
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-muted'
                    }`}
                  >
                    Kontrak s.d. {new Date(teacher.contract_end).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2 flex-wrap">
                {teacher.deleted_at ? (
                  // Akun terhapus hanya menawarkan satu jalan keluar: pulihkan
                  // dulu. Menyunting atau mereset password akun yang sudah
                  // dibuang cuma membingungkan.
                  <RestoreTeacherButton id={id} name={teacher.full_name} />
                ) : (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/ustadz/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
                    </Button>
                    <form action={resetPasswordFormAction}>
                      <Button type="submit" size="sm" variant="outline">
                        <KeyRound className="h-3.5 w-3.5 mr-1" />Reset Password
                      </Button>
                    </form>
                    <DeleteTeacherButton id={id} name={teacher.full_name} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Halaqoh yang diampu */}
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Halaqoh sebagai Wali
          </h2>
          {!halaqohRows || halaqohRows.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Belum menjadi wali halaqoh manapun.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {halaqohRows.map(h => (
                <Link
                  key={h.id}
                  href={`/halaqoh/${h.id}`}
                  className="rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{h.name}</p>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted">
                      {JENJANG_LABELS[h.jenjang as Jenjang]}
                    </span>
                  </div>
                  {!h.is_active && (
                    <p className="text-xs text-warning mt-1">⚠ Halaqoh nonaktif</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
