import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Newspaper, Eye, EyeOff, FileText, ExternalLink, ImageOff } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { RowActions } from './RowActions'
import type { NewsArticle, NewsCategory, NewsType } from '@/types'

const PAGE_SIZE = 15

const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

const CATEGORY_META: Record<NewsCategory, { label: string; color: string }> = {
  sdit_lhi:     { label: 'SDIT LHI',     color: '#10B981' },
  smpit_lhi:    { label: 'SMPIT LHI',    color: '#3B82F6' },
  sma_lhi:      { label: 'SMA LHI',      color: '#8B5CF6' },
  paud_lhi:     { label: 'PAUD LHI',     color: '#EC4899' },
  sd_lhi_juara: { label: 'SD LHI Juara', color: '#F59E0B' },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as NewsCategory[]

type StatusFilter = 'semua' | 'terbit' | 'nonaktif'
const VALID_STATUS: StatusFilter[] = ['semua', 'terbit', 'nonaktif']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * next/image menolak host yang tidak terdaftar di next.config remotePatterns
 * dan melempar error saat render. Thumbnail lama (mis. data demo dari Unsplash)
 * karena itu dipakai lewat <img> biasa — panel kelola tidak boleh gagal render
 * hanya karena satu baris punya URL gambar dari host lain.
 */
function isOptimizable(url: string) {
  try {
    return new URL(url).hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

async function getAllNews(): Promise<NewsArticle[]> {
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

interface PageProps {
  searchParams: Promise<{
    status?: string
    type?: string
    category?: string
    q?: string
    page?: string
  }>
}

export default async function KelolaBeritaPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!canCreateNews(session.role)) redirect('/dashboard')

  const params = await searchParams
  const status: StatusFilter = VALID_STATUS.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : 'semua'
  const activeType = params.type as NewsType | undefined
  const activeCategory = params.category as NewsCategory | undefined
  const query = (params.q ?? '').trim()
  const queryLower = query.toLowerCase()
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const all = await getAllNews()

  // Statistik dihitung dari seluruh arsip, bukan dari hasil filter — angkanya
  // harus tetap sama apa pun tab yang sedang dibuka.
  const stats = {
    total: all.length,
    terbit: all.filter(n => n.is_active).length,
    nonaktif: all.filter(n => !n.is_active).length,
    artikel: all.filter(n => n.type === 'artikel').length,
  }

  let filtered = all
  if (status === 'terbit') filtered = filtered.filter(n => n.is_active)
  if (status === 'nonaktif') filtered = filtered.filter(n => !n.is_active)
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
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, (safePage - 1) * PAGE_SIZE + PAGE_SIZE)

  /** Href tab yang mempertahankan filter lain & selalu balik ke halaman 1. */
  function filterHref(next: Partial<Record<'status' | 'type' | 'category', string>>) {
    const merged: Record<string, string> = {}
    if (status !== 'semua') merged.status = status
    if (activeType) merged.type = activeType
    if (activeCategory) merged.category = activeCategory
    if (query) merged.q = query
    for (const [key, value] of Object.entries(next)) {
      if (value) merged[key] = value
      else delete merged[key]
    }
    const qs = new URLSearchParams(merged).toString()
    return qs ? `/humas/berita?${qs}` : '/humas/berita'
  }

  return (
    <div>
      <DashboardHeader
        displayName={session.displayName}
        role={session.role}
        title="Kelola Berita"
        showBack
        ownH1
      />

      <div className="p-4 md:p-6 max-w-6xl">
        {/* Judul + aksi utama */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Kelola Berita</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tulis, terbitkan, dan sunting berita &amp; artikel yang tampil di halaman publik.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href="/news"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline px-1"
            >
              Lihat halaman publik <ExternalLink className="h-3 w-3" />
            </Link>
            <Button asChild size="sm">
              <Link href="/news/baru">
                <Plus className="h-4 w-4 mr-1" />Tulis Berita
              </Link>
            </Button>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile icon={<Newspaper className="h-4 w-4" />} label="Total" value={stats.total} />
          <StatTile icon={<Eye className="h-4 w-4" />} label="Terbit" value={stats.terbit} tone="success" />
          <StatTile icon={<EyeOff className="h-4 w-4" />} label="Nonaktif" value={stats.nonaktif} tone="muted" />
          <StatTile icon={<FileText className="h-4 w-4" />} label="Artikel" value={stats.artikel} />
        </div>

        {/* Pencarian */}
        <div className="mb-4 max-w-md">
          <SearchInput placeholder="Cari judul atau ringkasan…" />
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <FilterChip href={filterHref({ status: '' })} active={status === 'semua'}>Semua status</FilterChip>
          <FilterChip href={filterHref({ status: 'terbit' })} active={status === 'terbit'}>Terbit</FilterChip>
          <FilterChip href={filterHref({ status: 'nonaktif' })} active={status === 'nonaktif'}>Nonaktif</FilterChip>
          <span className="w-px h-5 bg-border mx-1" />
          <FilterChip href={filterHref({ type: '', category: '' })} active={!activeType && !activeCategory}>
            Semua jenis
          </FilterChip>
          <FilterChip href={filterHref({ type: 'berita', category: '' })} active={activeType === 'berita' && !activeCategory}>
            Berita
          </FilterChip>
          <FilterChip href={filterHref({ type: 'artikel', category: '' })} active={activeType === 'artikel'}>
            Artikel
          </FilterChip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {ALL_CATEGORIES.map(cat => (
            <FilterChip
              key={cat}
              href={filterHref({ category: activeCategory === cat ? '' : cat, type: 'berita' })}
              active={activeCategory === cat}
              color={CATEGORY_META[cat].color}
            >
              {CATEGORY_META[cat].label}
            </FilterChip>
          ))}
        </div>

        {/* Daftar */}
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {all.length === 0
                ? 'Belum ada berita. Mulai dengan menulis berita pertama.'
                : 'Tidak ada berita yang cocok dengan filter ini.'}
            </p>
            {all.length === 0 && (
              <Button asChild size="sm" className="mt-4">
                <Link href="/news/baru">
                  <Plus className="h-4 w-4 mr-1" />Tulis Berita
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Kepala tabel — hanya di layar lebar; di mobile tiap baris jadi kartu. */}
            <div className="hidden md:grid grid-cols-[1fr_130px_110px_130px_150px] gap-3 px-4 py-2.5 border-b bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Judul</span>
              <span>Kategori</span>
              <span>Status</span>
              <span>Tanggal</span>
              <span className="text-right">Aksi</span>
            </div>

            <ul className="divide-y">
              {visible.map(item => (
                <li
                  key={item.id}
                  className="grid md:grid-cols-[1fr_130px_110px_130px_150px] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                >
                  {/* Judul + thumbnail */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden border bg-muted">
                      {!item.thumbnail_url ? (
                        <span className="flex h-full items-center justify-center text-muted-foreground/40">
                          <ImageOff className="h-4 w-4" />
                        </span>
                      ) : isOptimizable(item.thumbnail_url) ? (
                        <Image src={item.thumbnail_url} alt="" fill className="object-cover" sizes="56px" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/news/${item.id}/edit`}
                        className="block font-medium text-sm leading-snug line-clamp-2 hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {item.author?.display_name ?? 'Tanpa penulis'}
                        <span className="md:hidden"> · {formatDate(item.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Kategori / jenis */}
                  <div className="md:block">
                    {item.type === 'artikel' ? (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-foreground text-background">
                        Artikel
                      </span>
                    ) : item.category ? (
                      <span
                        className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${CATEGORY_META[item.category].color}1A`,
                          color: CATEGORY_META[item.category].color,
                        }}
                      >
                        {CATEGORY_META[item.category].label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success-wash px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />Terbit
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />Nonaktif
                      </span>
                    )}
                  </div>

                  {/* Tanggal */}
                  <span className="hidden md:block text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                  </span>

                  {/* Aksi */}
                  <div className="md:justify-self-end">
                    <RowActions newsId={item.id} title={item.title} isActive={item.is_active} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/humas/berita"
          searchParams={{
            status: status !== 'semua' ? status : undefined,
            type: activeType,
            category: activeCategory,
            q: query || undefined,
          }}
        />
      </div>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'success' | 'muted'
}) {
  const valueColor =
    tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground'
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}

function FilterChip({
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {color && !active && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {children}
    </Link>
  )
}
