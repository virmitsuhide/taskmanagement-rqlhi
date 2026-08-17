import { createServerClient } from '@/lib/supabase/server'
import { getBoardDivisions } from '@/lib/auth/permissions'
import type { Task, TaskStatus, UserRole, SessionData } from '@/types'

export type BoardScope = 'personal' | 'divisi'
export type BoardColumnKey = 'todo' | 'in_progress' | 'problem' | 'submitted' | 'done'

export interface BoardColumn {
  key: BoardColumnKey
  label: string
  statuses: TaskStatus[]
  tasks: Task[]
}

// 'returned' (dikembalikan setelah review) jatuh kembali ke To Do.
export const BOARD_COLUMNS: { key: BoardColumnKey; label: string; statuses: TaskStatus[] }[] = [
  { key: 'todo',        label: 'To Do',       statuses: ['todo', 'returned'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { key: 'problem',     label: 'Problem',     statuses: ['problem'] },
  { key: 'submitted',   label: 'Review',      statuses: ['submitted'] },
  { key: 'done',        label: 'Done',        statuses: ['done'] },
]

/** Jumlah task 'done' maksimum yang ditampilkan di kolom (hindari kolom membengkak). */
const DONE_LIMIT = 30

interface GetBoardOpts {
  session: SessionData
  scope: BoardScope
  divisi?: UserRole | null
}

export async function getBoardTasks({ session, scope, divisi }: GetBoardOpts): Promise<BoardColumn[]> {
  const supabase = createServerClient()
  const selectCols = '*, assignee:users!assigned_to(id, display_name, role), assigner:users!assigned_by(id, display_name, role)'

  let tasks: Task[] = []

  if (scope === 'personal') {
    const { data } = await supabase
      .from('tasks')
      .select(selectCols)
      .eq('assigned_to', session.userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    tasks = (data ?? []) as Task[]
  } else {
    // Divisi board — divisi = role assignee.
    //
    // Cakupannya ditentukan sepenuhnya oleh getBoardDivisions(): papan ini
    // memang untuk melihat aktivitas divisi, bukan tugas pribadi (itu sudah
    // dilayani scope 'personal'). Dulu ada filter tambahan "hanya task yang
    // saya delegasikan / saya terima" — filter itu membuat divisi yang baru
    // dibuka untuk koor (New Squad & Humas) selalu tampil kosong, karena task
    // divisi tersebut umumnya diberikan oleh SDM atau kepala RQ.
    const allowedDivisions = getBoardDivisions(session.role)
    if (allowedDivisions.length === 0) return columnize([])

    const { data } = await supabase
      .from('tasks')
      .select(selectCols)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    let rows = (data ?? []) as Task[]

    // Filter berdasar divisi (role assignee) yang boleh dilihat
    rows = rows.filter(t => {
      const role = t.assignee?.role
      if (!role) return false
      return allowedDivisions.includes(role)
    })

    // Filter chip divisi spesifik
    if (divisi) {
      rows = rows.filter(t => t.assignee?.role === divisi)
    }

    tasks = rows
  }

  return columnize(tasks)
}

function columnize(tasks: Task[]): BoardColumn[] {
  return BOARD_COLUMNS.map(col => {
    let colTasks = tasks.filter(t => col.statuses.includes(t.status))
    if (col.key === 'done') {
      colTasks = colTasks
        .sort((a, b) => (b.verified_at ?? b.updated_at).localeCompare(a.verified_at ?? a.updated_at))
        .slice(0, DONE_LIMIT)
    }
    return { ...col, tasks: colTasks }
  })
}
