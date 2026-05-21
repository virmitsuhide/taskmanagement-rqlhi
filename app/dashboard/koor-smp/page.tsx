import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { getDashboardStats, getMyActiveTasks, getRecentMeetings, getPendingVerifications } from '@/lib/data/dashboard'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DivisionStats } from '@/components/dashboard/DivisionStats'
import { TaskCard } from '@/components/tasks/TaskCard'
import { MeetingCard } from '@/components/rapat/MeetingCard'

export default async function KoorSmpDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-smp')) redirect('/dashboard')

  const [stats, myTasks, pendingVerif, recentMeetings] = await Promise.all([
    getDashboardStats(session.userId),
    getMyActiveTasks(session.userId),
    getPendingVerifications(session.userId),
    getRecentMeetings(['koor_smp', 'kumik']),
  ])

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Koor SMP" showBack />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <DivisionStats {...stats} />

        {pendingVerif.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-amber-600">Perlu Verifikasi ({pendingVerif.length})</h2>
            <div className="space-y-2">
              {pendingVerif.map(task => <TaskCard key={task.id} task={task} showAssignee />)}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-3">Task Aktif Saya</h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tidak ada task aktif.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Rapat Terbaru</h2>
          {recentMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Belum ada rapat.</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
