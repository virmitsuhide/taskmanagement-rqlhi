import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Plus, Eye, EyeOff, Trash2, Pencil } from 'lucide-react'
import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { toggleNewsAction, deleteNewsAction } from '@/app/actions/news'
import { Button } from '@/components/ui/button'
import type { NewsArticle, NewsCategory, NewsType } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const CATEGORY_META: Record<NewsCategory, { label: string; color: string }> = {
  sdit_lhi:     { label: 'SDIT LHI',     color: '#10B981' },
  smpit_lhi:    { label: 'SMPIT LHI',    color: '#3B82F6' },
  sma_lhi:      { label: 'SMA LHI',      color: '#8B5CF6' },
  paud_lhi:     { label: 'PAUD LHI',     color: '#EC4899' },
  sd_lhi_juara: { label: 'SD LHI Juara', color: '#F59E0B' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as NewsCategory[]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`
}

function getExcerpt(item: NewsArticle, maxLen: number) {
  if (item.excerpt) return item.excerpt.length > maxLen ? item.excerpt.slice(0, maxLen).trimEnd() + '…' : item.excerpt
  return item.content.length > maxLen ? item.content.slice(0, maxLen).trimEnd() + '…' : item.content
}

async function getNews() {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('news_articles')
      .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
      .order('created_at', { ascending: false })
    return (data ?? []) as NewsArticle[]
  } catch {
    return []
  }
}

function CategoryBadge({ category, type }: { category: NewsCategory | null; type: NewsType }) {
  if (type === 'artikel') {
    return (
      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
        Artikel
      </span>
    )
  }
  if (!category) return null
  const meta = CATEGORY_META[category]
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
    >
      {meta.label}
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ category?: string; type?: string }>
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeCategory = (params.category as NewsCategory | undefined)
  const activeType = (params.type as NewsType | undefined)

  const [news, session] = await Promise.all([getNews(), getSession()])
  const isEditor = session && canCreateNews(session.role)
  let visible = isEditor ? news : news.filter(n => n.is_active)
  if (activeType) visible = visible.filter(n => n.type === activeType)
  if (activeCategory) visible = visible.filter(n => n.category === activeCategory)

  const featured = visible[0]
  const sideSlot = visible.slice(1, 4)
  const rest = visible.slice(4)

  function tabHref(next: Partial<{ category: string; type: string }>) {
    const merged: Record<string, string> = {}
    if (activeCategory && next.category !== '') merged.category = activeCategory
    if (activeType && next.type !== '') merged.type = activeType
    if (next.category !== undefined) {
      if (next.category) merged.category = next.category
      else delete merged.category
    }
    if (next.type !== undefined) {
      if (next.type) merged.type = next.type
      else delete merged.type
    }
    const qs = new URLSearchParams(merged).toString()
    return qs ? `/news?${qs}` : '/news'
  }

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-lora), 'Georgia', serif", fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      <div className="max-w-6xl mx-auto px-6 pt-9 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
            </Link>
            <h1
              className="text-[clamp(28px,4.5vw,42px)] font-bold leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Berita &amp; Kabar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {visible.length} {visible.length === 1 ? 'artikel' : 'artikel'} · Rumah Qur&apos;an LHI
            </p>
          </div>
          {isEditor && (
            <Button asChild size="sm" className="shrink-0">
              <Link href="/news/baru">
                <Plus className="h-4 w-4 mr-1" />Buat Berita
              </Link>
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="border-b mb-7 -mx-6 px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 min-w-fit">
            <FilterTab href={tabHref({ category: '', type: '' })} active={!activeCategory && !activeType}>
              Semua
            </FilterTab>
            {ALL_CATEGORIES.map(cat => (
              <FilterTab
                key={cat}
                href={tabHref({ category: cat, type: 'berita' })}
                active={activeCategory === cat && activeType === 'berita'}
                color={CATEGORY_META[cat].color}
              >
                {CATEGORY_META[cat].label}
              </FilterTab>
            ))}
            <FilterTab
              href={tabHref({ category: '', type: 'artikel' })}
              active={activeType === 'artikel'}
            >
              Artikel
            </FilterTab>
          </div>
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed py-20 text-center">
            <p className="text-sm text-muted-foreground">
              {activeCategory || activeType ? 'Tidak ada artikel pada kategori ini.' : 'Belum ada berita yang dipublikasikan.'}
            </p>
          </div>
        )}

        {/* Featured Hero + Side */}
        {featured && (
          <div className="grid md:grid-cols-[1.6fr_1fr] gap-6 mb-10">
            {/* Lead */}
            <Link
              href={`/news/${featured.id}`}
              className={`group block ${!featured.is_active ? 'opacity-50' : ''}`}
            >
              <article className="rounded-xl border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition">
                {featured.thumbnail_url ? (
                  <div className="relative w-full aspect-[16/10] overflow-hidden">
                    <Image
                      src={featured.thumbnail_url}
                      alt={featured.title}
                      fill
                      priority
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-[16/10] bg-gradient-to-br from-accent-warm/15 to-primary/10" />
                )}
                <div className="p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryBadge category={featured.category} type={featured.type} />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(featured.created_at)}
                    </span>
                    {!featured.is_active && (
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">Non-aktif</span>
                    )}
                  </div>
                  <h2
                    className="font-bold leading-snug text-2xl md:text-3xl mb-3"
                    style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                  >
                    {featured.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {getExcerpt(featured, 240)}
                  </p>
                  {featured.author && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Oleh <span className="font-medium text-foreground">{featured.author.display_name}</span>
                    </p>
                  )}
                </div>
              </article>
            </Link>

            {/* Side slot */}
            <div className="flex flex-col gap-3">
              {sideSlot.map(item => (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className={`flex gap-3 rounded-lg border bg-card p-3 hover:border-foreground/20 hover:shadow-sm transition group ${!item.is_active ? 'opacity-50' : ''}`}
                >
                  {item.thumbnail_url && (
                    <div className="relative shrink-0 w-24 h-24 rounded overflow-hidden border">
                      <Image src={item.thumbnail_url} alt={item.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CategoryBadge category={item.category} type={item.type} />
                    <h3
                      className="font-semibold leading-snug text-sm mt-1.5 line-clamp-3"
                      style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grid of remaining */}
        {rest.length > 0 && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {rest.map(item => (
              <article
                key={item.id}
                className={`group rounded-xl border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition relative ${!item.is_active ? 'opacity-50' : ''}`}
              >
                <Link href={`/news/${item.id}`} className="block">
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
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CategoryBadge category={item.category} type={item.type} />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <h3
                      className="font-bold leading-snug text-base mb-1.5 line-clamp-2"
                      style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {getExcerpt(item, 120)}
                    </p>
                  </div>
                </Link>
                {isEditor && (
                  <div className="absolute top-2 right-2 flex gap-1 bg-card/80 backdrop-blur rounded-md p-0.5">
                    <Link
                      href={`/news/${item.id}/edit`}
                      title="Edit"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <form action={toggleNewsAction.bind(null, item.id, !item.is_active) as unknown as (fd: FormData) => void}>
                      <button
                        type="submit"
                        title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {item.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </form>
                    <form action={deleteNewsAction.bind(null, item.id) as unknown as (fd: FormData) => void}>
                      <button
                        type="submit"
                        title="Hapus"
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterTab({
  href,
  active,
  color,
  children,
}: {
  href: string
  active: boolean
  color?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t"
          style={{ backgroundColor: color ?? 'currentColor' }}
        />
      )}
    </Link>
  )
}
