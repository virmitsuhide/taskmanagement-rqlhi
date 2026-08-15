'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTaskCommentAction, deleteTaskCommentAction } from '@/app/actions/task-comments'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Send, MessageSquare, Download } from 'lucide-react'
import type { TaskComment } from '@/types'

interface Props {
  taskId: string
  taskTitle: string
  comments: TaskComment[]
  currentUserId: string
  isModerator: boolean
  participants: { id: string; name: string }[]
}

function formatFull(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'tugas'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Render body dengan highlight token @mention. */
function renderBody(body: string) {
  const parts = body.split(/(@\S+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="font-medium" style={{ color: '#b8860b' }}>{part}</span>
      : <span key={i}>{part}</span>,
  )
}

export function TaskComments({ taskId, taskTitle, comments, currentUserId, isModerator, participants }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createTaskCommentAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Setelah submit sukses: reset form + refresh
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
      router.refresh()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])

  function insertMention(name: string) {
    const ta = textareaRef.current
    if (!ta) return
    const mention = `@${name.split(' ')[0]} `
    ta.value = (ta.value + (ta.value && !ta.value.endsWith(' ') ? ' ' : '') + mention).trimStart()
    ta.focus()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteTaskCommentAction(id)
    setDeletingId(null)
    if (res?.error) toast.error(res.error)
    else { toast.success('Komentar dihapus'); router.refresh() }
  }

  function downloadLog() {
    const header = [
      `LOG DISKUSI TUGAS`,
      `Judul   : ${taskTitle}`,
      `Diunduh : ${formatFull(new Date().toISOString())}`,
      `Pesan   : ${comments.length}`,
      '='.repeat(60),
      '',
    ]
    const body = comments.map(c => {
      const who = c.author?.display_name ?? 'Pengguna'
      return `[${formatFull(c.created_at)}] ${who}:\n${c.body}\n`
    })
    const blob = new Blob([[...header, ...body].join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diskusi-${slugify(taskTitle)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div id="diskusi" className="scroll-mt-20">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Diskusi
          <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
        </h2>
        {comments.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={downloadLog}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Unduh log (.txt)
          </Button>
        )}
      </div>

      {/* Daftar komentar */}
      <div className="space-y-4 mb-5">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            Belum ada diskusi. Mulai percakapan tentang task ini.
          </p>
        )}
        {comments.map(c => {
          const authorName = c.author?.display_name ?? 'Pengguna'
          const canDelete = c.author_id === currentUserId || isModerator
          return (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {initials(authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{authorName}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                      aria-label="Hapus komentar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line mt-0.5 leading-relaxed">{renderBody(c.body)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form komentar */}
      <form ref={formRef} action={formAction} className="space-y-2">
        <input type="hidden" name="task_id" value={taskId} />
        <Textarea
          ref={textareaRef}
          name="body"
          rows={2}
          placeholder="Tulis komentar... gunakan @ untuk menyebut rekan"
          required
          disabled={isPending}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {participants.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => insertMention(p.name)}
                className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
              >
                @{p.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {isPending ? 'Mengirim...' : 'Kirim'}
          </Button>
        </div>
      </form>
    </div>
  )
}
