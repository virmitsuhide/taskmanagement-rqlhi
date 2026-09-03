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
import { ChevronRight, LayoutTemplate } from 'lucide-react'
import { requestStatus, liveRequests } from '@/lib/humas/request-status'
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
    // Tidak menyaring lewat kolom `status`: sejak 0033 kolom itu tidak lagi
    // ditulis, jadi request yang tugasnya sudah selesai pun tetap tertinggal
    // di 'requested' dan akan ikut terhitung sebagai pekerjaan yang menganggur.
    // Yang menentukan sekarang status tugasnya, dan itu disaring di bawah.
    supabase
      .from('content_requests')
      .select('*, requester:users!requested_by(id, display_name), task:tasks!task_id(id, status, priority, problem_type, assigned_to, assigned_by, deleted_at)')
      .order('created_at', { ascending: false }),
  ])

  // liveRequests() dulu, baru saring status: request yang tugasnya sudah
  // dihapus dianggap batal dan tidak lagi terhitung sebagai pekerjaan masuk.
  const pendingRequests = liveRequests((pendingRequestsRes.data ?? []) as ContentRequest[])
    .filter(r => requestStatus(r) !== 'finish')
    .slice(0, 5)

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Humas" showBack />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <DivisionStats {...stats} />

        <Link
          href="/humas/beranda"
          className="flex items-center gap-3.5 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
        >
          <span className="inline-flex items-center justify-center rounded-lg p-2.5 bg-primary/10">
            <LayoutTemplate className="h-4 w-4 text-primary" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold">Kelola Beranda</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Seksi yang tampil, teks header &amp; footer, dan profil guru
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>

        {pendingRequests.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-warning">Request Masuk ({pendingRequests.length})</h2>
              <Link href="/humas-request" className="text-xs text-primary hover:underline">Lihat semua →</Link>
            </div>
            <div className="space-y-2">
              {pendingRequests.map(req => <ContentRequestCard key={req.id} request={req} />)}
            </div>
          </section>
        )}

        {pendingVerif.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 text-warning">Perlu Verifikasi ({pendingVerif.length})</h2>
            <div className="space-y-2">
              {pendingVerif.map(task => <TaskCard key={task.id} task={task} showAssignee />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Task Aktif Saya</h2>
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
