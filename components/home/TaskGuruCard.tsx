import { ArrowRight } from 'lucide-react'
import type { PublicPost } from '@/types'

interface Props {
  post: PublicPost
  index?: number
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function splitDate(dateStr: string): [string, string] {
  const d = new Date(dateStr)
  return [String(d.getDate()), MONTH_SHORT[d.getMonth()]]
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function isNew(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime()
  return diff < 3 * 86_400_000
}

function avatarBg(idx: number) {
  const tones = ['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700']
  return tones[idx % tones.length]
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
}

export function TaskGuruCard({ post, index = 0 }: Props) {
  const due = post.due_date ? splitDate(post.due_date) : splitDate(post.created_at)
  const overdue = isOverdue(post.due_date)
  const fresh = isNew(post.created_at)

  const stripBg = overdue ? 'bg-accent-warm-wash' : 'bg-primary-wash'
  const stripText = overdue ? 'text-accent-warm' : 'text-primary'

  return (
    <article className="group rounded-xl border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition">
      <div className="grid grid-cols-[92px_1fr]">
        <div className={`flex flex-col items-center justify-center gap-1 py-5 px-3 border-r ${stripBg}`}>
          <div className={`text-3xl font-semibold leading-none tracking-tight ${stripText}`}>{due[0]}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{due[1]}</div>
        </div>

        <div className="p-5 flex flex-col justify-between gap-3 min-w-0">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {post.target === 'sd' ? 'SDIT' : post.target === 'smp' ? 'SMPIT' : 'Umum'}
              </span>
              {overdue && (
                <span className="inline-flex items-center rounded-full bg-accent-warm-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-warm">
                  Jatuh tempo
                </span>
              )}
              {fresh && !overdue && (
                <span className="inline-flex items-center rounded-full bg-primary-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Baru
                </span>
              )}
            </div>
            <h3 className="font-semibold text-base leading-snug">{post.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {post.content}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            {post.creator ? (
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold shrink-0 ${avatarBg(index)}`}
                >
                  {initials(post.creator.display_name)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {post.creator.display_name}
                </p>
              </div>
            ) : (
              <span />
            )}
            <ArrowRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition" />
          </div>
        </div>
      </div>
    </article>
  )
}

