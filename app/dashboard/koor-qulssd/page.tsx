import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewDashboard } from '@/lib/auth/permissions'
import { getDashboardStats, getMyActiveTasks, getRecentMeetings, getPendingVerifications } from '@/lib/data/dashboard'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { DivisionStats } from '@/components/dashboard/DivisionStats'
import { TaskCard } from '@/components/tasks/TaskCard'
import { MeetingCard } from '@/components/rapat/MeetingCard'
import { Button } from '@/components/ui/button'
import { BookMarked, Upload } from 'lucide-react'

/**
 * Dashboard Koor QULS SD.
 *
 * Sengaja tidak memuat kartu ujian: pengajuan ujian masih dipegang koor SD
 * untuk seluruh unit SD (getUjianUnits), jadi menampilkannya di sini hanya
 * akan menjanjikan sesuatu yang tombolnya tidak ada.
 *
 * Sebagai gantinya dua pintasan yang memang pekerjaan hariannya: menata
 * kelompok dan mengisinya.
 */
export default async function KoorQulsSdDashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewDashboard(session.role, 'koor-qulssd')) redirect('/dashboard')

  const [stats, myTasks, pendingVerif, recentMeetings] = await Promise.all([
    getDashboardStats(session.userId),
    getMyActiveTasks(session.userId),
    getPendingVerifications(session.userId),
    // Rapat koor SD ikut ditampilkan: kelompok QULS duduk di unit dan sesi
    // yang sama, jadi keputusannya kerap menyangkut anak-anak di sini juga.
    getRecentMeetings(['koor_sd', 'kumik']),
  ])

  return (
    <div>
      <DashboardHeader displayName={session.displayName} role={session.role} title="Dashboard Koor QULS SD" showBack />
      <div className="max-w-4xl space-y-6 p-4 md:p-6">
        <DivisionStats {...stats} />

        <section className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/halaqoh"><BookMarked className="mr-1 h-3.5 w-3.5" />Kelompok QULS SD</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/halaqoh/impor"><Upload className="mr-1 h-3.5 w-3.5" />Impor Pembagian</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/siswa/impor"><Upload className="mr-1 h-3.5 w-3.5" />Impor Siswa</Link>
          </Button>
        </section>

        {pendingVerif.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-warning">Perlu Verifikasi ({pendingVerif.length})</h2>
            <div className="space-y-2">
              {pendingVerif.map(task => <TaskCard key={task.id} task={task} showAssignee />)}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold">Task Aktif Saya</h2>
          {myTasks.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Tidak ada task aktif.</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} showAssignee={false} showAssigner />)}
            </div>
          )}
          <Link href="/tasks" className="mt-2 inline-block text-xs text-primary hover:underline">Lihat semua task →</Link>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Rapat Terbaru</h2>
          {recentMeetings.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Belum ada rapat.</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map(m => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
          <Link href="/rapat" className="mt-2 inline-block text-xs text-primary hover:underline">Lihat semua rapat →</Link>
        </section>
      </div>
    </div>
  )
}
