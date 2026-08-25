'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeamMembersActivity } from './TeamMembersActivity'
import { KanbanBoard } from '@/app/tasks/board/KanbanBoard'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { Task, UserRole } from '@/types'
import type { BoardColumn } from '@/lib/data/board'

interface Props {
  tasks: Task[]
  currentUserId: string
  currentRole: UserRole
  boardColumns: BoardColumn[]
  /** Divisi yang boleh dilihat — berasal dari getBoardDivisions(), sama dengan /tasks/board. */
  divisions: UserRole[]
}

type DivisionTab = UserRole | 'all'

/** Filter kolom papan berdasar divisi (= role assignee). */
function filterColumns(columns: BoardColumn[], division: DivisionTab): BoardColumn[] {
  if (division === 'all') return columns
  return columns.map(col => ({
    ...col,
    tasks: col.tasks.filter(t => t.assignee?.role === division),
  }))
}

/** Filter daftar tugas tim dengan aturan yang sama seperti papan. */
function filterTasks(tasks: Task[], division: DivisionTab): Task[] {
  if (division === 'all') return tasks
  return tasks.filter(t => t.assignee?.role === division)
}

/**
 * Ruang "Tugas Tim yang Sedang Berjalan" yang bisa ditukar antara:
 * - daftar pengurus (default), dan
 * - papan kanban (Papan Tugas), muncul in-place tanpa pindah halaman.
 *
 * Tab divisi berlaku untuk KEDUA tampilan, dan daftar divisinya berasal dari
 * sumber yang sama dengan halaman /tasks/board — sebelumnya keduanya punya
 * daftar sendiri sehingga isinya bisa berbeda untuk orang yang sama.
 */
export function TeamTasksSwitcher({ tasks, currentUserId, currentRole, boardColumns, divisions }: Props) {
  const [view, setView] = useState<'list' | 'board'>('list')
  const [division, setDivision] = useState<DivisionTab>('all')
  const isBoard = view === 'board'

  const tabs: DivisionTab[] = ['all', ...divisions]
  const visibleTasks = filterTasks(tasks, division)

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h2 className="text-sm font-semibold">Tugas Tim yang Sedang Berjalan</h2>
          <p className="text-xs text-muted-foreground">
            {isBoard ? 'Tarik kartu antar kolom untuk ubah status' : 'Klik pengurus untuk lihat tugas aktifnya'}
          </p>
        </div>
        {isBoard ? (
          <Button size="sm" variant="outline" onClick={() => setView('list')}>
            <Users className="h-3 w-3 mr-1" />Tugas Tim
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setView('board')}>
            <LayoutGrid className="h-3 w-3 mr-1" />Papan Tugas
          </Button>
        )}
      </div>

      {/* Tab divisi — berlaku untuk daftar pengurus maupun papan kanban */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {tabs.map(d => {
            const active = division === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDivision(d)}
                aria-pressed={active}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground hover:text-foreground border-border',
                )}
              >
                {d === 'all' ? 'Semua' : ROLE_LABELS[d]}
              </button>
            )
          })}
        </div>
      )}

      {isBoard ? (
        <KanbanBoard
          key={division}
          columns={filterColumns(boardColumns, division)}
          currentUserId={currentUserId}
          currentRole={currentRole}
        />
      ) : (
        <TeamMembersActivity tasks={visibleTasks} currentUserId={currentUserId} />
      )}

      {/*
        Papan di sini hanya bercakupan divisi — cakupan pribadi tidak ikut, dan
        ruangnya sempit karena berbagi halaman dengan analitik. Tautan ini
        mengantar ke papan penuh yang punya kedua cakupan itu.

        Ditaruh di dalam section, bukan sebagai saudara di halaman, supaya
        jaraknya rapat ke isi tugas — kalau di luar, jarak antar-section membuat
        tautannya terbaca sebagai blok tersendiri, bukan lanjutan dari tugas.
      */}
      <Link href="/tasks/board" className="text-xs text-primary hover:underline mt-2 inline-block">
        Buka papan tugas →
      </Link>
    </section>
  )
}
