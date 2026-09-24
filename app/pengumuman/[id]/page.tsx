import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Lora, Playfair_Display } from 'next/font/google'
import { ArrowLeft, Calendar } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/home/PublicFooter'
import { PAPER_SURFACE, PaperRules } from '@/components/home/paper'
import { Markdown } from '@/components/ui/markdown'
import { stripMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { labelTanggalPost, lewatTenggatPost } from '@/lib/home/post-tanggal'
import type { PublicPost } from '@/types'
import type { Metadata } from 'next'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

async function getPost(id: string): Promise<PublicPost | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('public_posts')
      .select('*, creator:users!created_by(id, display_name, role)')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    return (data as PublicPost) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getPost(id)
  if (!post) return { title: 'Tidak ditemukan — RQ LHI' }
  return {
    title: `${post.title} — RQ LHI`,
    description: stripMarkdown(post.content).slice(0, 160),
    // Flyer ikut tampil sebagai pratinjau saat tautan pengumuman dibagikan ke WhatsApp.
    ...(post.image_url ? { openGraph: { images: [{ url: post.image_url }] } } : {}),
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function PengumumanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()

  const isTugas = post.type === 'tugas_guru'
  const unit = post.target === 'sd' ? 'SDIT LHI' : post.target === 'smp' ? 'SMPIT LHI' : 'Umum'
  const overdue = lewatTenggatPost(post)

  return (
    <div
      className={`${lora.variable} ${playfair.variable} min-h-screen bg-background`}
      style={{ fontFamily: "var(--font-lora), 'Georgia', serif", fontSize: 14, lineHeight: 1.5 }}
    >
      <PublicHeader />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Kembali ke beranda
        </Link>

        <article
          className={cn(
            'relative rounded-sm border border-black/10 dark:border-white/10',
            'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-16px_rgba(0,0,0,0.3)]',
            PAPER_SURFACE,
          )}
        >
          <PaperRules />

          <div className="relative pl-12 pr-6 sm:pl-14 sm:pr-8 py-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-accent-warm">
                {isTugas ? 'Tugas Guru' : 'Pengumuman'}
              </span>
              <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {unit}
              </span>
              {overdue && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                  Lewat tenggat
                </span>
              )}
            </div>

            <h1
              className="text-3xl sm:text-[28px] leading-[1.2] tracking-tight"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {post.title}
            </h1>

            <p className="mt-2 text-xs opacity-70">
              {post.creator ? `oleh ${post.creator.display_name} · ` : ''}
              {formatDate(post.created_at)}
            </p>

            {post.due_date && (
              <p className={cn('mt-3 inline-flex items-center gap-1.5 text-sm', overdue && 'text-destructive font-medium')}>
                <Calendar className="h-4 w-4" />
                {labelTanggalPost(post.type)}: {formatDate(post.due_date)}
              </p>
            )}

            <div className="my-5 h-px bg-current opacity-10" />

            {/* Flyer utuh — tidak dipotong; ketuk untuk membuka ukuran aslinya. */}
            {post.image_url && (
              <a href={post.image_url} target="_blank" rel="noopener noreferrer" className="mb-6 block" title="Buka gambar ukuran penuh">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image_url}
                  alt={`Flyer: ${post.title}`}
                  className="mx-auto max-h-[80vh] w-auto max-w-full rounded-md border border-black/10 object-contain shadow-sm dark:border-white/10"
                />
              </a>
            )}

            {/* Isi lengkap — mendukung tebal, miring, coret, daftar, dan emoji */}
            <Markdown content={post.content} className="text-[15px] leading-[28px]" />
          </div>
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}
