import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { getDashboardStats, getMyActiveTasks, getPendingVerifications } from '@/lib/data/dashboard'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DivisionStats } from '@/components/dashboard/DivisionStats'
import { TaskCard } from '@/components/tasks/TaskCard'
import { ContentRequestCard } from '@/components/humas/ContentRequestCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { ContentRequest } from '@/types'

export default async function HumasDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'humas')) redirect('/dashboard')

  const supabase = createServerClient()
  const [stats, myTasks, pendingVerif, pendingRequestsRes] = await Promise.all([
    getDashboardStats(session.userId),
    getMyActiveTasks(session.userId),
    getPendingVerifications(session.userId),
    supabase
      .from('content_requests')
      .select('*, requester:users!content_requests_requested_by_fkey(id, display_name)')
      .in('status', ['requested', 'on_process'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const pendingRequests = (pendingRequestsRes.data ?? []) as ContentRequest[]

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Humas" />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <DivisionStats {...stats} />

        {pendingRequests.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-600">Request Masuk ({pendingRequests.length})</h2>
              <Link href="/humas-request" className="text-xs text-primary hover:underline">Lihat semua →</Link>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(req => <ContentRequestCard key={req.id} request={req} />)}
            </div>
          </section>
        )}

        {pendingVerif.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-amber-600">Perlu Verifikasi ({pendingVerif.length})</h2>
            <div className="space-y-2">
              {pendingVerif.map(task => <TaskCard key={task.id} task={task} showAssignee />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Task Aktif Saya</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/humas-request"><Plus className="h-3 w-3 mr-1" />Request Baru</Link>
            </Button>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Tidak ada task aktif.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
