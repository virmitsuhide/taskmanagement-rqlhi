import { redirect } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getManageableJenjang, programScopeFor } from '@/lib/auth/permissions'
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
    supabase.from('halaqoh').select('id, name, jenjang, program').eq('is_active', true).order('name'),
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
      <div className="mx-auto max-w-3xl px-4 py-5 md:p-6">
        <div className="mb-5 flex items-center gap-3 md:mb-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
            <UserPlus className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl leading-tight md:text-2xl">Tambah Siswa</h1>
            <p className="text-sm text-muted-foreground">Data siswa baru untuk modul tahsin/tahfidz</p>
          </div>
        </div>
        <StudentForm
          mode="create"
          allowedJenjang={allowed}
          allowedPrograms={programScopeFor(session.role, allowed)}
          halaqohList={halaqohResult.data ?? []}
          methods={methodsResult.data ?? []}
          jilidLevels={jilidResult.data ?? []}
          defaultHalaqohId={defaultHalaqohId}
        />
      </div>
    </div>
  )
}
