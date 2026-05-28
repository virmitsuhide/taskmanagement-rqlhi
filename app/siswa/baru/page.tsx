import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getManageableJenjang } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { StudentForm } from './StudentForm'

interface PageProps {
  searchParams: Promise<{ halaqoh_id?: string }>
}

export default async function NewStudentPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowed = getManageableJenjang(session.role)
  if (allowed.length === 0) redirect('/siswa')

  const params = await searchParams
  const defaultHalaqohId = params.halaqoh_id

  const supabase = createServerClient()
  const [halaqohResult, methodsResult, jilidResult] = await Promise.all([
    supabase.from('halaqoh').select('id, name, jenjang').eq('is_active', true).order('name'),
    supabase.from('tahsin_methods').select('id, name').eq('is_active', true).order('name'),
    supabase.from('jilid_levels').select('id, label, method_id, order_num').order('order_num'),
  ])

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Siswa', href: '/siswa' }, { label: 'Tambah Siswa' }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Tambah Siswa</h1>
        <p className="text-sm text-muted-foreground mb-6">Data siswa baru untuk modul tahsin/tahfidz</p>
        <StudentForm
          mode="create"
          allowedJenjang={allowed}
          halaqohList={halaqohResult.data ?? []}
          methods={methodsResult.data ?? []}
          jilidLevels={jilidResult.data ?? []}
          defaultHalaqohId={defaultHalaqohId}
        />
      </div>
    </div>
  )
}
