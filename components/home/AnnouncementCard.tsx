import { ArrowRight } from 'lucide-react'
import type { PublicPost } from '@/types'

interface Props {
  post: PublicPost
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function splitDate(dateStr: string): [string, string] {
  const d = new Date(dateStr)
  return [String(d.getDate()), MONTH_SHORT[d.getMonth()]]
}

function isNew(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime()
  return diff < 3 * 86_400_000
}

function categoryOf(post: PublicPost): { label: string; tone: 'wash' | 'warm' | 'muted' } {
  if (post.due_date) return { label: 'Kegiatan', tone: 'wash' }
  if (post.target === 'sd' || post.target === 'smp') return { label: 'Akademik', tone: 'warm' }
  return { label: 'Informasi', tone: 'muted' }
}

export function AnnouncementCard({ post }: Props) {
  const [day, mon] = splitDate(post.created_at)
  const fresh = isNew(post.created_at)
  const cat = categoryOf(post)

  const toneClass =
    cat.tone === 'wash'
      ? 'bg-primary-wash text-primary'
      : cat.tone === 'warm'
      ? 'bg-accent-warm-wash text-accent-warm'
      : 'bg-muted text-muted-foreground'

  return (
    <article className="group rounded-xl border bg-card p-5 hover:border-foreground/20 hover:shadow-sm transition cursor-pointer">
      <div className="grid grid-cols-[auto_1fr_auto] gap-5 items-center">
        <div className="text-center pr-5 border-r border-dashed min-w-[64px]">
          <div className="text-xl font-semibold leading-none tracking-tight">{day}</div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {mon}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${toneClass}`}>
              {cat.label}
            </span>
            {fresh && (
              <span className="inline-flex items-center rounded-full bg-primary-wash text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Baru
              </span>
            )}
          </div>
          <h3 className="font-semibold text-base leading-snug">{post.title}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {post.content}
          </p>
        </div>

        <div className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-primary whitespace-nowrap shrink-0">
          Selengkapnya <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </article>
  )
}
