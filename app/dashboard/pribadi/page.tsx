import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard, canAccessNotes, getViewableMeetingTypes } from '@/lib/auth/permissions'
import { getDashboardStats, getMyActiveTasks, getRecentMeetings, getPendingVerifications } from '@/lib/data/dashboard'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DivisionStats } from '@/components/dashboard/DivisionStats'
import { TaskCard } from '@/components/tasks/TaskCard'
import { MeetingCard } from '@/components/rapat/MeetingCard'
import { Button } from '@/components/ui/button'
import { Plus, FileText } from 'lucide-react'

export default async function PribadiDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'pribadi')) redirect('/dashboard')

  const meetingTypes = getViewableMeetingTypes(session.role)

  const [stats, myTasks, pendingVerif, recentMeetings] = await Promise.all([
    getDashboardStats(session.userId),
    getMyActiveTasks(session.userId),
    getPendingVerifications(session.userId),
    meetingTypes.length ? getRecentMeetings(meetingTypes) : Promise.resolve([]),
  ])

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Saya" showBack />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <DivisionStats {...stats} />

        {pendingVerif.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-warning">Perlu Verifikasi ({pendingVerif.length})</h2>
            <div className="space-y-2">
              {pendingVerif.map(task => <TaskCard key={task.id} task={task} showAssignee showAssigner={false} />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Task Aktif Saya</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/tasks/baru"><Plus className="h-3 w-3 mr-1" />Tambah</Link>
            </Button>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tidak ada task aktif.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)}
            </div>
          )}
          <Link href="/tasks" className="text-xs text-primary hover:underline mt-2 inline-block">Lihat semua task →</Link>
        </section>

        {canAccessNotes(session.role) && (
          <section>
            <Button asChild variant="outline" size="sm">
              <Link href="/notes"><FileText className="h-3 w-3 mr-1" />Catatan Pribadi</Link>
            </Button>
          </section>
        )}

        {recentMeetings.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3">Rapat Terbaru</h2>
            <div className="space-y-2">
              {recentMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
            <Link href="/rapat" className="text-xs text-primary hover:underline mt-2 inline-block">Lihat semua rapat →</Link>
          </section>
        )}
      </div>
    </div>
  )
}
