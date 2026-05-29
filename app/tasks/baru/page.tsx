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

interface SearchParams {
  meeting_id?: string
  agenda_id?: string
  title?: string
  personal?: string
  priority?: string  // 'normal' | 'jangka_panjang'
}

export default async function BuatTaskPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const isPersonal = sp.personal === '1'
  // Akses: kalau delegasi, butuh canAssignAnyTask. Kalau personal, semua role boleh.
  if (!isPersonal && !canAssignAnyTask(session.role)) redirect('/tasks')

  const supabase = createServerClient()
  let assignableUsers: User[] = []
  if (!isPersonal) {
    const assignableRoles = getAssignableRoles(session.role)
    const { data } = await supabase
      .from('users')
      .select('id, username, role, display_name, email')
      .in('role', assignableRoles)
      .order('display_name')
    assignableUsers = (data ?? []) as User[]
  }

  const lockPriority: 'normal' | 'jangka_panjang' | undefined =
    isPersonal && (sp.priority === 'jangka_panjang' || sp.priority === 'normal')
      ? (sp.priority as 'normal' | 'jangka_panjang')
      : undefined

  const title = isPersonal
    ? (lockPriority === 'jangka_panjang' ? 'Tugas Pribadi — Jangka Panjang' : 'Tugas Pribadi — Jangka Pendek')
    : 'Delegasikan Tugas'

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title={title}
        breadcrumbs={[{ label: 'Tugas', href: '/tasks' }, { label: title }]}
      />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href={sp.meeting_id ? `/rapat/${sp.meeting_id}` : '/tasks'}>
            <ArrowLeft className="h-4 w-4 mr-1" />Kembali
          </Link>
        </Button>

        {sp.meeting_id && (
          <p className="text-sm text-muted-foreground mb-4 px-1">
            Tugas ini akan terhubung ke notulen rapat.
          </p>
        )}

        <TaskForm
          assignableUsers={assignableUsers}
          defaults={{
            title: sp.title,
            meetingId: sp.meeting_id,
            agendaId: sp.agenda_id,
          }}
          personalMode={isPersonal ? {
            selfUserId: session.userId,
            selfName: session.displayName,
            lockPriority,
          } : undefined}
        />
      </div>
    </div>
  )
}
