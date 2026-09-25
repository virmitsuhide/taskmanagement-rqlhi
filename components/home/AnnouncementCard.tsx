import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, CalendarDays, Clock } from 'lucide-react'
import { POST_ICONS, postIconOf } from '@/lib/home/post-icons'
import { adalahTugas, labelTanggalPost, lewatTenggatPost } from '@/lib/home/post-tanggal'
import { stripMarkdown } from '@/lib/markdown'
import type { PublicPost, PostPriority } from '@/types'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Tampilan tiap status prioritas.
 *
 * Warnanya dipilih dari token tema yang sudah ada, bukan warna mentah, supaya
 * ikut menyesuaikan mode terang & gelap tanpa aturan tambahan.
 */
const PRIORITY_META: Record<PostPriority, { label: string; badge: string; iconWrap: string }> = {
  penting: {
    label: 'Penting',
    badge: 'bg-destructive/10 text-destructive',
    iconWrap: 'bg-destructive/10 text-destructive',
  },
  info: {
    label: 'Info',
    badge: 'bg-primary-wash text-primary',
    iconWrap: 'bg-primary-wash text-primary',
  },
  pengingat: {
    label: 'Pengingat',
    badge: 'bg-accent-warm-wash text-accent-warm',
    iconWrap: 'bg-accent-warm-wash text-accent-warm',
  },
}

/** Post sebelum migrasi 0017 belum punya priority — anggap 'info'. */
function priorityOf(post: PublicPost): PostPriority {
  return post.priority ?? 'info'
}

function displayDate(post: PublicPost): [string, string, string] {
  const d = new Date(post.due_date ?? post.created_at)
  return [String(d.getDate()), MONTH_SHORT[d.getMonth()], String(d.getFullYear())]
}

/**
 * Satu kartu pengumuman — dipakai papan beranda dan daftar lengkap
 * /pengumuman, supaya keduanya tidak pernah tampil berbeda.
 */
export function AnnouncementCard({ post }: { post: PublicPost }) {
  const [day, mon, year] = displayDate(post)
  const meta = PRIORITY_META[priorityOf(post)]
  // Glif dari pilihan penulis, warnanya tetap dari prioritas — dua sumbu
  // berbeda, dan menyatukannya membuat keduanya tidak terbaca.
  const Icon = POST_ICONS[postIconOf(post)].icon
  const unit = post.target === 'sd' ? 'SDIT' : post.target === 'smp' ? 'SMPIT' : null

  return (
    <article
      className="group relative flex items-start gap-3.5 rounded-2xl border bg-card px-4 py-3.5 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm"
    >
      {/* Flyer sebagai thumbnail bila ada — potret, seperti flyer
          pada umumnya; tanpa gambar, ikon prioritas seperti biasa. */}
      {post.image_url ? (
        <span className="relative shrink-0 w-16 aspect-[4/5] overflow-hidden rounded-lg border bg-muted sm:w-20">
          <Image src={post.image_url} alt="" fill sizes="80px" className="object-cover" />
        </span>
      ) : (
        <span className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconWrap}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}

      {/* Konten */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.badge}`}>
            {meta.label}
          </span>
          {unit && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-muted text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        <h3 className="font-heading text-[19px] font-normal leading-snug text-foreground line-clamp-2 md:text-[21px]">
          <Link
            href={`/pengumuman/${post.id}`}
            className="after:absolute after:inset-0 hover:underline underline-offset-2"
          >
            {post.title}
          </Link>
        </h3>

        <p className="text-[13.5px] text-muted-foreground line-clamp-2 leading-relaxed mt-1">
          {stripMarkdown(post.content)}
        </p>

        {post.due_date && (
          // Kotak tanggal di kanan tak bisa menjelaskan dirinya:
          // bagi tugas ia tenggat, bagi pengumuman hari kegiatan.
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-[11px] ${
              lewatTenggatPost(post) ? 'font-medium text-destructive' : 'text-muted-foreground'
            }`}
          >
            {adalahTugas(post) ? <Clock className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
            {lewatTenggatPost(post) ? 'Lewat tenggat' : labelTanggalPost(post.type)}
            {' · '}
            {`${day} ${mon} ${year}`}
          </p>
        )}

        {post.creator && (
          <p className="text-[11px] text-muted-foreground mt-1">
            oleh {post.creator.display_name}
          </p>
        )}
      </div>

      {/* Tanggal */}
      <div className="hidden sm:block shrink-0 text-center min-w-[52px] rounded-xl bg-muted/60 px-2 py-2">
        <div
          className="text-2xl font-normal leading-none text-foreground"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          {day}
        </div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-[0.6px] mt-0.5">{mon}</div>
        <div className="text-[9px] text-muted-foreground/70 leading-none">{year}</div>
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 self-center" />
    </article>
  )
}
