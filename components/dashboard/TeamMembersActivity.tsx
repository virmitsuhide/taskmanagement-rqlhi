'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TaskCard } from '@/components/tasks/TaskCard'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { isDueSoon } from '@/lib/tasks/urgency'
import { cn } from '@/lib/utils'
import type { Task, User, UserRole } from '@/types'

interface Props {
  tasks: Task[]
  currentUserId: string
}

interface MemberGroup {
  user: Pick<User, 'id' | 'display_name' | 'role'>
  tasks: Task[]
}

// Peringkat jabatan (0 = paling tinggi). new_squad paling rendah → tampil terakhir.
const ROLE_RANK: Record<UserRole, number> = {
  kepala_rq: 0, kumik: 1, sdm: 2, bendahara: 3,
  koor_sd: 4, koor_smp: 5, koor_ekstra: 6, humas: 7, div_training: 8, new_squad: 9,
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Penanda kegentingan pada tiap card: merah=mendesak, orange=deadline dekat, biru=perlu verifikasi.
const URGENCY: { key: string; label: string; dot: string; match: (t: Task) => boolean }[] = [
  { key: 'mendesak',   label: 'prioritas high',  dot: 'bg-destructive', match: t => t.priority === 'high' },
  { key: 'deadline',   label: 'deadline dekat',  dot: 'bg-warning',     match: isDueSoon },
  { key: 'verifikasi', label: 'perlu verifikasi', dot: 'bg-info',        match: t => t.status === 'submitted' },
]

export function TeamMembersActivity({ tasks, currentUserId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Kelompokkan per pengurus (assignee).
  const byMember = new Map<string, MemberGroup>()
  for (const task of tasks) {
    const u = task.assignee
    if (!u) continue
    const group = byMember.get(u.id) ?? { user: { id: u.id, display_name: u.display_name, role: u.role }, tasks: [] }
    group.tasks.push(task)
    byMember.set(u.id, group)
  }

  // Urutan: diri sendiri (me) paling depan, lalu berdasar peringkat jabatan (new_squad terakhir).
  const members = [...byMember.values()].sort((a, b) => {
    if (a.user.id === currentUserId) return -1
    if (b.user.id === currentUserId) return 1
    const rankDiff = ROLE_RANK[a.user.role] - ROLE_RANK[b.user.role]
    if (rankDiff !== 0) return rankDiff
    return b.tasks.length - a.tasks.length
  })

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Belum ada pengurus dengan tugas aktif.</p>
  }

  const selected = members.find(m => m.user.id === selectedId) ?? null

  return (
    <div>
      {/* Legenda penanda kegentingan */}
      <div className="flex items-center gap-3 mb-3 text-[11px] text-muted-foreground flex-wrap">
        {URGENCY.map(u => (
          <span key={u.key} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', u.dot)} aria-hidden />
            {u.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {members.map(m => {
          const isOpen = selectedId === m.user.id
          const isMe = m.user.id === currentUserId
          return (
            <button
              key={m.user.id}
              type="button"
              onClick={() => setSelectedId(isOpen ? null : m.user.id)}
              aria-pressed={isOpen}
              className={cn(
                'text-left rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isOpen && 'ring-2 ring-primary',
              )}
            >
              <Card className={cn('h-full', isMe && 'ring-1 ring-primary/40')}>
                <CardContent>
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(m.user.display_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {m.user.display_name}
                        {isMe && <span className="text-primary font-normal"> (me)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[m.user.role]}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                  </div>
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{m.tasks.length} tugas</span>
                    <div className="flex items-center gap-2">
                      {URGENCY.map(u => {
                        const n = m.tasks.filter(u.match).length
                        if (n === 0) return null
                        return (
                          <span key={u.key} className="flex items-center gap-1 text-xs font-medium" title={`${n} ${u.label}`}>
                            <span className={cn('h-2 w-2 rounded-full', u.dot)} aria-hidden />
                            {n}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Area bawah: aktivitas pengurus terpilih */}
      {selected && (
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold mb-3">
            Tugas aktif — {selected.user.display_name}
            {selected.user.id === currentUserId && <span className="text-primary font-normal"> (me)</span>}
          </h3>
          <div className="space-y-2">
            {selected.tasks.map(task => (
              <TaskCard key={task.id} task={task} showAssignee={false} showAssigner hash="diskusi" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
