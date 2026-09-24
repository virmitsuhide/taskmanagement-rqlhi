import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canManageTeachers } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TeacherForm } from '../../baru/TeacherForm'
import type { TeacherEmployment } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditTeacherPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canManageTeachers(session.role)) redirect('/ustadz')

  const { id } = await params
  const supabase = createServerClient()
  const KOLOM = 'id, username, full_name, nip, email, phone, is_active, deleted_at, employment_type, joined_at, contract_start, contract_end'
  // gender baru ada setelah migrasi 0086; sebelum itu formnya tetap bisa dibuka.
  let res = await supabase.from('teachers').select(KOLOM + ', gender').eq('id', id).maybeSingle()
  if (res.error) res = await supabase.from('teachers').select(KOLOM).eq('id', id).maybeSingle()
  const teacher = res.data as unknown as (Record<string, unknown> & {
    id: string; username: string; full_name: string; nip: string | null; email: string | null; phone: string | null
    is_active: boolean; deleted_at: string | null; employment_type: TeacherEmployment | null; joined_at: string | null
    contract_start: string | null; contract_end: string | null; gender?: 'L' | 'P' | null
  }) | null

  if (!teacher) notFound()

  // Akun terhapus harus dipulihkan dulu sebelum bisa disunting.
  if (teacher.deleted_at) redirect(`/ustadz/${id}`)

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
