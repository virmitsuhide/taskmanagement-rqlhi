import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, User as UserIcon } from 'lucide-react'
import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { Markdown } from '@/components/ui/markdown'
import { ShareButton } from './ShareButton'
import type { NewsArticle, NewsCategory, NewsType } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const DAY_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const CATEGORY_META: Record<NewsCategory, { label: string; color: string }> = {
  sdit_lhi:     { label: 'SDIT LHI',     color: '#10B981' },
  smpit_lhi:    { label: 'SMPIT LHI',    color: '#3B82F6' },
  sma_lhi:      { label: 'SMA LHI',      color: '#8B5CF6' },
  paud_lhi:     { label: 'PAUD LHI',     color: '#EC4899' },
  sd_lhi_juara: { label: 'SD LHI Juara', color: '#F59E0B' },
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${DAY_ID[d.getDay()]}, ${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm} WIB`
}

function formatShort(dateStr: string) {
  const d = new Date(dateStr)
  const MONTH_S = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${d.getDate()} ${MONTH_S[d.getMonth()]} ${d.getFullYear()}`
}

async function getArticle(id: string): Promise<NewsArticle | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('news_articles')
      .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
      .eq('id', id)
      .single()
    return (data ?? null) as NewsArticle | null
  } catch {
    return null
  }
}

async function getRelated(current: NewsArticle): Promise<NewsArticle[]> {
  try {
    const supabase = createServerClient()
    const query = supabase
      .from('news_articles')
      .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
      .eq('is_active', true)
      .neq('id', current.id)
      .order('created_at', { ascending: false })
      .limit(4)
    if (current.category) query.eq('category', current.category)
    const { data } = await query
    return (data ?? []) as NewsArticle[]
  } catch {
    return []
  }
}

function CategoryBadge({ category, type }: { category: NewsCategory | null; type: NewsType }) {
  if (type === 'artikel') {
    return (
      <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-foreground text-background">
        Artikel
      </span>
    )
  }
  if (!category) return null
  const meta = CATEGORY_META[category]
  return (
    <span
      className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded"
      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
    >
      {meta.label}
    </span>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article || !article.is_active) notFound()

  const related = await getRelated(article)

  const categoryHref = article.category ? `/news?category=${article.category}&type=berita` : '/news'
  const categoryLabel = article.category ? CATEGORY_META[article.category].label : null

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-lora), 'Georgia', serif", fontSize: 15, lineHeight: 1.65 }}
    >
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-6 pt-9 pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Beranda</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-foreground transition-colors">
            {article.type === 'artikel' ? 'Artikel' : 'Berita'}
          </Link>
          {categoryLabel && (
            <>
              <span>/</span>
              <Link href={categoryHref} className="hover:text-foreground transition-colors">
                {categoryLabel}
              </Link>
            </>
          )}
        </nav>

        {/* Category badge */}
        <div className="mb-4">
          <CategoryBadge category={article.category} type={article.type} />
        </div>

        {/* Title */}
        <h1
          className="font-bold leading-[1.15] tracking-tight text-[clamp(28px,5vw,42px)] mb-4"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          {article.title}
        </h1>

        {/* Excerpt as deck */}
        {article.excerpt && (
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-5">
            {article.excerpt}
          </p>
        )}

        {/* Meta line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-5 mb-6 border-b text-xs text-muted-foreground">
          {article.author && (
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="h-3 w-3" />
              <span className="font-medium text-foreground">{article.author.display_name}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {formatFullDate(article.created_at)}
          </span>
          <ShareButton title={article.title} />
        </div>

        {/* Hero image with caption */}
        {article.thumbnail_url && (
          <figure className="-mx-6 md:mx-0 md:rounded-xl overflow-hidden mb-7 border-y md:border">
            <div className="relative w-full aspect-[16/9]">
              <Image
                src={article.thumbnail_url}
                alt={article.title}
                fill
                priority
                className="object-cover"
              />
            </div>
            {article.author && (
              <figcaption className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/40 italic">
                Foto: dokumentasi {article.author.display_name}
              </figcaption>
            )}
          </figure>
        )}

        {/* Body */}
        <article
          className="news-article text-[16px] leading-[1.8]"
          style={{ textAlign: 'justify', textJustify: 'inter-word' } as React.CSSProperties}
        >
          <Markdown content={article.content} className="prose prose-base max-w-none [&_p]:mb-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:my-4 [&_ol]:my-4 [&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-accent-warm [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-5" />
        </article>

        {/* Source footer */}
        <div className="mt-10 pt-5 border-t text-xs text-muted-foreground">
          <p>
            Baca artikel Rumah Qur&apos;an LHI &quot;<span className="italic">{article.title}</span>&quot;
            {article.author && <> selengkapnya oleh <span className="font-medium text-foreground">{article.author.display_name}</span></>}.
          </p>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link href="/news" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Kembali ke daftar berita
          </Link>
        </div>
      </div>

      {/* Related — "Lihat Juga" */}
      {related.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="border-t pt-8">
            <h2
              className="text-lg font-bold tracking-tight mb-5"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Lihat Juga
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {related.map(item => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group rounded-lg border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition"
                >
                  {item.thumbnail_url ? (
                    <div className="relative w-full aspect-[16/10] overflow-hidden">
                      <Image
                        src={item.thumbnail_url}
                        alt={item.title}
                        fill
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[16/10] bg-gradient-to-br from-muted to-muted/60" />
                  )}
                  <div className="p-3">
                    <CategoryBadge category={item.category} type={item.type} />
                    <h3
                      className="font-semibold leading-snug text-sm mt-2 line-clamp-2"
                      style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {formatShort(item.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  )
}
