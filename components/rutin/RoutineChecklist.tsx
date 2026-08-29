'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Check, ChevronDown, ChevronUp, Pencil, Trash2, X, CircleCheckBig,
} from 'lucide-react'
import {
  deleteRoutineTaskAction, moveRoutineTaskAction,
  toggleRoutineCheckAction, updateRoutineTaskAction,
} from '@/app/actions/rutin'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CADENCES, CADENCE_LABELS, CADENCE_PERIOD_LABELS, labelPeriode } from '@/lib/rutin/periode'
import type { RoutineGroup } from '@/lib/data/rutin'
import type { RoutineTaskState } from '@/types'

/**
 * Checklist tugas rutin untuk periode yang sedang berjalan.
 *
 * Centangnya dilaporkan optimistis: kotak langsung berubah, lalu server
 * menyusul. Mencentang daftar adalah gerakan beruntun — orang mencentang tiga
 * hal sekaligus tanpa menunggu — dan jeda satu perjalanan jaringan di tiap
 * ketukan membuatnya terasa macet. Kalau servernya menolak, keadaannya
 * dikembalikan dan alasannya ditampilkan.
 */

interface Props {
  groups: RoutineGroup[]
}

export function RoutineChecklist({ groups }: Props) {
  return (
    <div className="space-y-5">
      {groups.map(group => (
        <GroupSection key={group.cadence} group={group} />
      ))}
    </div>
  )
}

function GroupSection({ group }: { group: RoutineGroup }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  // Centang yang sudah diketuk tapi belum dikonfirmasi server.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  const items = group.items.map(i => ({
    ...i,
    done: optimistic[i.task.id] ?? i.done,
  }))
  const done = items.filter(i => i.done).length
  const total = items.length
  const persen = total === 0 ? 0 : Math.round((done / total) * 100)

  function toggle(item: RoutineTaskState, next: boolean) {
    setOptimistic(o => ({ ...o, [item.task.id]: next }))
    startTransition(async () => {
      const res = await toggleRoutineCheckAction(item.task.id, next)
      if (res?.error) {
        setOptimistic(o => {
          const salin = { ...o }
          delete salin[item.task.id]
          return salin
        })
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

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
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-sm font-semibold">{CADENCE_LABELS[group.cadence]}</h2>
          <span className="text-[11px] text-muted-foreground">
            {CADENCE_PERIOD_LABELS[group.cadence]} · {labelPeriode(group.cadence)}
          </span>
          {total > 0 && (
            <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {done}/{total} selesai
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full rounded-full transition-[width] ${done === total ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${persen}%` }}
            />
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="px-5 py-8 text-center text-xs italic text-muted-foreground">
          Belum ada tugas {CADENCE_LABELS[group.cadence].toLowerCase()}. Tambahkan lewat
          kotak &ldquo;Tambah Tugas Rutin&rdquo; di atas.
        </p>
      ) : done === total ? (
        <div className="flex items-center gap-2 border-b border-success/20 bg-success-wash px-5 py-2.5 text-sm text-success">
          <CircleCheckBig className="h-4 w-4 shrink-0" />
          Semua tugas {CADENCE_LABELS[group.cadence].toLowerCase()} sudah dikerjakan
          {group.cadence === 'pekanan' ? ' pekan ini' : ' bulan ini'}.
        </div>
      ) : null}

      <div className="divide-y">
        {items.map((item, i) =>
          editingId === item.task.id ? (
            <EditRow
              key={item.task.id}
              item={item}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ChecklistRow
              key={item.task.id}
              item={item}
              pending={pending}
              isFirst={i === 0}
              isLast={i === items.length - 1}
              onToggle={next => toggle(item, next)}
              onEdit={() => setEditingId(item.task.id)}
              onMove={dir => run(() => moveRoutineTaskAction(item.task.id, dir))}
              onDelete={() => {
                if (!confirm(`Hapus tugas rutin "${item.task.description}"?\n\nRiwayat centangnya ikut terhapus.`)) return
                run(() => deleteRoutineTaskAction(item.task.id), 'Tugas rutin dihapus.')
              }}
            />
          ),
        )}
      </div>
    </section>
  )
}

function ChecklistRow({
  item, pending, isFirst, isLast, onToggle, onEdit, onMove, onDelete,
}: {
  item: RoutineTaskState
  pending: boolean
  isFirst: boolean
  isLast: boolean
  onToggle: (next: boolean) => void
  onEdit: () => void
  onMove: (dir: 'up' | 'down') => void
  onDelete: () => void
}) {
  const id = `rutin-${item.task.id}`

  return (
    <div className="group flex items-start gap-3 px-5 py-3">
      {/*
        Kotak centang asli, bukan tombol bergaya kotak: pembaca layar,
        navigasi Tab, dan tombol Spasi sudah bekerja apa adanya, dan label
        yang menaungi seluruh deskripsi membuat sasaran ketukan di HP selebar
        barisnya — bukan cuma kotak 16px.
      */}
      <input
        id={id}
        type="checkbox"
        checked={item.done}
        onChange={e => onToggle(e.target.checked)}
        className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer accent-primary"
      />

      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={`block cursor-pointer text-sm leading-snug ${
            item.done ? 'text-muted-foreground line-through decoration-1' : ''
          }`}
        >
          {item.task.description}
        </label>
        {item.done && item.checkedAt && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Dicentang {waktuSingkat(item.checkedAt)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
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
      className={`rounded p-1.5 transition hover:bg-accent disabled:opacity-30 ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/**
 * Sunting di tempat.
 *
 * Menambah tugas punya halamannya sendiri — di sana orang sedang memikirkan
 * pekerjaan baru. Menyunting terjadi sambil membaca daftar ("kalimatnya kurang
 * jelas", "ini harusnya bulanan"), dan melempar orang ke halaman lain hanya
 * untuk mengubah satu kalimat memutus alur membacanya.
 */
function EditRow({
  item, onDone, onCancel,
}: {
  item: RoutineTaskState
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const [state, action, isPending] = useActionState(
    updateRoutineTaskAction,
    null as { error?: string; success?: boolean } | null,
  )

  useEffect(() => { areaRef.current?.focus() }, [])

  useEffect(() => {
    if (!state?.success) return
    router.refresh()
    onDone()
    // Hanya `state` yang boleh memicu; onDone & router stabil selama baris ini hidup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={action} className="space-y-3 bg-muted/30 px-5 py-4">
      <input type="hidden" name="task_id" value={item.task.id} />

      <div className="space-y-1.5">
        <Label htmlFor={`edit-${item.task.id}`} className="text-xs">Deskripsi</Label>
        <Textarea
          ref={areaRef}
          id={`edit-${item.task.id}`}
          name="description"
          rows={2}
          required
          maxLength={300}
          defaultValue={item.task.description}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {CADENCES.map(c => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="cadence"
              value={c}
              defaultChecked={item.task.cadence === c}
              className="accent-primary"
            />
            {CADENCE_LABELS[c]}
          </label>
        ))}
      </div>

      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Check className="mr-1 h-3.5 w-3.5" />
          {isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          <X className="mr-1 h-3.5 w-3.5" />Batal
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Memindah irama tidak menghapus riwayat centangnya.
        </span>
      </div>
    </form>
  )
}

/** "hari ini 14.20" / "Sen, 31 Agu 14.20" — cukup untuk menandai kapan dicentang. */
function waktuSingkat(iso: string): string {
  const d = new Date(iso)
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const hariIni = new Date().toDateString() === d.toDateString()
  if (hariIni) return `hari ini ${jam}`
  return `${d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${jam}`
}
