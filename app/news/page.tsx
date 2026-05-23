import Link from 'next/link'
import { ArrowLeft, Plus, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Lora, Playfair_Display } from 'next/font/google'
import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canCreateNews } from '@/lib/auth/permissions'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { toggleNewsAction, deleteNewsAction } from '@/app/actions/news'
import { Button } from '@/components/ui/button'
import type { NewsArticle } from '@/types'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`
}

function excerpt(text: string, max = 160) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
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

export default async function NewsPage() {
  const [news, session] = await Promise.all([getNews(), getSession()])
  const isEditor = session && canCreateNews(session.role)

  const visible = isEditor ? news : news.filter(n => n.is_active)

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-lora), 'Georgia', serif", fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-6 pt-9 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ArrowLeft className="h-3 w-3" /> Kembali ke Beranda
            </Link>
            <h1
              className="text-[clamp(26px,4vw,38px)] font-bold leading-tight tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Berita &amp; Kabar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {visible.length} artikel · Rumah Qur&apos;an LHI
            </p>
          </div>
          {isEditor && (
            <Button asChild size="sm" className="shrink-0 mt-4">
              <Link href="/news/baru">
                <Plus className="h-4 w-4 mr-1" />Buat Berita
              </Link>
            </Button>
          )}
        </div>

        {/* News list */}
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed py-20 text-center">
            <p className="text-sm text-muted-foreground">Belum ada berita yang dipublikasikan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((item, i) => (
              <article
                key={item.id}
                className={`group rounded-xl border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-sm transition ${!item.is_active ? 'opacity-50' : ''}`}
              >
                <div className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Date + author */}
                      <div className="flex items-center gap-2 mb-2 text-[11px] text-muted-foreground">
                        <span className="font-medium">{formatDate(item.created_at)}</span>
                        {item.author && (
                          <>
                            <span>·</span>
                            <span>{item.author.display_name}</span>
                          </>
                        )}
                        {!item.is_active && (
                          <span className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">
                            Non-aktif
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h2
                        className={`font-bold leading-snug mb-2 ${i === 0 ? 'text-xl md:text-2xl' : 'text-base md:text-lg'}`}
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                      >
                        {item.title}
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {excerpt(item.content, i === 0 ? 240 : 140)}
                      </p>

                      <span className="inline-block mt-3 text-xs font-semibold text-primary hover:underline">
                        Baca selengkapnya →
                      </span>
                    </div>

                    {/* Editor controls */}
                    {isEditor && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <form action={toggleNewsAction.bind(null, item.id, !item.is_active) as unknown as (fd: FormData) => void}>
                          <button
                            type="submit"
                            title={item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            {item.is_active
                              ? <EyeOff className="h-4 w-4" />
                              : <Eye className="h-4 w-4" />
                            }
                          </button>
                        </form>
                        <form action={deleteNewsAction.bind(null, item.id) as unknown as (fd: FormData) => void}>
                          <button
                            type="submit"
                            title="Hapus"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
