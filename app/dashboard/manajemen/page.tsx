import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard, getBoardDivisions } from '@/lib/auth/permissions'
import { getTeamActiveTasks, getRecentMeetings, getCompletionHistory } from '@/lib/data/dashboard'
import { getBoardTasks } from '@/lib/data/board'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { TeamActivityAnalytics } from '@/components/dashboard/TeamActivityAnalytics'
import { TeamTasksSwitcher } from '@/components/dashboard/TeamTasksSwitcher'
import { CompletionHistory } from '@/components/dashboard/CompletionHistory'
import { MeetingCard } from '@/components/rapat/MeetingCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ManajemenDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'manajemen')) redirect('/dashboard')

  const [teamTasks, completionHistory, boardColumns, recentMeetings] = await Promise.all([
    getTeamActiveTasks(),
    getCompletionHistory(),
    getBoardTasks({ session, scope: 'divisi', divisi: null }),
    getRecentMeetings(['manajemen']),
  ])

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Manajemen" showBack />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Analitik aktivitas pengurus — kartu bisa diklik untuk drill-down */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Analitik Aktivitas Pengurus</h2>
          <TeamActivityAnalytics tasks={teamTasks} />
        </section>

        {/* Tugas tim: bisa ditukar antara daftar pengurus & papan kanban in-place */}
        <TeamTasksSwitcher
          tasks={teamTasks}
          currentUserId={session.userId}
          currentRole={session.role}
          boardColumns={boardColumns}
          divisions={getBoardDivisions(session.role)}
        />

        {/* Riwayat penyelesaian tugas */}
        <section>
          <h2 className="text-sm font-semibold mb-1">History Penyelesaian Tugas</h2>
          <CompletionHistory members={completionHistory} />
        </section>

        {/* Rapat manajemen */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Rapat Manajemen Terbaru</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/rapat/baru"><Plus className="h-3 w-3 mr-1" />Buat Rapat</Link>
            </Button>
          </div>
          {recentMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Belum ada rapat.</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
          <Link href="/rapat" className="text-xs text-primary hover:underline mt-2 inline-block">
            Lihat semua rapat →
          </Link>
        </section>
      </div>
    </div>
  )
}
