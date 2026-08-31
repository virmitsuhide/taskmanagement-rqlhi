import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageEmployees } from '@/lib/auth/permissions'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { EmployeeForm } from './EmployeeForm'

export default async function KaryawanBaruPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageEmployees(session.role)) redirect('/karyawan')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Karyawan', href: '/karyawan' }, { label: 'Tambah Karyawan' }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="mb-1 text-2xl font-bold leading-tight">Tambah Akun Karyawan</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Akun ini dipakai untuk login ke{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/karyawan/login</code> — portalnya
          hanya berisi halaman Profil.
        </p>
        <EmployeeForm mode="create" />
      </div>
    </div>
  )
}
