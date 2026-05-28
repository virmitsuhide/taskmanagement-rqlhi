import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getManageableJenjang } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { HalaqohForm } from './HalaqohForm'

export default async function NewHalaqohPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const allowed = getManageableJenjang(session.role)
  if (allowed.length === 0) redirect('/halaqoh')

  const supabase = createServerClient()
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        breadcrumbs={[{ label: 'Halaqoh', href: '/halaqoh' }, { label: 'Buat Halaqoh' }]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Buat Halaqoh Baru</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Halaqoh akan menampung siswa dengan jenjang yang sama.
        </p>
        <HalaqohForm mode="create" allowedJenjang={allowed} teachers={teachers ?? []} />
      </div>
    </div>
  )
}
