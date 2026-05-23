import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAssignAnyTask, getAssignableRoles } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { User } from '@/types'

export default async function BuatTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting_id?: string; agenda_id?: string; title?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canAssignAnyTask(session.role)) redirect('/tasks')

  const assignableRoles = getAssignableRoles(session.role)
  const supabase = createServerClient()
  const { data } = await supabase
    .from('users')
    .select('id, username, role, display_name, email')
    .in('role', assignableRoles)
    .order('display_name')

  const assignableUsers = (data ?? []) as User[]

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Buat Task Baru"
        breadcrumbs={[{ label: 'Task', href: '/tasks' }, { label: 'Buat Task' }]}
      />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href={sp.meeting_id ? `/rapat/${sp.meeting_id}` : '/tasks'}>
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali
          </Link>
        </Button>

        {sp.meeting_id && (
          <p className="text-sm text-muted-foreground mb-4 px-1">
            Task ini akan terhubung ke notulen rapat.
          </p>
        )}

        <TaskForm
          assignableUsers={assignableUsers}
          defaults={{
            title: sp.title,
            meetingId: sp.meeting_id,
            agendaId: sp.agenda_id,
          }}
        />
      </div>
    </div>
  )
}
