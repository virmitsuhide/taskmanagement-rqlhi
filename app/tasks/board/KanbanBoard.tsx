'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateTaskStatusAction, updateTaskProblemAction } from '@/app/actions/tasks'
import {
  ROLE_LABELS, TASK_PRIORITY_LABELS, TASK_WEIGHT_LABELS, TASK_PROBLEM_LABELS,
  canMoveTaskOnBoard,
} from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus, TaskProblemType, UserRole } from '@/types'
import type { BoardColumn, BoardColumnKey } from '@/lib/data/board'

const COLUMN_ACCENT: Record<BoardColumnKey, string> = {
  todo: '#94a3b8',
  in_progress: '#2563eb',
  problem: '#dc2626',
  submitted: '#d97706',
  done: '#16a34a',
}

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: '#fee2e2', color: '#b91c1c' },
  middle: { bg: '#dbeafe', color: '#1d4ed8' },
  low:    { bg: '#f1f5f9', color: '#475569' },
}

const WEIGHT_STYLE: Record<string, { bg: string; color: string }> = {
  hard:   { bg: '#ede9fe', color: '#6d28d9' },
  medium: { bg: '#f1f5f9', color: '#475569' },
  easy:   { bg: '#dcfce7', color: '#15803d' },
}

/**
 * Warna kartu di kolom Problem dibedakan per jenis hambatan, supaya Kepala RQ
 * bisa memindai jenis masalah tanpa membuka satu per satu.
 */
const PROBLEM_STYLE: Record<TaskProblemType, { border: string; bg: string; dot: string }> = {
  bottleneck: { border: '#f59e0b', bg: 'color-mix(in srgb, #f59e0b 8%, transparent)', dot: '#f59e0b' },
  blocked:    { border: '#dc2626', bg: 'color-mix(in srgb, #dc2626 8%, transparent)', dot: '#dc2626' },
  wip_limit:  { border: '#7c3aed', bg: 'color-mix(in srgb, #7c3aed 8%, transparent)', dot: '#7c3aed' },
  others:     { border: '#64748b', bg: 'color-mix(in srgb, #64748b 8%, transparent)', dot: '#64748b' },
}

const PROBLEM_ORDER: TaskProblemType[] = ['bottleneck', 'blocked', 'wip_limit', 'others']

/** Status target ketika kartu dijatuhkan di sebuah kolom. */
function columnToStatus(target: BoardColumnKey, current: TaskStatus): TaskStatus {
  if (target === 'todo') return current === 'submitted' ? 'returned' : 'todo'
  if (target === 'in_progress') return 'in_progress'
  if (target === 'problem') return 'problem'
  if (target === 'submitted') return 'submitted'
  return 'done'
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

interface Props {
  columns: BoardColumn[]
  currentUserId: string
  currentRole: UserRole
}

export function KanbanBoard({ columns: initialColumns, currentUserId, currentRole }: Props) {
  const router = useRouter()
  const [columns, setColumns] = useState(initialColumns)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<BoardColumnKey | null>(null)
  const didDragRef = useRef(false)

  // Kolom dari server berubah (mis. ganti tab divisi / router.refresh) → ikut.
  useEffect(() => { setColumns(initialColumns) }, [initialColumns])

  /** Boleh digeser oleh orang ini? Pelaksana, pemberi tugas, atau Kepala RQ. */
  function canMove(task: Task): boolean {
    return canMoveTaskOnBoard(
      currentRole,
      task.assigned_to === currentUserId,
      task.assigned_by === currentUserId,
    )
  }

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

    if (!canMove(found.task)) {
      toast.error('Hanya pelaksana, pemberi tugas, atau Kepala RQ yang bisa memindahkan kartu ini.')
      return
    }

    const newStatus = columnToStatus(targetCol, found.task.status)

    // Optimistic move — kartu yang masuk Problem tanpa jenis diberi 'others'.
    const prev = columns
    setColumns(cols => {
      const moved: Task = {
        ...found.task,
        status: newStatus,
        problem_type: newStatus === 'problem' ? (found.task.problem_type ?? 'others') : null,
      }
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
      return
    }

    const label =
      newStatus === 'returned' ? 'dikembalikan'
      : newStatus === 'done' ? 'ditandai selesai'
      : newStatus === 'submitted' ? 'dikirim untuk review'
      : newStatus === 'problem' ? 'ditandai bermasalah'
      : newStatus === 'in_progress' ? 'mulai dikerjakan'
      : 'dipindahkan'
    toast.success(`Task ${label}`)
    router.refresh()
  }

  async function handleProblemType(taskId: string, type: TaskProblemType) {
    const prev = columns
    setColumns(cols => cols.map(c => ({
      ...c,
      tasks: c.tasks.map(t => (t.id === taskId ? { ...t, problem_type: type } : t)),
    })))
    const res = await updateTaskProblemAction(taskId, type)
    if (res?.error) {
      setColumns(prev)
      toast.error(res.error)
    } else {
      router.refresh()
    }
  }

  function openTask(id: string) {
    if (didDragRef.current) return
    router.push(`/tasks/${id}`)
  }

  return (
    <div className="grid gap-3 items-start md:grid-cols-2 xl:grid-cols-5">
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
              const movable = canMove(task)
              const pr = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.middle
              const wt = WEIGHT_STYLE[task.weight] ?? WEIGHT_STYLE.medium
              const problem = col.key === 'problem'
                ? PROBLEM_STYLE[task.problem_type ?? 'others']
                : null
              // Kartu di kolom Review yang menunggu review orang ini.
              const needsMyReview =
                col.key === 'submitted' &&
                (task.assigned_by === currentUserId || currentRole === 'kepala_rq')
              const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString())

              return (
                <div
                  key={task.id}
                  draggable={movable}
                  onDragStart={() => { if (!movable) return; setDragId(task.id); didDragRef.current = false }}
                  onDrag={() => { didDragRef.current = true }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); setTimeout(() => { didDragRef.current = false }, 50) }}
                  onClick={() => openTask(task.id)}
                  title={movable ? undefined : 'Hanya pelaksana, pemberi tugas, atau Kepala RQ yang bisa memindahkan kartu ini'}
                  className={cn(
                    'rounded-lg border p-3 transition hover:shadow-sm',
                    movable ? 'cursor-grab active:cursor-grabbing hover:border-foreground/30' : 'cursor-pointer',
                    !problem && 'bg-background',
                  )}
                  style={{
                    ...(problem ? { borderColor: problem.border, background: problem.bg } : {}),
                    ...(dragId === task.id ? { opacity: 0.5 } : {}),
                    ...(needsMyReview ? { boxShadow: `inset 3px 0 0 ${COLUMN_ACCENT.submitted}` } : {}),
                  }}
                >
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {task.assignee?.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fdf6e3', color: '#b8860b' }}>
                        {ROLE_LABELS[task.assignee.role]}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: pr.bg, color: pr.color }}>
                      {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: wt.bg, color: wt.color }}>
                      {TASK_WEIGHT_LABELS[task.weight] ?? task.weight}
                    </span>
                    {task.status === 'returned' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c' }}>Dikembalikan</span>
                    )}
                    {needsMyReview && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Perlu kamu review
                      </span>
                    )}
                  </div>

                  <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </p>

                  {/* Jenis hambatan — hanya di kolom Problem, bisa diubah langsung */}
                  {problem && (
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      {movable ? (
                        <select
                          value={task.problem_type ?? 'others'}
                          onChange={e => handleProblemType(task.id, e.target.value as TaskProblemType)}
                          aria-label={`Jenis hambatan untuk ${task.title}`}
                          className="w-full rounded-md border bg-background px-2 py-1 text-[11px] font-medium"
                          style={{ borderColor: problem.border, color: problem.dot }}
                        >
                          {PROBLEM_ORDER.map(p => (
                            <option key={p} value={p}>{TASK_PROBLEM_LABELS[p]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: problem.dot }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: problem.dot }} aria-hidden />
                          {TASK_PROBLEM_LABELS[task.problem_type ?? 'others']}
                        </span>
                      )}
                    </div>
                  )}

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
