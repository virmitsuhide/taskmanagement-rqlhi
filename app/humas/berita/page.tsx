import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, ExternalLink, ImageOff } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/layout/DashboardHeader'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { RowActions } from './RowActions'
import type { NewsCategory, NewsType } from '@/types'
import {
  newsDisplayStatus,
  newsPublishedAt,
  NEWS_STATUS_LABEL,
  type NewsDisplayStatus,
  type NewsRow,
} from '@/lib/data/news-status'
import { getNewsReadStats } from '@/lib/data/news-extra'

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

type StatusFilter = 'semua' | NewsDisplayStatus
const VALID_STATUS: StatusFilter[] = ['semua', 'terbit', 'terjadwal', 'draf', 'nonaktif']

const STATUS_CHIP: Record<NewsDisplayStatus, string> = {
  terbit: 'bg-success-wash text-primary',
  terjadwal: 'bg-info-wash text-info',
  draf: 'bg-muted text-muted-foreground',
  nonaktif: 'bg-accent-warm-wash text-accent-warm',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`
}

/** "1 Okt, 07.00" — jam tayang dalam WIB, apa pun zona waktu server. */
function formatWibDateTime(dateStr: string) {
  const d = new Date(new Date(dateStr).getTime() + 7 * 3600_000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTH_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}.${mm}`
}

function daysAgo(dateStr: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(dateStr).getTime()) / 86_400_000))
}

function relativeDays(dateStr: string, now: Date) {
  const n = daysAgo(dateStr, now)
  return n === 0 ? 'hari ini' : n === 1 ? 'kemarin' : `${n} hari lalu`
}

const compactId = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 })
const plainId = new Intl.NumberFormat('id-ID')

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

async function getAllNews(): Promise<NewsRow[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('news_articles')
      .select('*, author:users!news_articles_author_id_fkey(id, display_name, role)')
      .order('created_at', { ascending: false })
    return (data ?? []) as NewsRow[]
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

  const [all, readStats] = await Promise.all([getAllNews(), getNewsReadStats()])
  const now = new Date()

  // Status tayang tiap baris (Draf / Terjadwal / Terbit / Nonaktif). Sebelum
  // migrasi 0107 semua baris aktif terbaca 'terbit', persis perilaku lama.
  const statusOf = new Map<string, NewsDisplayStatus>(all.map(n => [n.id, newsDisplayStatus(n, now)]))
  const st = (n: NewsRow) => statusOf.get(n.id) ?? 'terbit'
  // view_count hanya ada setelah migrasi; sebelumnya tampil "—".
  const hasViews = all.some(n => typeof n.view_count === 'number')

  // Statistik dihitung dari seluruh arsip, bukan dari hasil filter — angkanya
  // harus tetap sama apa pun tab yang sedang dibuka.
  const stats = {
    total: all.length,
    terbit: all.filter(n => st(n) === 'terbit').length,
    terjadwal: all.filter(n => st(n) === 'terjadwal').length,
    draf: all.filter(n => st(n) === 'draf').length,
    nonaktif: all.filter(n => st(n) === 'nonaktif').length,
    artikel: all.filter(n => n.type === 'artikel').length,
  }

  // Terbit bulan ini (zona waktu server), menurut tanggal tayangnya.
  const bulanIni = all.filter(n => {
    const d = new Date(newsPublishedAt(n))
    return st(n) === 'terbit' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const bulanIniArtikel = bulanIni.filter(n => n.type === 'artikel').length

  const nextScheduled = all
    .filter(n => st(n) === 'terjadwal' && n.publish_at)
    .map(n => n.publish_at as string)
    .sort()[0]
  const oldestDraft = all
    .filter(n => st(n) === 'draf')
    .map(n => n.updated_at || n.created_at)
    .sort()[0]

  let readHint = 'aktif setelah migrasi 0107'
  if (readStats) {
    if (readStats.prev30 > 0) {
      const pct = Math.round(((readStats.last30 - readStats.prev30) / readStats.prev30) * 100)
      readHint = `${pct >= 0 ? '+' : ''}${pct}% dari 30 hari sebelumnya`
    } else {
      readHint = 'kunjungan halaman berita'
    }
  }

  const pending = stats.terjadwal + stats.draf

  let filtered = all
  if (status !== 'semua') filtered = filtered.filter(n => st(n) === status)
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

      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
        {/* Judul + aksi utama */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-warm">
              Publikasi · Kelola berita
            </p>
            <h1 className="mt-1 font-heading text-3xl leading-tight md:text-[38px]">
              Berita &amp; artikel —{' '}
              <em>
                {pending > 0
                  ? `${pending} tulisan belum tayang.`
                  : `${stats.terbit} tulisan tampil di halaman publik.`}
              </em>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tulis, terbitkan, dan sunting berita &amp; artikel yang tampil di halaman publik.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/news"
              target="_blank"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />Lihat halaman publik
            </Link>
            <Link
              href="/news/baru"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />Tulis baru
            </Link>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Terbit bulan ini"
            value={bulanIni.length}
            hint={`${bulanIni.length - bulanIniArtikel} berita · ${bulanIniArtikel} artikel`}
            tone="primary"
          />
          <StatTile
            label="Terjadwal"
            value={stats.terjadwal}
            hint={nextScheduled ? `berikutnya ${formatWibDateTime(nextScheduled)}` : 'tidak ada jadwal tayang'}
            tone="warm"
          />
          <StatTile
            label="Draf"
            value={stats.draf}
            hint={oldestDraft ? `terlama ${daysAgo(oldestDraft, now)} hari` : 'tidak ada draf'}
          />
          <StatTile
            label="Dibaca 30 hari"
            value={readStats ? compactId.format(readStats.last30) : '—'}
            hint={readHint}
          />
        </div>

        {/* Filter + pencarian */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip href={filterHref({ status: '' })} active={status === 'semua'} count={stats.total}>Semua</FilterChip>
            <FilterChip href={filterHref({ status: 'terbit' })} active={status === 'terbit'} count={stats.terbit}>Terbit</FilterChip>
            <FilterChip href={filterHref({ status: 'terjadwal' })} active={status === 'terjadwal'} count={stats.terjadwal}>Terjadwal</FilterChip>
            <FilterChip href={filterHref({ status: 'draf' })} active={status === 'draf'} count={stats.draf}>Draf</FilterChip>
            <FilterChip href={filterHref({ status: 'nonaktif' })} active={status === 'nonaktif'} count={stats.nonaktif}>Nonaktif</FilterChip>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <FilterChip href={filterHref({ type: '', category: '' })} active={!activeType && !activeCategory}>
              Semua jenis
            </FilterChip>
            <FilterChip href={filterHref({ type: 'berita', category: '' })} active={activeType === 'berita' && !activeCategory}>
              Berita
            </FilterChip>
            <FilterChip href={filterHref({ type: 'artikel', category: '' })} active={activeType === 'artikel'}>
              Artikel
            </FilterChip>
            <div className="w-full sm:ml-auto sm:w-64">
              <SearchInput placeholder="Cari judul atau ringkasan…" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_CATEGORIES.map(cat => (
              <FilterChip
                key={cat}
                href={filterHref({ category: activeCategory === cat ? '' : cat, type: 'berita' })}
                active={activeCategory === cat}
                color={CATEGORY_META[cat].color}
                small
              >
                {CATEGORY_META[cat].label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Daftar */}
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
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
          <div className="overflow-hidden rounded-2xl border bg-card">
            <ul className="divide-y">
              {visible.map(item => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-4 md:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    {/* Thumbnail */}
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {!item.thumbnail_url ? (
                        <span className="flex h-full items-center justify-center text-muted-foreground/40">
                          <ImageOff className="h-5 w-5" />
                        </span>
                      ) : isOptimizable(item.thumbnail_url) ? (
                        <Image src={item.thumbnail_url} alt="" fill className="object-cover" sizes="96px" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>

                    {/* Judul + meta */}
                    <div className="min-w-0">
                      <Link
                        href={`/news/${item.id}/edit`}
                        className="line-clamp-2 font-heading text-lg leading-snug hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        {item.type === 'artikel' ? (
                          <span className="font-semibold text-foreground">Artikel</span>
                        ) : item.category ? (
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: CATEGORY_META[item.category].color }}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {CATEGORY_META[item.category].label}
                          </span>
                        ) : (
                          <span>Berita</span>
                        )}
                        <span>·</span>
                        <span>{item.author?.display_name ?? 'Tanpa penulis'}</span>
                        <span>·</span>
                        {st(item) === 'terjadwal' && item.publish_at ? (
                          <span>tayang {formatWibDateTime(item.publish_at)}</span>
                        ) : st(item) === 'draf' ? (
                          <span>diubah {relativeDays(item.updated_at || item.created_at, now)}</span>
                        ) : (
                          <span>{formatDate(newsPublishedAt(item))}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${STATUS_CHIP[st(item)]}`}>
                      {NEWS_STATUS_LABEL[st(item)]}
                    </span>
                    <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                      {hasViews && st(item) !== 'draf' && st(item) !== 'terjadwal' && typeof item.view_count === 'number'
                        ? `${plainId.format(item.view_count)} dibaca`
                        : '—'}
                    </span>
                    <RowActions newsId={item.id} title={item.title} isActive={item.is_active} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t px-4 py-3 md:px-5">
              {totalPages <= 1 ? (
                <p className="text-xs text-muted-foreground">1–{total} dari {total}</p>
              ) : (
                <Pagination
                  className="pt-0"
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number | string
  hint: string
  tone?: 'primary' | 'warm'
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-heading text-3xl leading-none tabular-nums md:text-[34px] ${
        tone === 'primary' ? 'text-primary' : tone === 'warm' ? 'text-accent-warm' : ''
      }`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function FilterChip({
  href,
  active,
  color,
  count,
  small,
  children,
}: {
  href: string
  active: boolean
  color?: string
  count?: number
  small?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold transition-colors ${
        small ? 'h-7 px-3 text-xs' : 'h-9 px-3.5 text-[13px]'
      } ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-foreground hover:bg-muted'
      }`}
    >
      {color && !active && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {children}
      {count !== undefined && (
        <span className={`tabular-nums ${active ? 'opacity-80' : 'text-muted-foreground'}`}>{count}</span>
      )}
    </Link>
  )
}
