import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { Newsreader } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import type { NewsArticle, NewsCategory, NewsType } from '@/types'

const PAGE_SIZE = 12

// Huruf judul Teduh; nama variabel lama dipertahankan agar pemakainya tak perlu diubah.
const playfair = Newsreader({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', style: ['normal', 'italic'] })

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
  searchParams: Promise<{ category?: string; type?: string; q?: string; page?: string }>
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeCategory = (params.category as NewsCategory | undefined)
  const activeType = (params.type as NewsType | undefined)
  const query = (params.q ?? '').trim()
  const queryLower = query.toLowerCase()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [news, session] = await Promise.all([getNews(), getSession()])
  const isEditor = session ? canCreateNews(session.role) : false

  // Halaman ini murni tampilan publik: draft/nonaktif tidak pernah ikut,
  // termasuk untuk editor. Arsip lengkapnya ada di /humas/berita.
  let filtered = news.filter(n => n.is_active)
  if (activeType) filtered = filtered.filter(n => n.type === activeType)
  if (activeCategory) filtered = filtered.filter(n => n.category === activeCategory)
  if (queryLower) {
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(queryLower) ||
      (n.excerpt?.toLowerCase().includes(queryLower) ?? false)
    )
  }

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * PAGE_SIZE
  const visible = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  // Page 1 uses featured + sidebar + grid; page 2+ is pure grid
  const isFirstPage = safePage === 1
  const featured = isFirstPage ? visible[0] : undefined
  const rest = isFirstPage ? visible.slice(1) : visible

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
      className={`${playfair.variable} min-h-screen bg-background`}
      style={{ fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      <div className="max-w-6xl mx-auto px-6 pt-9 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-accent-warm">Berita Rumah Qur&apos;an</p>
            <h1
              className="mt-2 text-[clamp(34px,5.5vw,64px)] font-normal leading-[1.02] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Kabar dari halaqoh
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} artikel · Rumah Qur&apos;an LHI
            </p>
          </div>
          {isEditor && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/humas/berita">
                <Settings2 className="h-4 w-4 mr-1" />Kelola Berita
              </Link>
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="mb-5 max-w-md">
          <SearchInput placeholder="Cari berita berdasarkan judul atau ringkasan…" />
          {query && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Menampilkan hasil untuk <span className="font-medium">&ldquo;{query}&rdquo;</span>
            </p>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mb-9 -mx-6 px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div role="group" aria-label="Kategori" className="flex gap-2 min-w-fit">
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

        {/* Berita utama — gambar lebar di kiri, ringkasan di kanan */}
        {featured && (
          <Link href={`/news/${featured.id}`} className="group mb-14 grid items-center gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
            {featured.thumbnail_url ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
                <Image
                  src={featured.thumbnail_url}
                  alt={featured.title}
                  fill
                  priority
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div className="aspect-[16/10] w-full rounded-2xl bg-gradient-to-br from-primary/15 to-muted" />
            )}
            <div className="flex flex-col gap-4">
              <Eyebrow item={featured} />
              <h2
                className="text-3xl leading-[1.1] md:text-[44px]"
                style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
              >
                {featured.title}
              </h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground line-clamp-4">
                {getExcerpt(featured, 260)}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                Baca berita <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        )}

        {/* Grid of remaining */}
        {rest.length > 0 && (
          <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 md:grid-cols-3">
            {rest.map(item => (
              <Link key={item.id} href={`/news/${item.id}`} className="group flex flex-col gap-3">
                {item.thumbnail_url ? (
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
                    <Image
                      src={item.thumbnail_url}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] w-full rounded-2xl bg-gradient-to-br from-primary/10 to-muted" />
                )}
                <Eyebrow item={item} />
                <h3
                  className="text-[22px] leading-[1.2] group-hover:text-primary"
                  style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
                >
                  {item.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
                  {getExcerpt(item, 140)}
                </p>
              </Link>
            ))}
          </div>
        )}

        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/news"
          searchParams={{
            category: activeCategory,
            type: activeType,
            q: query || undefined,
          }}
        />
      </div>
      <PublicFooter />
    </div>
  )
}

/** 'SDIT LHI · 12 Sep 2026' — kategori dan tanggal dalam satu baris kecil berwarna. */
function Eyebrow({ item }: { item: NewsArticle }) {
  const kategori = item.type === 'artikel' ? 'Artikel' : item.category ? CATEGORY_META[item.category].label : 'Berita'
  return (
    <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-accent-warm">
      {kategori} · <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    </span>
  )
}

function FilterTab({
  href,
  active,
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
      aria-current={active ? 'page' : undefined}
      className={`inline-flex h-10 items-center rounded-full border px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}
