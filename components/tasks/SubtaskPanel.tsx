'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown, Circle, CircleDot, CheckCircle2,
} from 'lucide-react'
import {
  createSubtaskAction, updateSubtaskAction, setSubtaskStatusAction,
  deleteSubtaskAction, moveSubtaskAction,
} from '@/app/actions/subtasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { shortDate, daysLeft, SUBTASK_STATUS_LABELS } from '@/lib/tasks/gantt'
import type { TaskSubtask, SubtaskStatus } from '@/types'

/**
 * Daftar rincian sebuah tugas.
 *
 * Status berputar dengan sekali ketuk: belum mulai → dikerjakan → selesai →
 * belum mulai. Rincian adalah langkah kecil; memasangkan dropdown di tiap baris
 * membuat mencentang lima langkah terasa seperti mengisi formulir lima kali.
 */

const CYCLE: Record<SubtaskStatus, SubtaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

const STATUS_ICON: Record<SubtaskStatus, React.ComponentType<{ className?: string }>> = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
}

const STATUS_COLOR: Record<SubtaskStatus, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-info',
  done: 'text-success',
}

interface Props {
  taskId: string
  subtasks: TaskSubtask[]
  canManage: boolean
}

export function SubtaskPanel({ taskId, subtasks, canManage }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const doneCount = subtasks.filter(s => s.status === 'done').length

  /** Bungkus aksi non-form: jalankan, laporkan galatnya, lalu segarkan. */
  function run(fn: () => Promise<{ error?: string } | void>, sukses?: string) {
    startTransition(async () => {
      const res = await fn()
      if (res && 'error' in res && res.error) {
        toast.error(res.error)
        return
      }
      if (sukses) toast.success(sukses)
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
        <h2 className="text-sm font-semibold">Rincian Tugas</h2>
        {subtasks.length > 0 && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {doneCount}/{subtasks.length} selesai
          </span>
        )}
        {canManage && !adding && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7"
            onClick={() => { setAdding(true); setEditingId(null) }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />Tambah
          </Button>
        )}
      </div>

      <div className="divide-y">
        {subtasks.length === 0 && !adding && (
          <p className="px-5 py-8 text-center text-xs italic text-muted-foreground">
            {canManage
              ? 'Belum dirinci. Pecah tugas ini jadi langkah-langkah kecil, masing-masing dengan tenggatnya sendiri — semuanya langsung muncul di Gantt Chart.'
              : 'Tugas ini belum dirinci menjadi langkah-langkah kecil.'}
          </p>
        )}

        {subtasks.map((sub, i) =>
          editingId === sub.id ? (
            <SubtaskForm
              key={sub.id}
              taskId={taskId}
              subtask={sub}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <SubtaskRow
              key={sub.id}
              sub={sub}
              canManage={canManage}
              pending={pending}
              isFirst={i === 0}
              isLast={i === subtasks.length - 1}
              onToggle={() => run(() => setSubtaskStatusAction(sub.id, CYCLE[sub.status]))}
              onEdit={() => { setEditingId(sub.id); setAdding(false) }}
              onMove={dir => run(() => moveSubtaskAction(sub.id, dir))}
              onDelete={() => {
                if (!confirm(`Hapus rincian "${sub.title}"?`)) return
                run(() => deleteSubtaskAction(sub.id), 'Rincian dihapus.')
              }}
            />
          ),
        )}

        {adding && (
          <SubtaskForm
            taskId={taskId}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
            keepOpenAfterSave
          />
        )}
      </div>
    </div>
  )
}

function SubtaskRow({
  sub, canManage, pending, isFirst, isLast, onToggle, onEdit, onMove, onDelete,
}: {
  sub: TaskSubtask
  canManage: boolean
  pending: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onEdit: () => void
  onMove: (dir: 'up' | 'down') => void
  onDelete: () => void
}) {
  const Icon = STATUS_ICON[sub.status]
  const sisa = sub.status === 'done' ? null : daysLeft(sub.due_date)
  const telat = sisa !== null && sisa < 0

  return (
    <div className="group flex items-start gap-2.5 px-5 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={!canManage || pending}
        title={canManage ? `${SUBTASK_STATUS_LABELS[sub.status]} — ketuk untuk ubah` : SUBTASK_STATUS_LABELS[sub.status]}
        className={`mt-0.5 shrink-0 rounded-full transition disabled:cursor-default ${STATUS_COLOR[sub.status]} ${canManage ? 'hover:scale-110' : ''}`}
      >
        <Icon className="h-4.5 w-4.5" />
        <span className="sr-only">{SUBTASK_STATUS_LABELS[sub.status]}</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${sub.status === 'done' ? 'text-muted-foreground line-through decoration-1' : ''}`}>
          {sub.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
          {sub.start_date && <span>Mulai {shortDate(sub.start_date)}</span>}
          {sub.due_date && (
            <span className={telat ? 'font-medium text-destructive' : ''}>
              Tenggat {shortDate(sub.due_date)}
              {telat && ` · telat ${-sisa!} hari`}
              {sisa === 0 && ' · hari ini'}
            </span>
          )}
          {!sub.start_date && !sub.due_date && (
            <span className="italic">Tanpa tanggal — belum tampil di Gantt Chart</span>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <IconBtn label="Naikkan" onClick={() => onMove('up')} disabled={isFirst || pending}>
            <ChevronUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Turunkan" onClick={() => onMove('down')} disabled={isLast || pending}>
            <ChevronDown className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Sunting" onClick={onEdit} disabled={pending}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Hapus" onClick={onDelete} disabled={pending} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      )}
    </div>
  )
}

function IconBtn({
  label, onClick, disabled, danger, children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`rounded p-1.5 transition hover:bg-accent disabled:opacity-30 ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground'}`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/**
 * Form tambah/sunting rincian.
 *
 * Satu komponen untuk dua peran: kalau `subtask` diisi ia menyunting, kalau
 * tidak ia menambah. Keduanya punya field yang sama persis, dan memisahkannya
 * jadi dua komponen hanya akan menggandakan validasi tanggal di dua tempat.
 */
function SubtaskForm({
  taskId, subtask, onDone, onCancel, keepOpenAfterSave,
}: {
  taskId: string
  subtask?: TaskSubtask
  onDone: () => void
  onCancel: () => void
  /** Mode tambah: form tetap terbuka supaya beberapa langkah bisa diketik beruntun. */
  keepOpenAfterSave?: boolean
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [state, action, isPending] = useActionState(
    subtask ? updateSubtaskAction : createSubtaskAction,
    null as { error?: string; success?: boolean } | null,
  )

  useEffect(() => { titleRef.current?.focus() }, [])

  useEffect(() => {
    if (!state?.success) return
    router.refresh()
    if (keepOpenAfterSave) {
      formRef.current?.reset()
      titleRef.current?.focus()
    } else {
      onDone()
    }
    // onDone/router stabil sepanjang hidup form ini; hanya `state` yang memicu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-3 bg-muted/30 px-5 py-4">
      <input type="hidden" name="task_id" value={taskId} />
      {subtask && <input type="hidden" name="subtask_id" value={subtask.id} />}

      <div className="space-y-1.5">
        <Label htmlFor={`st-title-${subtask?.id ?? 'baru'}`} className="text-xs">Langkah</Label>
        <Input
          ref={titleRef}
          id={`st-title-${subtask?.id ?? 'baru'}`}
          name="title"
          required
          defaultValue={subtask?.title ?? ''}
          placeholder="mis. Kumpulkan data absensi halaqoh"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`st-start-${subtask?.id ?? 'baru'}`} className="text-xs">Mulai (opsional)</Label>
          <Input
            id={`st-start-${subtask?.id ?? 'baru'}`}
            name="start_date"
            type="date"
            defaultValue={subtask?.start_date ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`st-due-${subtask?.id ?? 'baru'}`} className="text-xs">Tenggat</Label>
          <Input
            id={`st-due-${subtask?.id ?? 'baru'}`}
            name="due_date"
            type="date"
            defaultValue={subtask?.due_date ?? ''}
          />
        </div>
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1 h-3.5 w-3.5" />
          {isPending ? 'Menyimpan…' : subtask ? 'Simpan' : 'Tambahkan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          <X className="mr-1 h-3.5 w-3.5" />Tutup
        </Button>
        {!subtask && (
          <span className="text-[11px] text-muted-foreground">
            Form tetap terbuka — ketik langkah berikutnya lalu Enter.
          </span>
        )}
      </div>
    </form>
  )
}
