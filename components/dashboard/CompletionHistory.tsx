'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PlayCircle, Timer, CheckCircle2, MessageSquare, Trash2, ChevronDown, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { deleteCompletedTaskAction } from '@/app/actions/tasks'
import { cn } from '@/lib/utils'
import type { MemberCompletion, CompletedTaskEntry } from '@/types'

interface Props {
  members: MemberCompletion[]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDateTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 60_000) return '< 1 menit'
  const totalMin = Math.floor(ms / 60_000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  const parts: string[] = []
  if (days) parts.push(`${days} hari`)
  if (hours) parts.push(`${hours} jam`)
  if (mins && !days) parts.push(`${mins} menit`)
  return parts.join(' ') || '< 1 menit'
}

export function CompletionHistory({ members }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Belum ada tugas yang selesai.</p>
  }

  const selected = members.find(m => m.user.id === selectedId) ?? null

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Pilih pengurus untuk melihat riwayat tugasnya yang sudah selesai.</p>

      {/* Step 1 — pilih pengurus */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {members.map(m => {
          const isOpen = selectedId === m.user.id
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
              <Card className="h-full">
                <CardContent>
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(m.user.display_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.user.display_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[m.user.role]}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">{m.tasks.length} tugas selesai</p>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* Step 2 — riwayat tugas pengurus terpilih */}
      {selected && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold">Riwayat penyelesaian — {selected.user.display_name}</h3>
          {selected.tasks.map(entry => (
            <HistoryCard key={entry.task.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryCard({ entry }: { entry: CompletedTaskEntry }) {
  const router = useRouter()
  const [showChat, setShowChat] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { task, startedAt, completedAt, durationMs, comments } = entry

  async function handleDelete() {
    // Sejak migrasi 0018 penghapusan bersifat lunak — diskusi & riwayat status
    // tetap tersimpan, dan tugasnya masih bisa dipulihkan oleh manajemen.
    if (!confirm(`Hapus tugas "${task.title}" dari riwayat? Tugas disembunyikan dan masih bisa dipulihkan.`)) return
    setDeleting(true)
    const res = await deleteCompletedTaskAction(task.id)
    setDeleting(false)
    if (res?.error) toast.error(res.error)
    else { toast.success('Tugas dihapus dari riwayat'); router.refresh() }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/tasks/${task.id}`} className="font-medium text-sm hover:underline inline-flex items-center gap-1">
            {task.title}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-muted-foreground hover:text-destructive shrink-0 h-7 px-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Ringkasan waktu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <PlayCircle className="h-3.5 w-3.5 text-info shrink-0" />
          <span className="text-muted-foreground">Mulai:</span>
          <span className="font-medium">{formatDateTime(startedAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-muted-foreground">Lama:</span>
          <span className="font-medium">{formatDuration(durationMs)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
          <span className="text-muted-foreground">Selesai:</span>
          <span className="font-medium">{formatDateTime(completedAt)}</span>
        </div>
      </div>

      {/* History diskusi */}
      <button
        type="button"
        onClick={() => setShowChat(v => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        History diskusi ({comments.length})
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showChat && 'rotate-180')} />
      </button>

      {showChat && (
        <div className="mt-3 space-y-3 border-l-2 pl-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada diskusi pada tugas ini.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.author?.display_name ?? 'Pengguna'}</span>
                  <span className="text-muted-foreground">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-line mt-0.5 leading-relaxed">{c.body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
