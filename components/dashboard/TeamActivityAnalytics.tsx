'use client'

import { useState } from 'react'
import { AlertCircle, Clock, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TaskCard } from '@/components/tasks/TaskCard'
import { isDueSoon } from '@/lib/tasks/urgency'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

interface Props {
  tasks: Task[]
}

type CategoryKey = 'mendesak' | 'deadline' | 'verifikasi' | 'problem'

interface Category {
  key: CategoryKey
  label: string
  icon: React.ReactNode
  tone: string
  match: (t: Task) => boolean
}

/**
 * Empat kartu ini semuanya bertanya "apa yang butuh perhatian?", jadi isinya
 * harus keadaan yang menuntut tindakan.
 *
 * "Sedang Dikerjakan" dulu menempati petak terakhir, dan itu satu-satunya kartu
 * yang justru menandakan semuanya baik-baik saja — angkanya naik-turun tanpa
 * ada yang perlu diperbuat. Tempatnya digantikan tugas berstatus 'problem':
 * pelaksananya sudah menyatakan tertahan, dan itu justru satu-satunya keadaan
 * yang tidak bisa selesai sendiri tanpa campur tangan manajemen.
 *
 * Warnanya destructive, sama dengan kolom Problem di papan tugas — satu keadaan
 * sebaiknya berwarna sama di mana pun ia muncul. Ikonnya segitiga, bukan
 * lingkaran seperti "Prioritas High", supaya keduanya tetap bisa dibedakan
 * sekilas meski sewarna.
 */
const CATEGORIES: Category[] = [
  { key: 'mendesak',   label: 'Prioritas High',   icon: <AlertCircle className="h-4 w-4 text-destructive" />, tone: 'text-destructive', match: t => t.priority === 'high' },
  { key: 'deadline',   label: 'Deadline Dekat',   icon: <Clock className="h-4 w-4 text-warning" />,           tone: 'text-warning',     match: isDueSoon },
  { key: 'verifikasi', label: 'Perlu Verifikasi', icon: <CheckCircle2 className="h-4 w-4 text-info" />,        tone: 'text-info',        match: t => t.status === 'submitted' },
  { key: 'problem',    label: 'Ada Kendala',      icon: <AlertTriangle className="h-4 w-4 text-destructive" />, tone: 'text-destructive', match: t => t.status === 'problem' },
]

export function TeamActivityAnalytics({ tasks }: Props) {
  const [selected, setSelected] = useState<CategoryKey | null>(null)

  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c.key, tasks.filter(c.match)]),
  ) as Record<CategoryKey, Task[]>

  const activeCat = CATEGORIES.find(c => c.key === selected)
  const activeTasks = selected ? counts[selected] : []

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map(cat => {
          const list = counts[cat.key]
          const isOpen = selected === cat.key
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelected(isOpen ? null : cat.key)}
              aria-pressed={isOpen}
              className={cn(
                'text-left rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isOpen && 'ring-2 ring-primary',
              )}
            >
              <Card className={cn('h-full', list.length > 0 && !isOpen && 'ring-primary/30')}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {cat.icon}
                    <span className="text-2xl font-bold">{list.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {isOpen ? 'Klik untuk tutup' : 'Klik untuk lihat'}
                  </p>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Drill-down: daftar tugas dalam kategori terpilih */}
      {activeCat && (
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            {activeCat.icon}
            <h3 className={cn('text-sm font-semibold', activeCat.tone)}>
              {activeCat.label} ({activeTasks.length})
            </h3>
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Tidak ada tugas pada kategori ini.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Klik tugas untuk membuka ruang diskusi & mengirim pesan ke penanggung jawab.
              </p>
              <div className="space-y-2">
                {activeTasks.map(task => (
                  <TaskCard key={task.id} task={task} showAssignee showAssigner={false} hash="diskusi" />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
