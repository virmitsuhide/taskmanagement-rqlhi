'use client'

import { useState } from 'react'
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
  boardColumns: BoardColumn[]
}

type DivisionTab = UserRole | 'all'

// Tab papan kanban per divisi (sesuai permintaan Kepala RQ).
const DIVISION_TABS: DivisionTab[] = [
  'all', 'kepala_rq', 'kumik', 'sdm', 'bendahara',
  'koor_sd', 'koor_smp', 'koor_ekstra', 'humas', 'new_squad',
]

/** Filter kolom papan berdasar divisi (= role assignee). */
function filterColumns(columns: BoardColumn[], division: DivisionTab): BoardColumn[] {
  if (division === 'all') return columns
  return columns.map(col => ({
    ...col,
    tasks: col.tasks.filter(t => t.assignee?.role === division),
  }))
}

/**
 * Ruang "Tugas Tim yang Sedang Berjalan" yang bisa ditukar antara:
 * - daftar pengurus (default), dan
 * - papan kanban (Papan Tugas) dengan tab per divisi, muncul in-place tanpa pindah halaman.
 */
export function TeamTasksSwitcher({ tasks, currentUserId, boardColumns }: Props) {
  const [view, setView] = useState<'list' | 'board'>('list')
  const [division, setDivision] = useState<DivisionTab>('all')
  const isBoard = view === 'board'

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

      {isBoard ? (
        <div>
          {/* Tab per divisi */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {DIVISION_TABS.map(d => {
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

          {/* key=division → remount board dengan kolom terfilter */}
          <KanbanBoard key={division} columns={filterColumns(boardColumns, division)} />
        </div>
      ) : (
        <TeamMembersActivity tasks={tasks} currentUserId={currentUserId} />
      )}
    </section>
  )
}
