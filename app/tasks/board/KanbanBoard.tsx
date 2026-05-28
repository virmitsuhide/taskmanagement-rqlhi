'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateTaskStatusAction } from '@/app/actions/tasks'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { Task, TaskStatus } from '@/types'
import type { BoardColumn, BoardColumnKey } from '@/lib/data/board'

const COLUMN_ACCENT: Record<BoardColumnKey, string> = {
  todo: '#94a3b8',
  in_progress: '#2563eb',
  submitted: '#d97706',
  done: '#16a34a',
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  mendesak:       { bg: '#fee2e2', color: '#b91c1c', label: 'Mendesak' },
  jangka_panjang: { bg: '#fef3c7', color: '#92400e', label: 'Jangka Panjang' },
  normal:         { bg: '#dbeafe', color: '#1d4ed8', label: 'Normal' },
}

/** Tentukan status target ketika kartu dijatuhkan di sebuah kolom. */
function columnToStatus(target: BoardColumnKey, current: TaskStatus): TaskStatus {
  if (target === 'todo') return current === 'submitted' ? 'returned' : 'todo'
  if (target === 'in_progress') return 'in_progress'
  if (target === 'submitted') return 'submitted'
  return 'done'
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function KanbanBoard({ columns: initialColumns }: { columns: BoardColumn[] }) {
  const router = useRouter()
  const [columns, setColumns] = useState(initialColumns)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<BoardColumnKey | null>(null)
  const didDragRef = useRef(false)

  function findTask(id: string): { task: Task; col: BoardColumnKey } | null {
    for (const c of columns) {
      const t = c.tasks.find(t => t.id === id)
      if (t) return { task: t, col: c.key }
    }
    return null
  }

  async function handleDrop(targetCol: BoardColumnKey) {
    setOverCol(null)
    const id = dragId
    setDragId(null)
    if (!id) return

    const found = findTask(id)
    if (!found) return
    if (found.col === targetCol) return

    const newStatus = columnToStatus(targetCol, found.task.status)

    // Optimistic move
    const prev = columns
    setColumns(cols => {
      const moved = { ...found.task, status: newStatus }
      return cols.map(c => {
        if (c.key === found.col) return { ...c, tasks: c.tasks.filter(t => t.id !== id) }
        if (c.key === targetCol) return { ...c, tasks: [moved, ...c.tasks] }
        return c
      })
    })

    const res = await updateTaskStatusAction(id, newStatus)
    if (res?.error) {
      setColumns(prev) // revert
      toast.error(res.error)
    } else {
      const label =
        newStatus === 'returned' ? 'dikembalikan'
        : newStatus === 'done' ? 'ditandai selesai'
        : newStatus === 'submitted' ? 'dikirim untuk review'
        : newStatus === 'in_progress' ? 'mulai dikerjakan'
        : 'dipindahkan'
      toast.success(`Task ${label}`)
      router.refresh()
    }
  }

  function openTask(id: string) {
    if (didDragRef.current) return
    router.push(`/tasks/${id}`)
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 items-start">
      {columns.map(col => (
        <div
          key={col.key}
          onDragOver={e => { e.preventDefault(); setOverCol(col.key) }}
          onDragLeave={() => setOverCol(c => (c === col.key ? null : c))}
          onDrop={() => handleDrop(col.key)}
          className="rounded-xl border bg-card p-3 min-h-[300px] transition-colors"
          style={overCol === col.key ? { borderColor: COLUMN_ACCENT[col.key], background: 'color-mix(in srgb, ' + COLUMN_ACCENT[col.key] + ' 6%, transparent)' } : undefined}
        >
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ background: COLUMN_ACCENT[col.key] }} />
              {col.label}
            </div>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>

          <div className="space-y-2">
            {col.tasks.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-6">Kosong</p>
            )}
            {col.tasks.map(task => {
              const pr = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.normal
              const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => { setDragId(task.id); didDragRef.current = false }}
                  onDrag={() => { didDragRef.current = true }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); setTimeout(() => { didDragRef.current = false }, 50) }}
                  onClick={() => openTask(task.id)}
                  className="rounded-lg border bg-background p-3 cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-sm transition"
                  style={dragId === task.id ? { opacity: 0.5 } : undefined}
                >
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {task.assignee?.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fdf6e3', color: '#b8860b' }}>
                        {ROLE_LABELS[task.assignee.role]}
                      </span>
                    )}
                    {task.priority !== 'normal' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.color }}>{pr.label}</span>
                    )}
                    {task.status === 'returned' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>Dikembalikan</span>
                    )}
                  </div>

                  <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                    <span className={overdue ? 'text-destructive font-medium' : ''}>
                      {task.due_date
                        ? (overdue ? '⚠ ' : '🗓 ') + new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                        : ''}
                    </span>
                    {task.assignee && (
                      <span
                        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium"
                        title={task.assignee.display_name}
                      >
                        {initials(task.assignee.display_name)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
