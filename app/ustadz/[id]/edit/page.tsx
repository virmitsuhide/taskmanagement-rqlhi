import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TeacherForm } from '../../baru/TeacherForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTeacherPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTeachers(session.role)) redirect('/ustadz')

  const { id } = await params
  const supabase = createServerClient()
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, username, full_name, nip, email, phone, is_active')
    .eq('id', id)
    .maybeSingle()

  if (!teacher) notFound()

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[
          { label: 'Ustadz', href: '/ustadz' },
          { label: teacher.full_name, href: `/ustadz/${id}` },
          { label: 'Edit' },
        ]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Edit Akun Guru</h1>
        <p className="text-sm text-muted-foreground mb-6">{teacher.full_name}</p>
        <TeacherForm mode="edit" initial={teacher} />
      </div>
    </div>
  )
}
