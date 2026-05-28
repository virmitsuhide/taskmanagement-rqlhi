import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageHalaqoh, getManageableJenjang } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { HalaqohForm } from '../../baru/HalaqohForm'
import type { Jenjang } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditHalaqohPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerClient()
  const { data: halaqoh } = await supabase
    .from('halaqoh')
    .select('id, name, jenjang, wali_teacher_id, schedule_note, is_active')
    .eq('id', id)
    .maybeSingle()

  if (!halaqoh) notFound()
  if (!canManageHalaqoh(session.role, halaqoh.jenjang as Jenjang)) redirect(`/halaqoh/${id}`)

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
        breadcrumbs={[
          { label: 'Halaqoh', href: '/halaqoh' },
          { label: halaqoh.name, href: `/halaqoh/${id}` },
          { label: 'Edit' },
        ]}
        showBack
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold leading-tight mb-1">Edit Halaqoh</h1>
        <p className="text-sm text-muted-foreground mb-6">{halaqoh.name}</p>
        <HalaqohForm
          mode="edit"
          allowedJenjang={getManageableJenjang(session.role)}
          teachers={teachers ?? []}
          initial={{
            id: halaqoh.id,
            name: halaqoh.name,
            jenjang: halaqoh.jenjang as Jenjang,
            wali_teacher_id: halaqoh.wali_teacher_id,
            schedule_note: halaqoh.schedule_note,
            is_active: halaqoh.is_active,
          }}
        />
      </div>
    </div>
  )
}
