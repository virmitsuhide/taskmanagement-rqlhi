import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { getDashboardStats, getMyActiveTasks, getRecentMeetings } from '@/lib/data/dashboard'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DivisionStats } from '@/components/dashboard/DivisionStats'
import { TaskCard } from '@/components/tasks/TaskCard'
import { MeetingCard } from '@/components/rapat/MeetingCard'

export default async function DivTrainingDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'div-training')) redirect('/dashboard')

  const [stats, myTasks, recentMeetings] = await Promise.all([
    getDashboardStats(session.userId),
    getMyActiveTasks(session.userId),
    getRecentMeetings(['new_squad']),
  ])

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Div Training" showBack />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <DivisionStats {...stats} />

        <section>
          <h2 className="text-sm font-semibold mb-3">Task Aktif Saya</h2>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tidak ada task aktif.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)}
            </div>
          )}
          <Link href="/tasks" className="text-xs text-primary hover:underline mt-2 inline-block">Lihat semua task →</Link>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">Rapat New Squad Terbaru</h2>
          {recentMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Belum ada rapat.</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
          <Link href="/rapat" className="text-xs text-primary hover:underline mt-2 inline-block">Lihat semua rapat →</Link>
        </section>
      </div>
    </div>
  )
}
