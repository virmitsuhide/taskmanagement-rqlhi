import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canViewAnalytics, ROLE_LABELS } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Task, TaskStatus, User } from '@/types'

const ACTIVE_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'returned']

interface Row {
  user: User
  jangkaPanjang: Task[]
  jangkaPendek: Task[]
  followUp: Task[]
  penugasan: Task[]
  sedang: Task[]
  selesai: Task[]
}

export default async function PrMatrixPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canViewAnalytics(session.role)) redirect('/tasks')

  const supabase = createServerClient()

  // Ambil semua user pengurus
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, role')
    .order('display_name')
  const userList = (users ?? []) as User[]

  // Ambil semua task dengan assignee+assigner
  const { data: taskRows } = await supabase
    .from('tasks')
    .select('*, assignee:users!assigned_to(id, display_name, role), assigner:users!assigned_by(id, display_name, role)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  const tasks = (taskRows ?? []) as Task[]

  // Group tasks per user
  const rows: Row[] = userList.map(u => {
    const myTasks = tasks.filter(t => t.assigned_to === u.id)
    const active = myTasks.filter(t => ACTIVE_STATUSES.includes(t.status))
    return {
      user: u,
      // Pribadi (assigned_by sendiri)
      jangkaPanjang: active.filter(t => t.assigned_by === u.id && t.source_type === 'mandiri' && t.priority === 'jangka_panjang'),
      jangkaPendek: active.filter(t => t.assigned_by === u.id && t.source_type === 'mandiri' && t.priority !== 'jangka_panjang'),
      // Follow up rapat
      followUp: active.filter(t => t.source_type === 'rapat'),
      // Penugasan dari atasan
      penugasan: active.filter(t => t.assigned_by !== u.id && t.source_type === 'mandiri'),
      // Status cross-cutting (semua sumber)
      sedang: myTasks.filter(t => t.status === 'in_progress'),
      selesai: myTasks.filter(t => t.status === 'done'),
    }
  })

  // Hanya tampilkan user yang punya minimal 1 task ATAU role utama (filter "kosong total" bisa di-toggle nanti)
  const visibleRows = rows.filter(r =>
    r.jangkaPanjang.length + r.jangkaPendek.length + r.followUp.length +
    r.penugasan.length + r.sedang.length + r.selesai.length > 0,
  )

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="PR Manajemen"
        breadcrumbs={[{ label: 'Tugas', href: '/tasks' }, { label: 'PR Manajemen' }]}
        ownH1
      />
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">PR Manajemen</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Matriks pekerjaan rumah lintas divisi
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Tugas Saya</Link>
          </Button>
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Belum ada tugas tercatat untuk satu pun pengurus.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>No</Th>
                  <Th sticky>Nama</Th>
                  <Th>Jangka Panjang</Th>
                  <Th>Jangka Pendek</Th>
                  <Th>Dari Follow Up</Th>
                  <Th>Dari Penugasan</Th>
                  <Th>Sedang Dikerjakan</Th>
                  <Th>Selesai</Th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={row.user.id} className="border-b last:border-0 align-top">
                    <Td>{i + 1}</Td>
                    <Td sticky>
                      <p className="font-medium">{row.user.display_name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{ROLE_LABELS[row.user.role]}</p>
                    </Td>
                    <Cell tasks={row.jangkaPanjang} tone="amber" />
                    <Cell tasks={row.jangkaPendek} tone="blue" />
                    <Cell tasks={row.followUp} tone="violet" />
                    <Cell tasks={row.penugasan} tone="emerald" />
                    <Cell tasks={row.sedang} tone="indigo" />
                    <Cell tasks={row.selesai} tone="gray" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          💡 Klik judul tugas untuk buka detail. Kolom <em>Sedang Dikerjakan</em> &amp; <em>Selesai</em> berisi tugas dari semua sumber.
        </p>
      </div>
    </div>
  )
}

const TONE: Record<string, string> = {
  amber: '#d97706', blue: '#2563eb', violet: '#7c3aed',
  emerald: '#059669', indigo: '#4f46e5', gray: '#6b7280',
}

function Cell({ tasks, tone }: { tasks: Task[]; tone: keyof typeof TONE }) {
  const color = TONE[tone]
  if (tasks.length === 0) {
    return <td className="px-3 py-2 align-top min-w-[160px]"><span className="text-xs text-muted-foreground/40">—</span></td>
  }
  return (
    <td className="px-3 py-2 align-top min-w-[180px] max-w-[260px]">
      <div className="space-y-1">
        {tasks.slice(0, 4).map(t => (
          <Link
            key={t.id}
            href={`/tasks/${t.id}`}
            className="block text-xs leading-snug hover:underline"
            title={t.title}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: color }} />
            <span className={t.status === 'done' ? 'line-through text-muted-foreground' : ''}>
              {t.title.length > 60 ? t.title.slice(0, 60) + '…' : t.title}
            </span>
          </Link>
        ))}
        {tasks.length > 4 && (
          <p className="text-[11px] text-muted-foreground italic">+{tasks.length - 4} lainnya</p>
        )}
      </div>
    </td>
  )
}

function Th({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${sticky ? 'sticky left-0 bg-muted/50' : ''}`}
    >
      {children}
    </th>
  )
}

function Td({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <td className={`px-3 py-2 ${sticky ? 'sticky left-0 bg-card' : ''} min-w-[140px]`}>{children}</td>
  )
}
