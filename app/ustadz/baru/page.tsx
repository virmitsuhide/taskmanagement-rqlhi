import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TeacherForm } from './TeacherForm'

export default async function NewTeacherPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTeachers(session.role)) redirect('/ustadz')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Ustadz', href: '/ustadz' }, { label: 'Tambah Guru' }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Tambah Akun Guru</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Akun ini akan dipakai guru untuk login ke <code className="px-1 py-0.5 bg-muted rounded text-xs">/guru/login</code>
        </p>
        <TeacherForm mode="create" />
      </div>
    </div>
  )
}
