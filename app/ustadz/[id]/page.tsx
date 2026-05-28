import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers, canViewTeachers, JENJANG_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resetTeacherPasswordAction } from '@/app/actions/teachers'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { Pencil, KeyRound, Mail, Phone, BookOpen } from 'lucide-react'
import { PasswordBanner } from './PasswordBanner'
import type { Jenjang } from '@/types'

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
    .select('id, username, full_name, nip, email, phone, is_active, joined_at, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!teacher) notFound()

  const { data: halaqohRows } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, is_active')
    .eq('wali_teacher_id', id)
    .order('name')

  const canEdit = canManageTeachers(session.role)

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

        {/* Hero */}
        <div className="rounded-xl border bg-card p-5 mb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{teacher.full_name}</h1>
                {!teacher.is_active && <span className="text-xs text-amber-600">⚠ Nonaktif</span>}
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
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/ustadz/${id}/edit`}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Link>
                </Button>
                <form action={resetPasswordFormAction}>
                  <Button type="submit" size="sm" variant="outline">
                    <KeyRound className="h-3.5 w-3.5 mr-1" />Reset Password
                  </Button>
                </form>
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
                    <p className="text-xs text-amber-600 mt-1">⚠ Halaqoh nonaktif</p>
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
