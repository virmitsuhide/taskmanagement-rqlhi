'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markNotificationsSeenAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/actions/notifications'
import type { NotificationItem } from '@/lib/data/notifications'
import type { TaskStatus } from '@/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'Dikerjakan',
  problem: 'Bermasalah',
  submitted: 'Menunggu Review',
  done: 'Selesai',
  returned: 'Dikembalikan',
}

/** Warna aksen per status supaya perubahan penting langsung terbaca. */
const STATUS_TONE: Partial<Record<TaskStatus, string>> = {
  done: 'text-success',
  problem: 'text-destructive',
  returned: 'text-warning',
  submitted: 'text-primary',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d === 1) return 'kemarin'
  if (d < 7) return `${d} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

interface Props {
  items: NotificationItem[]
  unseenCount: number
}

export function NotificationBell({ items, unseenCount }: Props) {
  const [open, setOpen] = useState(false)
  // State lokal hanya menyimpan SELISIH terhadap data server, bukan salinannya:
  // sekali dibuka badge padam, dan id yang diklik ditumpuk di atas item.read.
  // Dengan begitu data server yang baru langsung terpakai tanpa efek sinkronisasi.
  const [seenNow, setSeenNow] = useState(false)
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set())
  const [, startTransition] = useTransition()
  const router = useRouter()

  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const badge = seenNow ? 0 : unseenCount
  const isRead = (item: NotificationItem) => item.read || locallyRead.has(item.id)

  // Tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    // Membuka = "sudah dilihat": badge berhenti, titik biru tetap.
    if (next && badge > 0) {
      setSeenNow(true)
      startTransition(() => { void markNotificationsSeenAction() })
    }
  }

  function openItem(item: NotificationItem) {
    setLocallyRead(prev => new Set(prev).add(item.id))
    setOpen(false)
    startTransition(() => { void markNotificationReadAction(item.id) })
    router.push(`/tasks/${item.taskId}`)
  }

  function markAll() {
    const ids = items.map(i => i.id)
    setLocallyRead(new Set(ids))
    startTransition(() => { void markAllNotificationsReadAction(ids) })
  }

  const unreadShown = items.filter(i => !isRead(i)).length

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={badge > 0 ? `Notifikasi, ${badge} baru` : 'Notifikasi'}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Notifikasi"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Daftar notifikasi"
          className="absolute right-0 top-full mt-2 w-[330px] max-w-[calc(100vw-1.5rem)] rounded-xl border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
            <p className="text-sm font-semibold">Notifikasi</p>
            {unreadShown > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                <CheckCheck className="h-3 w-3" />
                Tandai semua dibaca
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Belum ada notifikasi.
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {items.map(item => {
                const isUnread = !isRead(item)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openItem(item)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors flex gap-2.5',
                        isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 h-2 w-2 rounded-full shrink-0',
                          isUnread ? 'bg-primary' : 'bg-transparent',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm leading-snug',
                            isUnread ? 'font-medium' : 'text-muted-foreground',
                          )}
                        >
                          {item.kind === 'assigned' ? (
                            <>Tugas baru: {item.taskTitle}</>
                          ) : (
                            <>
                              {item.taskTitle} →{' '}
                              <span className={STATUS_TONE[item.newStatus] ?? ''}>
                                {STATUS_LABELS[item.newStatus]}
                              </span>
                            </>
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          {item.kind === 'assigned' ? 'dari' : 'oleh'} {item.actorName} · {timeAgo(item.createdAt)}
                        </span>
                      </span>
                      {isUnread && <span className="sr-only">Belum dibaca</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
